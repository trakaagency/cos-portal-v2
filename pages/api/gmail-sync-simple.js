// pages/api/gmail-sync-simple.js
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userId = session.user.id
    console.log('Simple Gmail sync for user:', userId)

    // Get access token
    let accessToken = session.accessToken
    
    if (!accessToken) {
      const { data: userData } = await supabase
        .from('users')
        .select('gmail_token')
        .eq('id', userId)
        .single()
      
      accessToken = userData?.gmail_token
    }

    if (!accessToken) {
      return res.status(400).json({ 
        error: 'No Gmail access token',
        message: 'Please sign out and sign in again'
      })
    }

    console.log('Fetching recent emails from Gmail...')

    // Fetch recent emails (any emails, not filtered)
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!gmailResponse.ok) {
      const errorText = await gmailResponse.text()
      console.error('Gmail API error:', gmailResponse.status, errorText)
      
      return res.status(gmailResponse.status).json({ 
        error: 'Gmail API failed',
        details: errorText,
        status: gmailResponse.status
      })
    }

    const gmailData = await gmailResponse.json()
    console.log(`Found ${gmailData.messages?.length || 0} messages`)

    if (!gmailData.messages || gmailData.messages.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No messages found in Gmail',
        emails_synced: 0
      })
    }

    // Process first few messages
    let savedCount = 0
    
    for (const message of gmailData.messages.slice(0, 3)) {
      try {
        console.log('Processing message:', message.id)
        
        // Get message details
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!messageResponse.ok) {
          console.error('Failed to fetch message:', message.id)
          continue
        }

        const messageData = await messageResponse.json()
        const headers = messageData.payload.headers || []
        
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender'
        const date = headers.find(h => h.name === 'Date')?.value
        
        // Simple attachment detection
        const hasAttachment = !!(messageData.payload.parts?.some(part => 
          part.filename && part.filename.length > 0
        ))

        // Check if already exists
        const { data: existingEmail } = await supabase
          .from('emails')
          .select('id')
          .eq('gmail_id', message.id)
          .eq('user_id', userId)
          .single()

        if (existingEmail) {
          console.log('Email already exists:', message.id)
          continue
        }

        // Insert email
        const { data: newEmail, error: insertError } = await supabase
          .from('emails')
          .insert({
            user_id: userId,
            gmail_id: message.id,
            thread_id: message.threadId,
            subject: subject,
            sender: from.split('<')[0].trim(),
            sender_email: from.match(/<(.+)>/)?.[1] || from,
            received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            has_attachment: hasAttachment,
            processed: false,
            cos_relevant: /certificate|sponsorship|cos|visa|tier/i.test(subject + ' ' + from),
            priority: 'normal',
            labels: [],
            attachment_count: hasAttachment ? 1 : 0,
            raw_data: {
              messageId: message.id,
              threadId: message.threadId,
              headers: headers.slice(0, 10) // Store some headers
            },
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Failed to insert email:', message.id, insertError)
        } else {
          console.log('Saved email:', newEmail.id, subject)
          savedCount++
        }

      } catch (messageError) {
        console.error('Error processing message:', message.id, messageError)
      }
    }

    console.log(`Successfully saved ${savedCount} emails`)

    res.status(200).json({
      success: true,
      message: `Synced ${savedCount} emails from Gmail`,
      emails_found: gmailData.messages.length,
      emails_synced: savedCount
    })

  } catch (error) {
    console.error('Simple Gmail sync error:', error)
    res.status(500).json({ 
      error: 'Gmail sync failed', 
      details: error.message 
    })
  }
}