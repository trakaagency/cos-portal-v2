// pages/api/gmail-sync.js
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
    // Check authentication
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userId = session.user.id
    console.log('Gmail sync requested for user:', userId)

    // Get user's Gmail tokens from session
    console.log('Session access token available:', !!session.accessToken)
    
    if (!session.accessToken) {
      console.log('No access token in session, checking database...')
      
      // Try to get tokens from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('gmail_token, gmail_refresh_token')
        .eq('id', userId)
        .single()

      if (userError || !userData?.gmail_token) {
        return res.status(400).json({ 
          error: 'No Gmail access token found',
          message: 'Please sign out and sign in again to grant Gmail access',
          action: 'reauthorize'
        })
      }
      
      // Use token from database
      console.log('Using token from database')
      var accessToken = userData.gmail_token
    } else {
      var accessToken = session.accessToken
    }

    console.log('Found Gmail token, fetching emails...')

    // Fetch emails from Gmail API with CoS-related search
    console.log('Making Gmail API request...')
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=has:attachment',
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
      
      if (gmailResponse.status === 401) {
        return res.status(401).json({ 
          error: 'Gmail access token expired',
          message: 'Please sign out and sign in again to refresh Gmail access'
        })
      }
      
      return res.status(500).json({ 
        error: 'Failed to fetch from Gmail API',
        details: errorText
      })
    }

    const gmailData = await gmailResponse.json()
    console.log(`Found ${gmailData.messages?.length || 0} messages from Gmail`)

    if (!gmailData.messages || gmailData.messages.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No CoS-related emails found in Gmail',
        emails_synced: 0
      })
    }

    // Fetch detailed information for each message
    const emailPromises = gmailData.messages.slice(0, 10).map(async (message) => {
      try {
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
          console.error('Failed to fetch message details for:', message.id)
          return null
        }

        const messageData = await messageResponse.json()
        
        // Extract relevant information
        const headers = messageData.payload.headers
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender'
        const date = headers.find(h => h.name === 'Date')?.value
        
        // Check for attachments
        const attachments = []
        if (messageData.payload.parts) {
          for (const part of messageData.payload.parts) {
            if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                attachmentId: part.body.attachmentId,
                size: part.body.size || 0
              })
            }
          }
        }

        const hasAttachment = attachments.length > 0
        
        // Determine if CoS relevant
        const cosRelevant = /certificate|sponsorship|cos|visa|tier/i.test(subject + ' ' + from)

        return {
          gmail_id: message.id,
          thread_id: message.threadId,
          subject,
          sender: from.split('<')[0].trim(),
          sender_email: from.match(/<(.+)>/)?.[1] || from,
          received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          has_attachment: hasAttachment,
          cos_relevant: cosRelevant,
          priority: cosRelevant ? 'high' : 'normal',
          labels: cosRelevant ? ['cos'] : [],
          attachment_count: attachments.length,
          attachments: attachments,
          raw_data: {
            headers: headers,
            messageId: message.id,
            threadId: message.threadId
          }
        }
      } catch (error) {
        console.error('Error processing message:', message.id, error)
        return null
      }
    })

    const emailDetails = (await Promise.all(emailPromises)).filter(email => email !== null)
    console.log(`Processed ${emailDetails.length} emails from Gmail`)

    // Save emails to database
    let savedCount = 0
    for (const emailData of emailDetails) {
      try {
        // Check if email already exists
        const { data: existingEmail } = await supabase
          .from('emails')
          .select('id')
          .eq('gmail_id', emailData.gmail_id)
          .eq('user_id', userId)
          .single()

        if (!existingEmail) {
          // Insert new email
          const { error: insertError } = await supabase
            .from('emails')
            .insert({
              user_id: userId,
              gmail_id: emailData.gmail_id,
              thread_id: emailData.thread_id,
              subject: emailData.subject,
              sender: emailData.sender,
              sender_email: emailData.sender_email,
              received_at: emailData.received_at,
              has_attachment: emailData.has_attachment,
              processed: false,
              cos_relevant: emailData.cos_relevant,
              priority: emailData.priority,
              labels: emailData.labels,
              attachment_count: emailData.attachment_count,
              raw_data: emailData.raw_data,
              created_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('Failed to insert email:', emailData.gmail_id, insertError)
          } else {
            savedCount++
            console.log('Saved email:', emailData.subject)
          }
        }
      } catch (error) {
        console.error('Error saving email:', emailData.gmail_id, error)
      }
    }

    console.log(`Saved ${savedCount} new emails to database`)

    res.status(200).json({
      success: true,
      message: `Successfully synced ${savedCount} new emails from Gmail`,
      emails_found: emailDetails.length,
      emails_synced: savedCount,
      gmail_messages_total: gmailData.messages.length,
      emails_with_attachments: emailDetails.filter(e => e.has_attachment).length
    })

  } catch (error) {
    console.error('Gmail sync error:', error)
    res.status(500).json({ 
      error: 'Gmail sync failed', 
      details: error.message 
    })
  }
}