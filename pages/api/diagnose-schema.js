// pages/api/diagnose-schema.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    // Try to get the table schema information
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'pdfs' 
          ORDER BY ordinal_position;
        `
      })

    if (error) {
      console.error('Schema query error:', error)
      
      // Fallback: try a simple select to see what columns exist
      const { data: sampleData, error: selectError } = await supabase
        .from('pdfs')
        .select('*')
        .limit(0)

      return res.status(200).json({
        message: 'Could not get schema info, but here is the table structure',
        error: error.message,
        selectError: selectError?.message,
        // This will show us the column names even with no data
        tableExists: !selectError
      })
    }

    return res.status(200).json({
      success: true,
      schema: data,
      message: 'PDFs table schema retrieved'
    })

  } catch (error) {
    console.error('Diagnose error:', error)
    return res.status(500).json({ 
      error: 'Failed to diagnose schema',
      details: error.message 
    })
  }
}