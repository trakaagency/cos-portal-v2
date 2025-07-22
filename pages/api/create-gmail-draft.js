// pages/api/create-gmail-draft.js
import { google } from 'googleapis'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Add CORS headers for POST requests
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL || 'http://localhost:3000')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const {
      artistId,
      artistName,
      passportNumber,
      visaDocuments,
      recipientEmail: originalRecipientEmail,
      originalEmailSubject,
      originalEmailFrom,
      showDateStartMonth,
      artist
    } = req.body

    if (!artistName || !visaDocuments || visaDocuments.length === 0) {
      return res.status(400).json({ error: 'Artist name and visa documents are required' })
    }

    // Get the user session
    const session = await getServerSession(req, res, authOptions)
    console.log('🔍 Gmail Draft - Session debug:')
    console.log('- Session exists:', !!session)
    console.log('- User email:', session?.user?.email)
    console.log('- Has access token:', !!session?.accessToken)
    console.log('- Has refresh token:', !!session?.refreshToken)
    
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

    // Check if user has the correct Gmail scope
    if (!session.accessToken) {
      console.error('Missing access token, user needs to re-authenticate')
      return res.status(401).json({ 
        error: 'Gmail permissions required. Please sign out and sign in again.',
        code: 'GMAIL_SCOPE_ERROR'
      })
    }

    // Initialize Google OAuth2 client with user's session tokens
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

    console.log('Gmail API initialized with user session')

    // Get the actual date range from the artist data
    const dateRange = artist.showDateStartDay && artist.showDateStartMonth && artist.showDateStartYear && 
                     artist.showDateEndDay && artist.showDateEndMonth && artist.showDateEndYear
      ? `${artist.showDateStartDay}-${artist.showDateStartMonth}-${artist.showDateStartYear} - ${artist.showDateEndDay}-${artist.showDateEndMonth}-${artist.showDateEndYear}`
      : 'show'

    console.log('Creating draft for artist:', artistName, 'Date Range:', dateRange)

    // Get user's email from session
    const userEmail = session.user?.email || 'alberto@orchid-am.com'
    
    // Determine the recipient - use the original email sender if available
    let recipientEmail = originalEmailFrom || originalRecipientEmail || 'alberto@orchid-am.com'
    
    // Get the original email's message ID for proper threading
    let originalMessageId = req.body.originalEmailId
    console.log('🔍 Original email ID from request:', originalMessageId)
    
    if (originalMessageId) {
      try {
        console.log('🔍 Fetching original email for threading:', originalMessageId)
        const originalEmail = await gmail.users.messages.get({
          userId: 'me',
          id: originalMessageId
        })
        
        console.log('🔍 Original email data:', {
          id: originalEmail.data.id,
          threadId: originalEmail.data.threadId,
          labelIds: originalEmail.data.labelIds
        })
        
        // Extract the Message-ID header from the original email
        const headers = originalEmail.data.payload?.headers || []
        console.log('🔍 Original email headers:', headers.map(h => ({ name: h.name, value: h.value })))
        
        const messageIdHeader = headers.find(h => h.name.toLowerCase() === 'message-id')
        if (messageIdHeader) {
          originalMessageId = messageIdHeader.value
          console.log('🔍 Found original Message-ID:', originalMessageId)
        } else {
          console.log('🔍 No Message-ID header found, using Gmail ID')
          // Use the Gmail message ID as fallback
          originalMessageId = `<${originalEmail.data.id}@gmail.com>`
        }
      } catch (error) {
        console.warn('🔍 Could not fetch original email for threading:', error.message)
        // Use the provided ID as fallback
        originalMessageId = `<${originalMessageId}@gmail.com>`
      }
    }
    
    // Extract email address from "Name <email@domain.com>" format if needed
    if (recipientEmail.includes('<') && recipientEmail.includes('>')) {
      const emailMatch = recipientEmail.match(/<(.+?)>/)
      if (emailMatch) {
        recipientEmail = emailMatch[1]
      }
    }
    
    console.log('Creating draft with recipient:', recipientEmail)
    console.log('Original email from:', originalEmailFrom)
    console.log('Original recipient email:', originalRecipientEmail)
    console.log('Final recipient email:', recipientEmail)
    console.log('Artist data received:', {
      artistName: artistName,
      sourceEmailId: artist?.sourceEmailId,
      sourceEmailSubject: artist?.sourceEmailSubject,
      sourceEmailFrom: artist?.sourceEmailFrom
    })
    
    // Create email content with beautiful HTML format
    const subject = `Re: ${originalEmailSubject || 'Certificate of Sponsorship'}`
    const emailBody = createHTMLEmail(dateRange, userEmail)
    
    // Fetch visa documents and convert to base64 for attachments
    console.log('Fetching visa documents for attachments...')
    const attachments = []
    
    if (visaDocuments && visaDocuments.length > 0) {
      for (const doc of visaDocuments) {
        try {
          console.log('Fetching document from URL:', doc.url)
          const response = await fetch(doc.url)
          if (!response.ok) {
            console.warn(`Failed to fetch document from ${doc.url}: ${response.status}`)
            continue
          }
          
          const buffer = await response.arrayBuffer()
          const base64Data = Buffer.from(buffer).toString('base64')
          
          attachments.push({
            filename: doc.filename,
            mimeType: doc.type || 'application/octet-stream',
            data: base64Data
          })
          
          console.log(`Successfully processed attachment: ${doc.filename}`)
        } catch (error) {
          console.error(`Error processing attachment ${doc.filename}:`, error)
        }
      }
    }
    
    // Create the email message with attachments
    const message = {
      subject: subject,
      to: recipientEmail,
      body: emailBody,
      from: userEmail,
      attachments: attachments,
      // Add reply headers if we have the original email data
      inReplyTo: originalMessageId ? originalMessageId : undefined,
      references: originalMessageId ? originalMessageId : undefined
    }

    console.log('🔍 Email threading info:', {
      originalEmailId: req.body.originalEmailId,
      originalMessageId: originalMessageId,
      inReplyTo: message.inReplyTo,
      references: message.references,
      subject: subject
    })

    // Alternative approach: Use Gmail's thread ID for better threading
    let threadId = undefined
    if (req.body.originalEmailId) {
      try {
        const originalEmail = await gmail.users.messages.get({
          userId: 'me',
          id: req.body.originalEmailId
        })
        threadId = originalEmail.data.threadId
        console.log('🔍 Using thread ID for better threading:', threadId)
      } catch (error) {
        console.warn('🔍 Could not get thread ID:', error.message)
      }
    }

    // Create the draft with attachments
    console.log('Attempting to create Gmail draft with attachments...')
    console.log('Processed attachments:', attachments.length)
    
    const draftRequest = {
      message: {
        raw: Buffer.from(createEmailRawWithAttachments(message)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      }
    }

    // Add thread ID if available for better threading
    if (threadId) {
      draftRequest.message.threadId = threadId
      console.log('🔍 Adding thread ID to draft:', threadId)
    }

    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: draftRequest
    })

    console.log('Gmail draft created successfully:', draft.data.id)

    return res.status(200).json({
      success: true,
      draftId: draft.data.id,
      message: 'Gmail draft created successfully'
    })

  } catch (error) {
    console.error('Error in create-gmail-draft:', error)
    
    // Check for specific Gmail API errors
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Gmail permissions required. Please sign out and sign in again.',
        code: 'GMAIL_PERMISSION_ERROR'
      })
    }
    
    if (error.code === 401) {
      return res.status(401).json({ 
        error: 'Authentication expired. Please sign in again.',
        code: 'AUTH_ERROR'
      })
    }
    
    return res.status(500).json({ 
      error: 'Failed to create Gmail draft', 
      details: error.message 
    })
  }
}

