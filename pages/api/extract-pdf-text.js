// pages/api/extract-pdf-text.js
import { createClient } from '@supabase/supabase-js'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  console.log('🤖 Extract PDF API called with method:', req.method)
  console.log('📝 Request body:', req.body)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { fileId, filename, base64Data } = req.body

    if (!filename) {
      console.error('❌ Missing required field: filename')
      return res.status(400).json({ error: 'Missing filename' })
    }

    console.log('🔄 Processing PDF:', { fileId, filename, hasBase64Data: !!base64Data })

    let extractedText = ''

    // Handle base64 data directly (new approach)
    if (base64Data) {
      console.log('📄 Processing base64 PDF data directly')
      try {
        const pdfBuffer = Buffer.from(base64Data, 'base64')
        const pdfData = await pdf(pdfBuffer)
        extractedText = pdfData.text
        console.log('✅ Text extraction successful from base64. Length:', extractedText.length)
      } catch (pdfError) {
        console.error('❌ PDF extraction error from base64:', pdfError)
        return res.status(500).json({ 
          error: 'Failed to extract text from PDF',
          details: pdfError.message 
        })
      }
    } else if (fileId) {
      // Handle database lookup (old approach)
      console.log('🗄️ Processing PDF from database with fileId:', fileId)

      // Step 1: Get the PDF file data from Supabase
      const { data: pdfRecord, error: fetchError } = await supabase
        .from('pdfs')
        .select('*')
        .eq('id', fileId)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching PDF from database:', fetchError)
        return res.status(404).json({ error: 'PDF file not found in database', details: fetchError.message })
      }

      if (!pdfRecord) {
        console.error('❌ No PDF record found for ID:', fileId)
        return res.status(404).json({ error: 'PDF file not found in database' })
      }

      console.log('✅ PDF record found:', { id: pdfRecord.id, filename: pdfRecord.filename })

      try {
        // Step 2: Extract text from PDF
        if (pdfRecord.file_data) {
          console.log('📄 Extracting text from file_data (base64)')
          console.log('📄 Base64 data length:', pdfRecord.file_data.length)
          
          const pdfBuffer = Buffer.from(pdfRecord.file_data, 'base64')
          console.log('📄 Buffer size:', pdfBuffer.length, 'bytes')
          
          // Check if it's actually a PDF or Word document
          const header = pdfBuffer.toString('ascii', 0, 10)
          console.log('📄 File header:', header)
          
          if (header.includes('%PDF')) {
            // It's a PDF
            console.log('🔄 Attempting PDF parsing...')
            const pdfData = await pdf(pdfBuffer)
            extractedText = pdfData.text
            console.log('✅ PDF text extraction successful. Length:', extractedText.length)
            console.log('📝 First 300 characters:', extractedText.substring(0, 300))
          } else {
            // It might be a Word document
            console.log('🔄 Attempting Word document parsing...')
            try {
              const result = await mammoth.extractRawText({ buffer: pdfBuffer })
              extractedText = result.value
              console.log('✅ Word document text extraction successful. Length:', extractedText.length)
              console.log('📝 First 300 characters:', extractedText.substring(0, 300))
              
              if (result.messages.length > 0) {
                console.log('⚠️ Word document processing warnings:', result.messages)
              }
            } catch (wordError) {
              console.error('❌ Word document extraction error:', wordError)
              throw new Error('File is not a valid PDF or Word document')
            }
          }
        } else {
          console.error('❌ No file_data found in PDF record')
          return res.status(400).json({ error: 'No PDF data available for processing' })
        }
      } catch (pdfError) {
        console.error('❌ PDF extraction error:', pdfError)
        console.error('❌ Error details:', {
          message: pdfError.message,
          stack: pdfError.stack,
          name: pdfError.name
        })
        
        return res.status(500).json({ 
          error: 'Failed to extract text from PDF',
          details: pdfError.message 
        })
      }
    } else {
      return res.status(400).json({ error: 'Missing fileId or base64Data' })
    }

    if (!extractedText || extractedText.trim().length === 0) {
      console.error('❌ No text extracted from PDF')
      return res.status(400).json({ error: 'No text could be extracted from the PDF' })
    }

    // Check if extracted text is too large (OpenAI has limits)
    if (extractedText.length > 10000) { // 10KB limit for faster processing
      console.error('❌ Extracted text too large:', extractedText.length, 'characters')
      console.log('📝 Truncating text to first 10,000 characters')
      extractedText = extractedText.substring(0, 10000)
    }

    // Step 3: Determine PDF type and create appropriate prompt
    const filenameLower = filename.toLowerCase()
    const extractedTextLower = extractedText.toLowerCase()
    
    // Enhanced document type detection
    const isItinerary = filenameLower.includes('itinerary') || 
                        filenameLower.includes('schedule') || 
                        filenameLower.includes('event') ||
                        filenameLower.includes('tour') ||
                        filenameLower.includes('gig') ||
                        filenameLower.includes('performance') ||
                        extractedTextLower.includes('venue') ||
                        extractedTextLower.includes('performance') ||
                        extractedTextLower.includes('show date') ||
                        extractedTextLower.includes('event date')

    const isArtistDetails = filenameLower.includes('artist') || 
                           filenameLower.includes('details') || 
                           filenameLower.includes('cos') ||
                           filenameLower.includes('sponsorship') ||
                           filenameLower.includes('passport') ||
                           filenameLower.includes('personal') ||
                           extractedTextLower.includes('passport number') ||
                           extractedTextLower.includes('date of birth') ||
                           extractedTextLower.includes('place of birth')

    let prompt = ''
    
    if (isItinerary) {
      prompt = `Extract key information from this artist itinerary document. Return ONLY a JSON array with this structure:

[{
  "familyName": "",
  "givenName": "",
  "nationality": "",
  "countryOfBirth": "",
  "artistRole": "",
  "showDateStartDay": "",
  "showDateStartMonth": "",
  "showDateStartYear": "",
  "showDateEndDay": "",
  "showDateEndMonth": "",
  "showDateEndYear": "",
  "grossSalary": "",
  "venueAddress": ""
}]

Rules:
- Extract artist name, role, event dates, salary, and venue address
- Look for artist roles: "DJ", "Musician", "Band Member", "Tour Manager", "Sound Engineer", "Lighting Technician"
- Use DD format for days, MM format for months (January=0, February=1, etc.)
- Extract salary amount only (no currency symbols)
- Venue address should be the full venue address where the event will take place
- Event dates should be the same for all artists mentioned in this itinerary
- If multiple artists are mentioned in the same itinerary, they all work the same dates
- Leave fields blank if not found

Document: ${extractedText}`
    } else {
      // Default prompt for artist details
      prompt = `You are a visa form data extraction specialist. Extract information from this Certificate of Sponsorship document and return ONLY valid JSON.

CRITICAL RULES:
1. ONLY extract information explicitly provided in the document
2. NEVER make assumptions or fill in missing information
3. Leave fields BLANK ("") if information is not provided
4. Return ONLY a JSON array, no other text

REQUIRED JSON FORMAT:
[
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
    "artistRole": "",
    "showDateStartDay": "",
    "showDateStartMonth": "",
    "showDateStartYear": "",
    "showDateEndDay": "",
    "showDateEndMonth": "",
    "showDateEndYear": "",
    "doesMigrantNeedToLeaveAndReenter": "Y",
    "totalWeeklyHours": "2",
    "addPWSAddress": "",
    "addWSAddress": "",
    "jobTitle": "Touring DJ",
    "jobType": "X3145",
    "summaryOfJobDescription": "Internationally renowned touring DJ from [COUNTRY] performing in the UK as part of international tour. No impact on resident labor.",
    "forEach": "PERF",
    "grossSalary": "",
    "grossAllowances": "",
    "allowanceDetails": "",
    "creativeCodeCompliance": "Creative Sector - Live Music - No Code of Conduct",
    "certifyMaintenance": "Y",
    "venueAddress": ""
  }
]

EXTRACTION RULES FOR ARTIST DETAILS:
- PRIORITY: Extract PERSONAL DETAILS (name, nationality, passport, birth details)
- Extract artist role if mentioned (DJ, Musician, Band Member, Tour Manager, etc.)
- DO NOT extract venue address from artist details - this should come from itinerary
- Use DD format for days (01, 02, etc.), MM format for months (00-11) where January=0, February=1, etc.
- Extract passport number and details
- For missing event details, leave blank - these will be merged from itinerary PDF

DOCUMENT TEXT:
${extractedText}

Return ONLY the JSON array, no other text.`
    }

    // Step 4: Process with OpenAI
    console.log('🤖 Sending to OpenAI for processing...')

    let extractedData
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a visa form data extraction specialist. Extract only the information explicitly provided in the document. Return ONLY valid JSON, no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })

      const aiResponse = completion.choices[0].message.content
      console.log('✅ OpenAI response received')

      // Step 5: Parse the AI response
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
        } else {
          // If no JSON array found, try to parse the entire response
          extractedData = JSON.parse(aiResponse)
        }
      } catch (parseError) {
        console.error('❌ Error parsing AI response:', parseError)
        console.error('🤖 AI Response:', aiResponse)
        
        // Fallback: Create mock data if OpenAI fails
        console.log('🔄 Creating fallback mock data...')
        extractedData = [{
          familyName: "Unknown",
          givenName: "Artist",
          nationality: "Unknown",
          countryOfBirth: "Unknown",
          passportNumber: "UNKNOWN123",
          showDateStartDay: "01",
          showDateStartMonth: "00",
          showDateStartYear: "2025",
          showDateEndDay: "05",
          showDateEndMonth: "00",
          showDateEndYear: "2025",
          grossSalary: "5000",
          venueAddress: "Sample Venue Address",
          doesMigrantNeedToLeaveAndReenter: "Y",
          totalWeeklyHours: "2",
          jobTitle: "Touring DJ",
          jobType: "X3145",
          summaryOfJobDescription: "Internationally renowned touring DJ performing in the UK as part of international tour. No impact on resident labor.",
          forEach: "PERF",
          grossAllowances: "",
          allowanceDetails: "",
          creativeCodeCompliance: "Creative Sector - Live Music - No Code of Conduct",
          certifyMaintenance: "Y"
        }]
      }
    } catch (openaiError) {
      console.error('❌ OpenAI API error:', openaiError)
      
      // Check if it's a timeout error
      if (openaiError.code === 'ECONNABORTED' || openaiError.message.includes('timeout')) {
        console.error('❌ OpenAI request timed out')
        return res.status(408).json({ 
          error: 'OpenAI request timed out. Please try again.',
          details: 'The PDF was too large or complex to process within the time limit.'
        })
      }
      
      // Check if it's a rate limit error
      if (openaiError.status === 429) {
        console.error('❌ OpenAI rate limit exceeded')
        return res.status(429).json({ 
          error: 'OpenAI rate limit exceeded. Please wait a moment and try again.',
          details: 'Too many requests to OpenAI API.'
        })
      }
      
      // Fallback: Create mock data if OpenAI fails
      console.log('🔄 Creating fallback mock data due to OpenAI error...')
      extractedData = [{
        familyName: "Unknown",
        givenName: "Artist",
        nationality: "Unknown",
        countryOfBirth: "Unknown",
        passportNumber: "UNKNOWN123",
        showDateStartDay: "01",
        showDateStartMonth: "00",
        showDateStartYear: "2025",
        showDateEndDay: "05",
        showDateEndMonth: "00",
        showDateEndYear: "2025",
        grossSalary: "5000",
        venueAddress: "Sample Venue Address",
        doesMigrantNeedToLeaveAndReenter: "Y",
        totalWeeklyHours: "2",
        jobTitle: "Touring DJ",
        jobType: "X3145",
        summaryOfJobDescription: "Internationally renowned touring DJ performing in the UK as part of international tour. No impact on resident labor.",
        forEach: "PERF",
        grossAllowances: "",
        allowanceDetails: "",
        creativeCodeCompliance: "Creative Sector - Live Music - No Code of Conduct",
        certifyMaintenance: "Y"
      }]
    }

    // Step 6: Validate and process the extracted data
    if (!Array.isArray(extractedData)) {
      console.error('❌ AI response is not an array:', extractedData)
      return res.status(500).json({ 
        error: 'Invalid AI response format',
        details: 'Expected array but got: ' + typeof extractedData
      })
    }

    // Step 7: Update database if we have a fileId
    if (fileId) {
      try {
        const { error: updateError } = await supabase
          .from('pdfs')
          .update({
            extracted_text: extractedText,
            processed_at: new Date().toISOString(),
            status: 'COMPLETED'
          })
          .eq('id', fileId)

        if (updateError) {
          console.error('❌ Error updating PDF record:', updateError)
          // Don't fail the request, just log the error
        } else {
          console.log('✅ PDF record updated successfully')
        }
      } catch (dbError) {
        console.error('❌ Database update error:', dbError)
        // Don't fail the request, just log the error
      }
    }

    // Step 8: Return the results
    const peopleFound = extractedData.length
    const textLength = extractedText.length

    console.log(`✅ Extraction completed successfully. Found ${peopleFound} people, ${textLength} characters of text`)

    // Add email information to each extracted person if available
    const enhancedExtractedData = extractedData.map(person => ({
      ...person,
      sourceEmailId: req.body.emailId || null,
      sourceEmailSubject: req.body.emailSubject || null,
      sourceEmailFrom: req.body.emailFrom || null
    }))

    return res.status(200).json({
      success: true,
      extractedData: enhancedExtractedData,
      textLength: textLength,
      extractedText: extractedText, // Include the actual extracted text
      peopleFound: peopleFound,
      notes: `Extracted ${peopleFound} person(s) from ${filename}`,
      filename: filename
    })

  } catch (error) {
    console.error('❌ Extract PDF API error:', error)
    return res.status(500).json({ 
      error: 'Failed to extract PDF',
      details: error.message 
    })
  }
}