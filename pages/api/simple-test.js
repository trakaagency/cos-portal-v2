// pages/api/simple-test.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    console.log('Testing simple PDF insert...')

    // Insert with EXACT columns from your schema
    const { data: pdfRecord, error: insertError } = await supabase
      .from('pdfs')
      .insert({
        filename: 'test-document.pdf',
        mime_type: 'application/pdf',
        size: 1024,
        attachment_id: 'test-attachment-123'
        // Note: id will be auto-generated
        // Note: NOT including email_id since it's not visible in your schema
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return res.status(500).json({ 
        error: 'Insert failed', 
        details: insertError.message,
        code: insertError.code
      })
    }

    console.log('PDF inserted successfully:', pdfRecord)

    // Test update with additional fields
    const { error: updateError } = await supabase
      .from('pdfs')
      .update({
        // Add any other fields that might exist
        file_data: 'base64-encoded-pdf-data-here',
        extracted_text: 'Sample extracted text from PDF',
        json_output: [{"familyName": "Test", "givenName": "User"}],
        processing_status: 'completed'
      })
      .eq('id', pdfRecord.id)

    if (updateError) {
      console.log('Update failed (some columns might not exist):', updateError.message)
    } else {
      console.log('Update successful')
    }

    return res.status(200).json({
      success: true,
      pdfId: pdfRecord.id,
      inserted: pdfRecord,
      updateError: updateError?.message || null,
      message: 'PDF successfully stored in database'
    })

  } catch (error) {
    console.error('Simple test error:', error)
    return res.status(500).json({ 
      error: 'Test failed',
      details: error.message 
    })
  }
}