import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'

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

    const { userId } = req.query

    // Mock user data - in production this would come from a database
        const mockUser = {
      userId: userId,
      email: 'tommygra8@gmail.com',
      lastActive: new Date().toISOString(),
      sessionDuration: '0 minutes',
      totalArtists: 0,
      deletedArtists: 0,
      pendingArtists: 0,
      processingArtists: 0,
      approvedArtists: 0,
      artists: []
    }

    res.status(200).json({ user: mockUser })
  } catch (error) {
    console.error('Admin user details API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 