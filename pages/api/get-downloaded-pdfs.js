import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

// In-memory storage for REAL downloaded PDFs only
let downloadedPDFs = []

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      // Return user's downloaded PDFs
      const userPDFs = downloadedPDFs.filter(pdf => pdf.userId === session.user.email)
      return res.status(200).json({ pdfs: userPDFs })
    }

    if (req.method === 'POST') {
      // Add new downloaded PDF
      const { filename, size, emailSubject, emailId } = req.body
      
      const newPDF = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename,
        size,
        emailSubject,
        emailId,
        userId: session.user.email,
        downloadedAt: new Date().toISOString(),
        status: 'ready'
      }
      
      downloadedPDFs.push(newPDF)
      console.log('📄 Stored PDF:', filename, 'for user:', session.user.email)
      
      return res.status(200).json({ success: true, pdf: newPDF })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
    
  } catch (error) {
    console.error('Get PDFs API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Export for other APIs to use
export { downloadedPDFs }