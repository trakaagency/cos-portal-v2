import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { google } from 'googleapis'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get the user session
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      return res.status(401).json({ 
        error: 'No session found',
        authenticated: false 
      })
    }

    if (!session.accessToken) {
      return res.status(401).json({ 
        error: 'No access token found',
        authenticated: false,
        user: session.user?.email 
      })
    }

    // Set up Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })

    // Test token validity
    try {
      const tokenInfo = await oauth2Client.getAccessToken()
      console.log('✅ Token is valid')
      
      // Test Gmail API access
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      const profile = await gmail.users.getProfile({ userId: 'me' })
      
      return res.status(200).json({
        authenticated: true,
        user: session.user?.email,
        tokenValid: true,
        gmailAccess: true,
        profile: profile.data,
        scopes: session.accessToken ? 'Gmail access granted' : 'No Gmail scopes'
      })
      
    } catch (tokenError) {
      console.error('❌ Token validation failed:', tokenError.message)
      
      return res.status(401).json({
        authenticated: true,
        user: session.user?.email,
        tokenValid: false,
        gmailAccess: false,
        error: tokenError.message,
        code: 'TOKEN_VALIDATION_ERROR'
      })
    }

  } catch (error) {
    console.error('Test auth error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
} 