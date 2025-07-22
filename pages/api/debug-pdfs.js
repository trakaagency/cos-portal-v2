// pages/api/debug-pdfs.js
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
    // Get all PDFs from database
    const { data: pdfs, error } = await supabase
      .from('pdfs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Return debug info
    return res.status(200).json({
      success: true,
      totalPDFs: pdfs.length,
      pdfs: pdfs.map(pdf => ({
        id: pdf.id,
        filename: pdf.filename,
        hasFileData: !!pdf.file_data,
        fileDataLength: pdf.file_data ? pdf.file_data.length : 0,
        processing_status: pdf.processing_status,
        created_at: pdf.created_at
      }))
    })

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}