// Helper function to create beautiful HTML email
function createHTMLEmail(month, userEmail) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate of Sponsorship</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
            margin: 20px 0;
        }
        .header {
            border-bottom: 3px solid #4285f4;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .title {
            color: #4285f4;
            font-size: 24px;
            font-weight: bold;
            margin: 0;
        }
        .subtitle {
            color: #666;
            font-size: 16px;
            margin: 5px 0 0 0;
        }
        .content {
            font-size: 16px;
            line-height: 1.7;
        }
        .important-box {
            background-color: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
        }
        .important-title {
            color: #856404;
            font-weight: bold;
            font-size: 18px;
            margin: 0 0 10px 0;
        }
        .important-text {
            color: #856404;
            font-weight: 600;
            margin: 0;
        }
        .contact-box {
            background-color: #e3f2fd;
            border: 2px solid #2196f3;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
        }
        .contact-title {
            color: #1976d2;
            font-weight: bold;
            font-size: 18px;
            margin: 0 0 10px 0;
        }
        .contact-details {
            color: #1976d2;
            margin: 0;
            line-height: 1.8;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
        }
        .highlight {
            background-color: #fff3cd;
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 class="title">Certificate of Sponsorship</h1>
            <p class="subtitle">${month} - Visa Documentation</p>
        </div>
        
        <div class="content">
            <p>Attached is the certificate number on the .pdf file for the <span class="highlight">${month}</span> show mentioned in the subject. Please tell the artist to print and bring them with you when arriving in the UK.</p>
            
            <div class="important-box">
                <h2 class="important-title">IMPORTANT</h2>
                <p class="important-text">PLEASE MAKE SURE TO HAND YOUR THE ATTACHED DOCUMENTS TO BORDER CONTROL ON ENTERING THE COUNTRY EACH TIME.<br><br>
                <strong style="color: #dc3545;">IF YOU DON'T YOU WILL NOT BE LEGAL TO WORK.</strong></p>
            </div>
            
            <div class="contact-box">
                <h2 class="contact-title">My contact details as your sponsor are:</h2>
                <div class="contact-details">
                    <strong>Alberto Mombelli</strong><br>
                    Orchid AM Limited<br>
                    116 Georgia Avenue<br>
                    Manchester M20 1LX<br>
                    United Kingdom<br>
                    <strong>Tel:</strong> +44 (0) 7775108547
                </div>
            </div>
            
            <p><strong>Re: Immigration Stamp</strong><br>
            I must have a copy of these sent to me after you have arrived in the UK.<br>
            A copy by camera phone and emailed to me at <strong>alberto@orchid-am.com</strong></p>
        </div>
        
        <div class="footer">
            <p>Best regards,<br>
            <strong>Alberto Mombelli</strong></p>
        </div>
    </div>
</body>
</html>`
}

// Helper function to create email in raw format
function createEmailRaw({ subject, to, body, from, inReplyTo, references }) {
  let email = `From: ${from}\r\n`
  email += `To: ${to}\r\n`
  email += `Subject: ${subject}\r\n`
  if (inReplyTo) email += `In-Reply-To: ${inReplyTo}\r\n`
  if (references) email += `References: ${references}\r\n`
  email += `MIME-Version: 1.0\r\n`
  email += `Content-Type: text/html; charset="UTF-8"\r\n`
  email += `Content-Transfer-Encoding: 7bit\r\n\r\n`
  email += `${body}\r\n`
  
  return email
}

// Helper function to create email with attachments in raw format
function createEmailRawWithAttachments({ subject, to, body, from, attachments, inReplyTo, references }) {
  const boundary = 'boundary_' + Math.random().toString(36).substring(2)
  
  let email = `From: ${from}\r\n`
  email += `To: ${to}\r\n`
  email += `Subject: ${subject}\r\n`
  if (inReplyTo) email += `In-Reply-To: ${inReplyTo}\r\n`
  if (references) email += `References: ${references}\r\n`
  email += `MIME-Version: 1.0\r\n`
  email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`
  
  // Add the HTML body
  email += `--${boundary}\r\n`
  email += `Content-Type: text/html; charset="UTF-8"\r\n`
  email += `Content-Transfer-Encoding: 7bit\r\n\r\n`
  email += `${body}\r\n\r\n`
  
  // Add attachments
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      email += `--${boundary}\r\n`
      email += `Content-Type: ${attachment.mimeType || 'application/octet-stream'}\r\n`
      email += `Content-Transfer-Encoding: base64\r\n`
      email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`
      email += `${attachment.data}\r\n\r\n`
    }
  }
  
  email += `--${boundary}--\r\n`
  
  return email
} 