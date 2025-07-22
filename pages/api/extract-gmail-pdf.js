// pages/api/extract-gmail-pdf.js
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'
import pdf from 'pdf-parse'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { emailId, attachmentId, filename } = req.body

    if (!emailId || !attachmentId) {
      return res.status(400).json({ error: 'Email ID and attachment ID are required' })
    }

    console.log(`Processing Gmail attachment: ${filename} from email: ${emailId}`)

    // Get the Gmail message and attachment
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!messageResponse.ok) {
      throw new Error('Failed to fetch Gmail message')
    }

    // Get the attachment data
    const attachmentResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/attachments/${attachmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!attachmentResponse.ok) {
      throw new Error('Failed to fetch Gmail attachment')
    }

    const attachmentData = await attachmentResponse.json()
    
    // Decode the base64 attachment data
    const pdfBuffer = Buffer.from(attachmentData.data, 'base64url')
    
    console.log(`Downloaded PDF: ${filename}, size: ${pdfBuffer.length} bytes`)

    // Extract text from PDF
    const pdfData = await pdf(pdfBuffer)
    const extractedText = pdfData.text

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from PDF' })
    }

    console.log(`Extracted ${extractedText.length} characters from PDF`)

    // Store PDF in database
    const { data: pdfRecord, error: pdfError } = await supabase
      .from('pdfs')
      .insert({
        user_id: session.user.id,
        email_id: emailId,
        filename: filename || 'gmail_attachment.pdf',
        extracted_text: extractedText,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        status: 'processing',
        attachment_id: attachmentId
      })
      .select()
      .single()

    if (pdfError) {
      console.error('Database error:', pdfError)
      return res.status(500).json({ error: 'Failed to save PDF data' })
    }

    // Create structured prompt for OpenAI
    const prompt = `
You are an AI assistant specialized in extracting structured data from Certificate of Sponsorship (CoS) and visa application documents.

Please analyze the following document text and extract key information into a structured JSON format.

Extract the following fields:
- applicant_name: Full name of the visa applicant
- passport_number: Passport number if mentioned
- nationality: Country of nationality
- date_of_birth: Date of birth if mentioned
- event_name: Name of the event or performance
- event_dates: Start and end dates of the event
- venue_name: Name of the venue
- venue_address: Full address of the venue
- sponsor_name: Name of the sponsoring organization
- cos_number: Certificate of Sponsorship number if mentioned
- visa_type: Type of visa (e.g., Tier 5, Creative Worker, etc.)
- application_date: Date of application
- urgency: Any mentions of urgency or deadlines

Document text:
${extractedText}

Please respond with ONLY a valid JSON object containing the extracted data. Use null for any fields that cannot be found.
`

    try {
      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a data extraction specialist. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })

      const aiResponse = completion.choices[0]?.message?.content
      let extractedData

      try {
        // Parse AI response as JSON
        extractedData = JSON.parse(aiResponse)
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError)
        extractedData = { error: 'Could not parse extracted data', raw_response: aiResponse }
      }

      // Update PDF record with extracted data
      const { error: updateError } = await supabase
        .from('pdfs')
        .update({
          json_output: extractedData,
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', pdfRecord.id)

      if (updateError) {
        console.error('Failed to update PDF record:', updateError)
      }

      // Create application record if extraction was successful
      if (!extractedData.error && extractedData.applicant_name) {
        const { error: appError } = await supabase
          .from('applications')
          .insert({
            user_id: session.user.id,
            email_id: emailId,
            pdf_id: pdfRecord.id,
            artist_names: extractedData.applicant_name,
            event_title: extractedData.event_name,
            venue: extractedData.venue_name,
            status: 'extracted',
            extracted_data: extractedData,
            created_at: new Date().toISOString()
          })

        if (appError) {
          console.error('Failed to create application record:', appError)
        }
      }

      // Return the extracted data
      res.status(200).json({
        success: true,
        pdf_id: pdfRecord.id,
        extracted_data: extractedData,
        original_filename: filename,
        text_length: extractedText.length,
        email_id: emailId,
        attachment_id: attachmentId
      })

    } catch (aiError) {
      console.error('OpenAI API error:', aiError)
      
      // Update PDF status to failed
      await supabase
        .from('pdfs')
        .update({ status: 'failed', error_message: aiError.message })
        .eq('id', pdfRecord.id)

      res.status(500).json({ 
        error: 'AI extraction failed', 
        details: aiError.message 
      })
    }

  } catch (error) {
    console.error('Gmail PDF extraction error:', error)
    res.status(500).json({ 
      error: 'PDF extraction failed', 
      details: error.message 
    })
  }
}