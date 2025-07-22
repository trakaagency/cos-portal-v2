import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check if user is admin (you can modify this logic)
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user.email !== 'trakaagency@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Get all localStorage data from all users
    // Since we're using localStorage, we'll need to track this differently
    // For now, let's create a simple tracking system
    
    const users = []
    
    // Get all artist data from localStorage (this would need to be stored server-side in production)
    // For now, we'll simulate the data structure
    
    // In a real implementation, you'd store this in a database
    // For now, we'll return mock data to demonstrate the structure
    
    const mockUsers = []

    res.status(200).json({ users: mockUsers })
  } catch (error) {
    console.error('Admin API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 