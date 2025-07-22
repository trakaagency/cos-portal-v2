// pages/api/test-db.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    console.log('Testing Supabase connection...')
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1)

    if (testError) {
      console.error('Supabase connection error:', testError)
      return res.status(500).json({
        error: 'Database connection failed',
        details: testError.message,
        code: testError.code
      })
    }

    // Test user table structure
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (usersError) {
      console.error('Users table error:', usersError)
      return res.status(500).json({
        error: 'Users table access failed',
        details: usersError.message
      })
    }

    // Test creating a sample user (then delete it)
    const testUserId = 'test_user_' + Date.now()
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (createError) {
      console.error('User creation test failed:', createError)
      return res.status(500).json({
        error: 'User creation failed',
        details: createError.message,
        hint: createError.hint
      })
    }

    // Clean up test user
    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId)

    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      userCount: testData?.[0]?.count || 0,
      testUserCreated: !!newUser
    })
  } catch (error) {
    console.error('Test DB error:', error)
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    })
  }
}