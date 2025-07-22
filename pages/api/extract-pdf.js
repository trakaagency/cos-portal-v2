import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req, res) {
  console.log('🤖 EXTRACT PDF API - Method:', req.method)
  
  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
      const { filename, data, emailId, emailSubject } = req.body
      
      if (!filename || !data) {
        return res.status(400).json({ error: 'Missing filename or data' })
      }

      console.log('🔄 Processing PDF:', filename, 'from email:', emailSubject)

      try {
        // TODO: Here you would integrate with OpenAI API for real extraction
        // For now, return mock extracted data
        
        const mockExtractedData = {
          artist_name: extractArtistName(filename, emailSubject),
          passport_number: generateMockPassport(),
          nationality: "British",
          date_of_birth: "1990-05-15",
          event_name: extractEventName(emailSubject),
          venue: "O2 Arena",
          start_date: "2025-09-01",
          end_date: "2025-09-05",
          sponsor_name: "Traka Agency",
          cos_reference: `COS${Date.now()}`,
          extracted_from: filename,
          email_source: emailSubject
        }

        console.log('✅ AI Extraction completed for:', filename)
        
        // Store in database (you could add this)
        // await storeExtractedData(mockExtractedData, emailId, filename)
        
        return res.status(200).json({
          success: true,
          filename,
          extractedData: mockExtractedData,
          message: 'PDF processing completed successfully'
        })

      } catch (extractionError) {
        console.error('❌ PDF extraction error:', extractionError)
        return res.status(500).json({ 
          success: false,
          error: 'PDF extraction failed',
          details: extractionError.message 
        })
      }
    }

    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: `Method ${req.method} Not Allowed` })
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    alert('❌ Error processing PDFs: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

// Helper functions for mock data generation
function extractArtistName(filename, emailSubject) {
  // Try to extract name from filename or email subject
  const nameMatch = filename.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/i) || 
                   emailSubject.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/i)
  return nameMatch ? nameMatch[1] : "Unknown Artist"
}

function extractEventName(emailSubject) {
  if (emailSubject.toLowerCase().includes('festival')) return "Music Festival"
  if (emailSubject.toLowerCase().includes('concert')) return "Concert Tour"
  if (emailSubject.toLowerCase().includes('fringe')) return "Edinburgh Fringe"
  return "Performance Event"
}

function generateMockPassport() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  return letters.charAt(Math.floor(Math.random() * letters.length)) +
         letters.charAt(Math.floor(Math.random() * letters.length)) +
         Array.from({length: 6}, () => numbers.charAt(Math.floor(Math.random() * numbers.length))).join('')
}