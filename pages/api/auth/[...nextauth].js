import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account) {
        console.log('🔑 JWT: New tokens received')
        console.log('🔑 JWT: Has access token:', !!account.access_token)
        console.log('🔑 JWT: Has refresh token:', !!account.refresh_token)
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        console.log('🔑 JWT: Access token expires at:', new Date(account.expires_at * 1000))
      }

      // Token refresh logic
      if (Date.now() < token.expiresAt * 1000) {
        console.log('🔑 JWT: Token still valid')
        return token
      }

      console.log('🔄 JWT: Token expired, attempting refresh...')
      return await refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.expiresAt = token.expiresAt
      session.error = token.error
      
      console.log('📱 SESSION - User:', session.user.email, 'Token valid:', !token.error)
      console.log('📱 SESSION - Has access token:', !!token.accessToken)
      console.log('📱 SESSION - Has refresh token:', !!token.refreshToken)
      
      return session
    },
    async signIn({ user, account, profile }) {
      if (account.provider === 'google') {
        console.log('✅ Sign in: Gmail scope granted:', account.scope?.includes('gmail'))
        
        try {
          const { data, error } = await supabase
            .from('users')
            .upsert({
              email: user.email,
              name: user.name,
              avatar_url: user.image,
              updated_at: new Date().toISOString(),
            })
            .select()

          if (error) {
            console.error('Supabase upsert error:', error)
          } else {
            user.id = data[0].id
            console.log('✅ User stored in Supabase:', user.email)
          }
        } catch (err) {
          console.error('Sign in error:', err)
        }
      }
      return true
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Token refresh function
async function refreshAccessToken(token) {
  try {
    console.log('🔄 Refreshing access token...')
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
      method: 'POST',
    })

    const tokens = await response.json()

    if (!response.ok) {
      console.error('❌ Token refresh failed:', tokens)
      throw tokens
    }

    console.log('✅ Token refreshed successfully')
    
    return {
      ...token,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
      refreshToken: tokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('❌ Token refresh error:', error)

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export default NextAuth(authOptions)