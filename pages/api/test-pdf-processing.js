// pages/api/test-pdf-processing.js
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // First, let's check the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('pdfs')
      .select('*')
      .limit(1)

    if (tableError) {
      console.error('Table structure error:', tableError)
    }

    // Create a test PDF record with all required fields from successful schema
    const { data: pdfRecord, error: insertError } = await supabase
      .from('pdfs')
      .insert({
        filename: 'test-cos-document.pdf',
        mime_type: 'application/pdf',
        size: 1024,
        attachment_id: 'test-attachment-456' // This was the missing required field!
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error details:', insertError)
      return res.status(500).json({ 
        error: 'Failed to create test PDF', 
        details: insertError.message,
        hint: 'Check if pdfs table has the correct columns',
        tableError: tableError?.message
      })
    }

    // Test the OpenAI extraction with mock data
    const mockExtractedText = `
CERTIFICATE OF SPONSORSHIP APPLICATION

Personal Details:
Name: John Michael Smith
Nationality: American
Date of Birth: 15/03/1985
Passport Number: 123456789

Event Details:
Job Title: Touring DJ
Event: London Music Festival
Performance Date: 25/11/2025
Artist Fee: £5000
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract visa information and return only valid JSON array."
        },
        {
          role: "user",
          content: `Extract from: ${mockExtractedText}\n\nReturn only JSON array with extracted data.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    })

    const aiResponse = completion.choices[0].message.content
    let extractedData = []
    
    try {
      // Parse AI response
      let cleanedResponse = aiResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/\s*```$/, '')
      }
      extractedData = JSON.parse(cleanedResponse)
      if (!Array.isArray(extractedData)) {
        extractedData = [extractedData]
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      extractedData = [{ error: 'Failed to parse AI response' }]
    }

    // Update the test PDF record
    const { error: updateError } = await supabase
      .from('pdfs')
      .update({
        extracted_text: mockExtractedText,
        json_output: extractedData,
        processing_status: 'completed'
      })
      .eq('id', pdfRecord.id)

    if (updateError) {
      console.error('Update error:', updateError)
    }

    return res.status(200).json({
      success: true,
      pdfId: pdfRecord.id,
      extractedData,
      message: 'Test PDF processing completed successfully',
      tableError: tableError?.message || 'No table errors'
    })

  } catch (error) {
    console.error('Test PDF processing error:', error)
    return res.status(500).json({ 
      error: 'Test processing failed',
      details: error.message 
    })
  }
}