import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions)
    if (!session?.accessToken) {
      console.error('No session or access token found')
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { emailId, attachmentId, filename } = req.body

    if (!emailId || !attachmentId || !filename) {
      return res.status(400).json({ error: 'Email ID, attachment ID, and filename are required' })
    }

    console.log(`Downloading attachment: ${filename} from email: ${emailId}`)

    // Get the attachment data from Gmail
    const attachmentResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/attachments/${attachmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!attachmentResponse.ok) {
      console.error('Failed to fetch attachment from Gmail:', attachmentResponse.status)
      return res.status(500).json({ error: 'Failed to fetch attachment from Gmail' })
    }

    const attachmentData = await attachmentResponse.json()
    
    if (!attachmentData.data) {
      return res.status(404).json({ error: 'Attachment data not found' })
    }

    // Decode the attachment data
    const fileBuffer = Buffer.from(attachmentData.data, 'base64')

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', fileBuffer.length)

    // Send the file
    res.send(fileBuffer)

  } catch (error) {
    console.error('Error downloading attachment:', error)
    return res.status(500).json({ 
      error: 'Failed to download attachment',
      details: error.message 
    })
  }
}