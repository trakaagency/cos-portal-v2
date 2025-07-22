// pages/api/debug-db.js
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userId = session.user.id

    // Check what's in the database
    console.log('Checking database for user:', userId)

    // Check users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    // Check emails table
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Check applications table
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Check pdfs table
    const { data: pdfs, error: pdfsError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    res.status(200).json({
      success: true,
      user_id: userId,
      database_status: {
        user: {
          found: !!user,
          error: userError?.message,
          data: user ? {
            id: user.id,
            email: user.email,
            name: user.name,
            has_gmail_token: !!user.gmail_token,
            created_at: user.created_at
          } : null
        },
        emails: {
          count: emails?.length || 0,
          error: emailsError?.message,
          sample: emails?.slice(0, 2).map(email => ({
            id: email.id,
            gmail_id: email.gmail_id,
            subject: email.subject,
            sender: email.sender,
            has_attachment: email.has_attachment,
            created_at: email.created_at
          }))
        },
        applications: {
          count: applications?.length || 0,
          error: appsError?.message,
          sample: applications?.slice(0, 2)
        },
        pdfs: {
          count: pdfs?.length || 0,
          error: pdfsError?.message,
          sample: pdfs?.slice(0, 2)
        }
      },
      session_info: {
        user_id: session.user.id,
        email: session.user.email,
        has_access_token: !!session.accessToken
      }
    })

  } catch (error) {
    console.error('Debug DB error:', error)
    res.status(500).json({
      error: 'Debug failed',
      details: error.message
    })
  }
}