// pages/api/debug-session.js
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    console.log('Debug session check:', {
      hasSession: !!session,
      sessionKeys: session ? Object.keys(session) : [],
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        hasImage: !!session.user.image
      } : null,
      hasAccessToken: !!session?.accessToken,
      expires: session?.expires
    })

    res.status(200).json({
      success: true,
      hasSession: !!session,
      session: session ? {
        user: {
          id: session.user?.id,
          email: session.user?.email,
          name: session.user?.name,
          hasImage: !!session.user?.image
        },
        hasAccessToken: !!session.accessToken,
        expires: session.expires
      } : null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Debug session error:', error)
    res.status(500).json({
      error: 'Session debug failed',
      details: error.message
    })
  }
}