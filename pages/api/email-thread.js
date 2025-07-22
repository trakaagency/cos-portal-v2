// pages/api/email-thread.js
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { google } from 'googleapis'

export default async function handler(req, res) {
  console.log('Email Thread API called with method:', req.method)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions)
    if (!session?.accessToken) {
      console.error('No session or access token found')
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Check if there's a token error
    if (session.error === 'RefreshAccessTokenError') {
      console.error('Token refresh failed, user needs to re-authenticate')
      return res.status(401).json({ 
        error: 'Authentication expired. Please sign in again.',
        code: 'REFRESH_TOKEN_ERROR'
      })
    }

    const { threadId, searchTerm } = req.query

    if (!threadId) {
      return res.status(400).json({ error: 'Thread ID is required' })
    }

    console.log('User authenticated, fetching thread:', threadId)

    // Set up Gmail API with automatic token refresh
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Get the thread
    const threadResponse = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
    })

    if (!threadResponse.data.messages) {
      console.log('No messages found in thread')
      return res.status(200).json({ messages: [] })
    }

    console.log(`Found ${threadResponse.data.messages.length} messages in thread`)

    // Process each message in the thread
    const messages = []
    
    for (const message of threadResponse.data.messages) {
      try {
        const emailDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
        })

        const email = emailDetails.data
        const headers = email.payload.headers

        // Extract email metadata
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown'
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject'
        const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString()
        const to = headers.find(h => h.name === 'To')?.value || ''
        const cc = headers.find(h => h.name === 'Cc')?.value || ''

        // Extract email body
        let body = ''
        if (email.payload.parts) {
          // Find text/plain part
          const textPart = email.payload.parts.find(part => 
            part.mimeType === 'text/plain'
          )
          if (textPart && textPart.body.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
          }
        } else if (email.payload.body.data) {
          // Single part message
          body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8')
        }

        // Clean up the email body to remove quoted conversation history
        if (body) {
          // Remove quoted text (lines starting with >)
          body = body.replace(/^>.*$/gm, '').trim();
          
          // Remove common email thread patterns
          body = body.replace(/^.*\s+wrote:.*$/gm, '').trim();
          body = body.replace(/^.*\s+<.*@.*>\s+wrote:.*$/gm, '').trim();
          body = body.replace(/^.*\s+said:.*$/gm, '').trim();
          body = body.replace(/^.*\s+on.*wrote:.*$/gm, '').trim();
          
          // Remove email headers that might be quoted
          body = body.replace(/^.*\s+From:.*$/gm, '').trim();
          body = body.replace(/^.*\s+To:.*$/gm, '').trim();
          body = body.replace(/^.*\s+Subject:.*$/gm, '').trim();
          body = body.replace(/^.*\s+Date:.*$/gm, '').trim();
          body = body.replace(/^.*\s+Sent:.*$/gm, '').trim();
          
          // Remove common email signatures
          body = body.replace(/--\s*\n[\s\S]*$/, '').trim();
          body = body.replace(/Sent from my iPhone[\s\S]*$/i, '').trim();
          body = body.replace(/Sent from my iPad[\s\S]*$/i, '').trim();
          body = body.replace(/Sent from my Mac[\s\S]*$/i, '').trim();
          
          // Remove HTML entities
          body = body.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          
          // Take only the first meaningful paragraph (before any quoted content)
          const lines = body.split('\n');
          const meaningfulLines = lines.filter(line => 
            line.trim().length > 0 && 
            !line.includes('wrote:') && 
            !line.includes('From:') && 
            !line.includes('To:') && 
            !line.includes('Subject:') && 
            !line.includes('Date:') &&
            !line.includes('Sent:') &&
            !line.startsWith('>') &&
            !line.startsWith('On ') &&
            !line.includes('Traka') &&
            !line.includes('trakaagency@gmail.com') &&
            !line.includes('trakacos@gmail.com')
          );
          
          if (meaningfulLines.length > 0) {
            // Join the meaningful lines and take the first paragraph
            const cleanBody = meaningfulLines.join('\n').trim();
            const firstParagraph = cleanBody.split('\n\n')[0];
            body = firstParagraph || cleanBody;
          }
        }

        // Find attachments
        const attachments = []
        
        const findAttachments = (parts) => {
          if (!parts) return
          
          for (const part of parts) {
            if (part.filename && (
              part.filename.toLowerCase().endsWith('.pdf') ||
              part.filename.toLowerCase().endsWith('.doc') ||
              part.filename.toLowerCase().endsWith('.docx')
            )) {
              attachments.push({
                id: part.body.attachmentId,
                filename: part.filename,
                size: part.body.size || 0,
                mimeType: part.mimeType
              })
            }
            
            if (part.parts) {
              findAttachments(part.parts)
            }
          }
        }

        if (email.payload.parts) {
          findAttachments(email.payload.parts)
        }

        // Filter by search term if provided
        const searchLower = searchTerm ? searchTerm.toLowerCase() : ''
        const matchesSearch = !searchTerm || 
          subject.toLowerCase().includes(searchLower) ||
          from.toLowerCase().includes(searchLower) ||
          body.toLowerCase().includes(searchLower) ||
          email.snippet?.toLowerCase().includes(searchLower)

        if (matchesSearch) {
          messages.push({
            id: message.id,
            sender: from,
            subject,
            timestamp: date,
            snippet: email.snippet || '',
            body,
            to,
            cc,
            attachments,
            threadId: threadId
          })
        }

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error)
      }
    }

    // Sort messages by date (newest first for thread view - like email inbox)
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`Processed ${messages.length} messages in thread`)

    return res.status(200).json({ 
      messages,
      threadId,
      searchTerm: searchTerm || null,
      totalMessages: threadResponse.data.messages.length
    })

  } catch (error) {
    console.error('Error fetching email thread:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch email thread',
      details: error.message 
    })
  }
} 