// pages/api/extract-word-document.js
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import mammoth from 'mammoth'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
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

    const { emailId, attachmentId, filename, base64Data } = req.body

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' })
    }

    console.log(`Processing Word document: ${filename}`)

    let wordBuffer
    if (base64Data) {
      // Handle base64 data directly
      wordBuffer = Buffer.from(base64Data, 'base64')
    } else if (emailId && attachmentId) {
      // Get from Gmail
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
      wordBuffer = Buffer.from(attachmentData.data, 'base64url')
    } else {
      return res.status(400).json({ error: 'Missing required data' })
    }

    console.log(`Downloaded Word document: ${filename}, size: ${wordBuffer.length} bytes`)

    // Extract text from Word document
    let extractedText = ''
    try {
      const result = await mammoth.extractRawText({ buffer: wordBuffer })
      extractedText = result.value
      
      if (result.messages.length > 0) {
        console.log('Word document processing warnings:', result.messages)
      }
    } catch (error) {
      console.error('Error extracting text from Word document:', error)
      return res.status(500).json({ 
        error: 'Failed to extract text from Word document',
        details: error.message 
      })
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from Word document' })
    }

    console.log(`Extracted ${extractedText.length} characters from Word document`)

    // Convert Word document to PDF
    let pdfBuffer
    try {
      pdfBuffer = await convertWordToPDF(wordBuffer, filename)
      console.log(`Converted Word document to PDF, size: ${pdfBuffer.length} bytes`)
    } catch (error) {
      console.error('Error converting Word to PDF:', error)
      // Continue without PDF conversion, just use the extracted text
      pdfBuffer = null
    }

    // Store in database
    const { data: pdfRecord, error: pdfError } = await supabase
      .from('pdfs')
      .insert({
        user_id: session.user.id,
        email_id: emailId,
        filename: filename.replace(/\.(doc|docx)$/i, '.pdf'),
        extracted_text: extractedText,
        file_size: pdfBuffer ? pdfBuffer.length : wordBuffer.length,
        mime_type: 'application/pdf',
        status: 'processing',
        attachment_id: attachmentId,
        file_data: pdfBuffer ? pdfBuffer.toString('base64') : null,
        original_mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      .select()
      .single()

    if (pdfError) {
      console.error('Database error:', pdfError)
      return res.status(500).json({ error: 'Failed to save document data' })
    }

    // Extract structured data using AI
    const structuredData = await extractWithAI(extractedText, filename)

    // Update the record with extracted data
    await supabase
      .from('pdfs')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', pdfRecord.id)

    return res.status(200).json({
      success: true,
      pdfId: pdfRecord.id,
      filename: pdfRecord.filename,
      extractedText: extractedText.substring(0, 500) + '...',
      structuredData
    })

  } catch (error) {
    console.error('Error in extract-word-document:', error)
    return res.status(500).json({ 
      error: 'Failed to process Word document',
      details: error.message 
    })
  }
}

async function convertWordToPDF(wordBuffer, filename) {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    // Extract text from Word document
    const result = await mammoth.extractRawText({ buffer: wordBuffer })
    const text = result.value
    
    // Split text into lines and add to PDF
    const lines = text.split('\n')
    const fontSize = 12
    const lineHeight = fontSize * 1.2
    const margin = 50
    let y = page.getHeight() - margin
    
    for (const line of lines) {
      if (y < margin) {
        // Add new page if needed
        page = pdfDoc.addPage()
        y = page.getHeight() - margin
      }
      
      page.drawText(line.trim(), {
        x: margin,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0)
      })
      
      y -= lineHeight
    }
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
    
  } catch (error) {
    console.error('Error converting Word to PDF:', error)
    throw error
  }
}

async function extractWithAI(text, filename) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Extract data from this document and return ONLY valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: `Extract data from this Word document and return JSON with these fields:
          
{
  "familyName": "",
  "givenName": "",
  "otherNames": "",
  "nationality": "",
  "placeOfBirth": "",
  "countryOfBirth": "",
  "birthDay": "",
  "birthMonth": "",
  "birthYear": "",
  "sex": "",
  "countryOfResidence": "",
  "passportNumber": "",
  "passportIssueDay": "",
  "passportIssueMonth": "",
  "passportIssueYear": "",
  "passportExpiryDay": "",
  "passportExpiryMonth": "",
  "passportExpiryYear": "",
  "placeOfIssueOfPassport": "",
  "address": "",
  "addressLine2": "",
  "addressLine3": "",
  "city": "",
  "county": "",
  "postcode": "",
  "country": "",
  "ukIdCardNumber": "",
  "ukNationalInsuranceNumber": "",
  "nationalIdCardNumber": "",
  "employeeNumber": "",
  "showDateStartDay": "",
  "showDateStartMonth": "",
  "showDateStartYear": "",
  "showDateEndDay": "",
  "showDateEndMonth": "",
  "showDateEndYear": "",
  "doesMigrantNeedToLeaveAndReenter": "Y",
  "totalWeeklyHours": "",
  "addPWSAddress": "",
  "addWSAddress": "",
  "jobTitle": "",
  "jobType": "X3145",
  "summaryOfJobDescription": "",
  "forEach": "PERF",
  "grossSalary": 0,
  "grossAllowances": "",
  "allowanceDetails": "",
  "creativeCodeCompliance": "Creative Sector - Live Music - No Code of Conduct",
  "certifyMaintenance": "Y"
}

Document content: ${text}

Return only the JSON object.`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const result = response.choices[0].message.content.trim()
    
    // Clean and parse JSON
    let cleanJson = result.replace(/```json/g, '').replace(/```/g, '')
    cleanJson = cleanJson.replace(/^[^{]*/, '').replace(/[^}]*$/, '')
    
    try {
      return JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw AI response:', result)
      throw new Error('Failed to parse AI response as JSON')
    }
    
  } catch (error) {
    console.error('AI extraction error:', error)
    throw error
  }
} 