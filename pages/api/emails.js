// pages/api/emails.js
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  console.log('Emails API called with method:', req.method)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get query parameters
  const { filterVisa = 'false', attachmentsOnly = 'false' } = req.query;
  const shouldFilterVisa = filterVisa === 'true';
  const shouldFilterAttachments = attachmentsOnly === 'true';

  console.log('API: filterVisa parameter:', filterVisa);
  console.log('API: shouldFilterVisa:', shouldFilterVisa);
  console.log('API: attachmentsOnly parameter:', attachmentsOnly);
  console.log('API: shouldFilterAttachments:', shouldFilterAttachments);

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

    console.log('User authenticated, fetching emails...')
    console.log('Access token exists:', !!session.accessToken)
    console.log('Refresh token exists:', !!session.refreshToken)

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

    // Test the token before making Gmail API calls
    try {
      await oauth2Client.getAccessToken()
      console.log('✅ Token validation successful')
    } catch (tokenError) {
      console.error('❌ Token validation failed:', tokenError.message)
      return res.status(401).json({ 
        error: 'Invalid or expired token. Please sign in again.',
        code: 'TOKEN_VALIDATION_ERROR'
      })
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Build search query based on filter settings
    let query = '-from:me'; // Exclude sent emails
    
    if (shouldFilterVisa) {
      // When Visa filter is ON: Add visa-related search terms
      query += ' AND (visa OR cos OR "certificate of sponsorship" OR "tier 2" OR "work permit" OR immigration OR "home office" OR "visa application" OR "visa request" OR "visa process" OR "visa status" OR "visa approval" OR "visa rejection" OR "visa extension" OR "visa renewal" OR "visa transfer" OR "visa change" OR "visa update" OR "visa document" OR "visa form" OR "visa fee" OR "visa interview" OR "visa appointment" OR "visa biometric" OR "visa medical" OR "visa police" OR "visa criminal" OR "visa character" OR "visa financial" OR "visa bank" OR "visa sponsor" OR "sponsorship" OR "ukvi" OR "border force" OR "visa office" OR "visa centre" OR "visa application centre" OR "biometric appointment" OR "visa police certificate" OR "visa criminal record" OR "visa character reference" OR "visa financial evidence" OR "visa bank statement" OR "visa sponsor letter" OR "visa sponsor certificate" OR "visa sponsor document" OR "visa sponsor form" OR "visa sponsor fee" OR "visa sponsor payment" OR "visa sponsor approval" OR "visa sponsor rejection" OR "visa sponsor extension" OR "visa sponsor renewal" OR "visa sponsor transfer" OR "visa sponsor change" OR "visa sponsor update" OR "visa sponsor interview" OR "visa sponsor appointment" OR "visa sponsor biometric" OR "visa sponsor medical" OR "visa sponsor police" OR "visa sponsor criminal" OR "visa sponsor character" OR "visa sponsor financial" OR "visa sponsor bank" OR "tier 5" OR "skilled worker" OR "points based" OR "immigration rules" OR "uk border agency")';
    }
    
    if (shouldFilterAttachments) {
      // When Attachments filter is ON: Add attachment search
      query += ' AND has:attachment';
    }
    
    console.log('Searching Gmail with query:', query)
    console.log('Filter setting:', shouldFilterVisa ? 'Visa filter ON' : 'Visa filter OFF', shouldFilterAttachments ? 'Attachments filter ON' : 'Attachments filter OFF')

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50, // Increased to account for thread deduplication
    })

    if (!response.data.messages) {
      console.log('No messages found')
      return res.status(200).json({ emails: [] })
    }

    console.log(`Found ${response.data.messages.length} messages from Gmail search`)
    console.log(`Visa filter: ${shouldFilterVisa ? 'ON' : 'OFF'}, Attachments filter: ${shouldFilterAttachments ? 'ON' : 'OFF'}`)
    console.log(`Max results requested: 50`)

    // Get detailed information for each email
    const emails = []
    const threadMap = new Map() // Track latest email per thread
    let processedCount = 0
    let errorCount = 0
    
    for (const message of response.data.messages) {
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
        const threadId = email.threadId

        // Extract email body text for better snippets
        let emailBody = '';
        const extractTextFromParts = (parts) => {
          if (!parts) return '';
          
          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              try {
                const decodedText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                emailBody += decodedText;
              } catch (error) {
                console.error('Error decoding text part:', error);
              }
            } else if (part.mimeType === 'text/html' && part.body.data && !emailBody) {
              // Use HTML content if no plain text is available
              try {
                const decodedText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                // Simple HTML tag removal for snippet
                const cleanText = decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                emailBody += cleanText;
              } catch (error) {
                console.error('Error decoding HTML part:', error);
              }
            }
            
            if (part.parts) {
              emailBody += extractTextFromParts(part.parts);
            }
          }
          return emailBody;
        };

        // Extract text from email body
        if (email.payload.parts) {
          emailBody = extractTextFromParts(email.payload.parts);
        } else if (email.payload.body && email.payload.body.data) {
          // Handle single part emails
          try {
            const decodedText = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
            if (email.payload.mimeType === 'text/html') {
              emailBody = decodedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            } else {
              emailBody = decodedText;
            }
          } catch (error) {
            console.error('Error decoding email body:', error);
          }
        }

        // Create a better snippet - use Gmail's snippet if available, otherwise use our extracted text
        let snippet = email.snippet || '';
        
        // If Gmail's snippet is too short or empty, use our extracted text
        if (!snippet || snippet.length < 20) {
          if (emailBody) {
            // Clean up the email body - remove common email signatures and quoted text
            let cleanBody = emailBody;
            
            // Remove quoted text (lines starting with >)
            cleanBody = cleanBody.replace(/^>.*$/gm, '').trim();
            
            // Remove common email signatures
            cleanBody = cleanBody.replace(/--\s*\n[\s\S]*$/, '').trim();
            cleanBody = cleanBody.replace(/Sent from my iPhone[\s\S]*$/i, '').trim();
            cleanBody = cleanBody.replace(/Sent from my iPad[\s\S]*$/i, '').trim();
            cleanBody = cleanBody.replace(/Sent from my Mac[\s\S]*$/i, '').trim();
            
            // Use first 120 characters of cleaned body as snippet
            snippet = cleanBody.substring(0, 120).trim();
            if (snippet.length === 120) {
              snippet += '...';
            }
          }
        }

        // Clean up the snippet to remove thread content and quoted replies
        if (snippet) {
          // Remove quoted replies (common patterns in email threads)
          snippet = snippet.replace(/^.*\s+wrote:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+<.*@.*>\s+wrote:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+said:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+on.*wrote:.*$/gm, '').trim();
          
          // Remove lines that start with common email thread indicators
          snippet = snippet.replace(/^.*\s+Traka\s+.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+From:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+To:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+Subject:.*$/gm, '').trim();
          snippet = snippet.replace(/^.*\s+Date:.*$/gm, '').trim();
          
          // Remove HTML entities
          snippet = snippet.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          
          // Take only the first meaningful line (before any quoted content)
          const lines = snippet.split('\n');
          const firstMeaningfulLine = lines.find(line => 
            line.trim().length > 0 && 
            !line.includes('wrote:') && 
            !line.includes('From:') && 
            !line.includes('To:') && 
            !line.includes('Subject:') && 
            !line.includes('Date:') &&
            !line.includes('Traka') &&
            !line.startsWith('>')
          );
          
          if (firstMeaningfulLine) {
            snippet = firstMeaningfulLine.trim();
            if (snippet.length > 120) {
              snippet = snippet.substring(0, 120) + '...';
            }
          } else {
            // If no meaningful line found, use a shorter version of the original
            snippet = snippet.substring(0, 80).trim();
            if (snippet.length === 80) {
              snippet += '...';
            }
          }
        }

        // Find PDF attachments
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

        // Create email data object
        const emailData = {
          id: message.id,
          sender: from,
          subject,
          timestamp: date,
          snippet: snippet,
          attachments,
          threadId: threadId
        }

        // Debug logging for visa filter
        if (shouldFilterVisa) {
          console.log(`✅ INCLUDING visa email: "${subject}" from ${from}`);
        }

        // Track latest email per thread (ALWAYS deduplicate like Gmail inbox)
        if (threadId) {
          const existingEmail = threadMap.get(threadId);
          if (!existingEmail || new Date(date) > new Date(existingEmail.timestamp)) {
            threadMap.set(threadId, emailData);
          }
        } else {
          // For emails without threadId, add them directly
          emails.push(emailData);
        }
        processedCount++;

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error)
        errorCount++;
      }
    }

    // Add the latest email from each thread to the final results (ALWAYS deduplicate like Gmail)
    for (const [threadId, emailData] of threadMap) {
      emails.push(emailData);
    }

    // Sort emails by timestamp (newest first)
    emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`Final result: ${emails.length} emails (deduplicated by thread like Gmail)`)
    console.log(`Thread map size: ${threadMap.size}`)
    console.log(`Direct emails added: ${emails.length - threadMap.size}`)
    console.log(`Filter summary: Visa=${shouldFilterVisa}, Attachments=${shouldFilterAttachments}`)
    console.log(`Processed: ${processedCount}, Errors: ${errorCount}`);

    return res.status(200).json({ emails })

  } catch (error) {
    console.error('Error fetching emails:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    })
  }
}