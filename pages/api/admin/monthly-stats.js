import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check if user is admin
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user.email !== 'trakaagency@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Mock monthly stats data - in production this would come from a database
    const mockMonthlyStats = []

    res.status(200).json({ monthlyStats: mockMonthlyStats })
  } catch (error) {
    console.error('Monthly stats API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 