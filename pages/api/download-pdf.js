// pages/api/download-pdf.js
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { emailId, attachmentId, filename } = req.body

    if (!emailId || !attachmentId || !filename) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    console.log('Downloading PDF:', { emailId, attachmentId, filename })

    // Get the user session
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.accessToken) {
      console.error('No session or access token found')
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Set up Gmail API with OAuth2
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Download attachment directly from Gmail using the message ID
    console.log('Downloading attachment from Gmail...')
    let attachmentData
    try {
      attachmentData = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: emailId, // emailId is actually the Gmail message ID
        id: attachmentId,
      })

      console.log('Attachment downloaded successfully, size:', attachmentData.data.size)
    } catch (gmailError) {
      console.error('Gmail API error:', gmailError)
      return res.status(500).json({ 
        error: 'Failed to download attachment from Gmail',
        details: gmailError.message 
      })
    }

    // Decode base64 data
    const pdfBuffer = Buffer.from(attachmentData.data.data, 'base64')

    // Store PDF record in database with base64 data
    const { data: pdfRecord, error: dbError } = await supabase
      .from('pdfs')
      .insert({
        filename: filename,
        mime_type: 'application/pdf',
        size: pdfBuffer.length,
        attachment_id: attachmentId,
        file_data: attachmentData.data.data, // Store base64 data directly
        processing_status: 'COMPLETED'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return res.status(500).json({ error: 'Failed to save PDF record', details: dbError.message })
    }

    console.log('PDF downloaded and stored successfully:', pdfRecord.id)

    // Return success response
    res.status(200).json({
      success: true,
      pdfId: pdfRecord.id,
      filename: filename
    })

  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}