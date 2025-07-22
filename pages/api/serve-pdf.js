// pages/api/serve-pdf.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pdfId } = req.query

    if (!pdfId) {
      return res.status(400).json({ error: 'Missing PDF ID' })
    }

    console.log('Serving PDF:', pdfId)

    // Get PDF record from database
    const { data: pdfRecord, error: dbError } = await supabase
      .from('pdfs')
      .select('*')
      .eq('id', pdfId)
      .single()

    if (dbError || !pdfRecord) {
      console.error('PDF not found:', dbError)
      return res.status(404).json({ error: 'PDF not found' })
    }

    // Get the PDF data from the database
    let pdfBuffer
    if (pdfRecord.file_data) {
      // Use the base64 data stored in the database
      pdfBuffer = Buffer.from(pdfRecord.file_data, 'base64')
    } else {
      return res.status(404).json({ error: 'No PDF data found' })
    }

    // Set appropriate headers for PDF download/viewing
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${pdfRecord.filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // Send the PDF buffer
    res.send(pdfBuffer)

  } catch (error) {
    console.error('Serve PDF error:', error)
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
} 