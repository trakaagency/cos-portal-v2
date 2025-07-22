// pages/api/minimal-insert-test.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const tests = []

  // Test 1: Minimal required fields based on your schema
  try {
    const { data: test1, error: error1 } = await supabase
      .from('pdfs')
      .insert({
        filename: 'test1.pdf',
        mime_type: 'application/pdf',
        size: 1024
      })
      .select()
      .single()

    tests.push({
      test: 'Test 1 - filename, mime_type, size',
      success: !error1,
      error: error1?.message,
      data: test1
    })
  } catch (e) {
    tests.push({
      test: 'Test 1 - filename, mime_type, size',
      success: false,
      error: e.message
    })
  }

  // Test 2: Add email_id as UUID
  try {
    const { data: test2, error: error2 } = await supabase
      .from('pdfs')
      .insert({
        email_id: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'test2.pdf',
        mime_type: 'application/pdf',
        size: 1024
      })
      .select()
      .single()

    tests.push({
      test: 'Test 2 - with email_id UUID',
      success: !error2,
      error: error2?.message,
      data: test2
    })
  } catch (e) {
    tests.push({
      test: 'Test 2 - with email_id UUID',
      success: false,
      error: e.message
    })
  }

  // Test 3: Add attachment_id
  try {
    const { data: test3, error: error3 } = await supabase
      .from('pdfs')
      .insert({
        email_id: '550e8400-e29b-41d4-a716-446655440001',
        filename: 'test3.pdf',
        mime_type: 'application/pdf',
        size: 1024,
        attachment_id: 'test-attachment-123'
      })
      .select()
      .single()

    tests.push({
      test: 'Test 3 - with attachment_id',
      success: !error3,
      error: error3?.message,
      data: test3
    })
  } catch (e) {
    tests.push({
      test: 'Test 3 - with attachment_id',
      success: false,
      error: e.message
    })
  }

  // Find which test succeeded
  const successfulTest = tests.find(t => t.success)

  return res.status(200).json({
    tests,
    successfulTest,
    message: successfulTest ? 'Found working combination!' : 'All tests failed'
  })
}