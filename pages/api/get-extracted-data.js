import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

// In-memory storage for extracted data
let extractedDataStore = []

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      // Return user's extracted data
      const userExtractedData = extractedDataStore.filter(data => data.userId === session.user.email)
      return res.status(200).json({ extractedData: userExtractedData })
    }

    if (req.method === 'POST') {
      // Store new extracted data
      const { extractedData, pdfId, filename } = req.body
      
      const newExtractedData = {
        ...extractedData,
        id: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: session.user.email,
        pdfId,
        filename,
        createdAt: new Date().toISOString()
      }
      
      extractedDataStore.push(newExtractedData)
      console.log('💾 Stored extracted data for:', filename, 'User:', session.user.email)
      
      return res.status(200).json({ success: true, data: newExtractedData })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
    
  } catch (error) {
    console.error('Get extracted data API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Export for other APIs to use
export { extractedDataStore }