// pages/api/test-real-download.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  try {
    // Test with a real Gmail-style attachment ID
    const testAttachmentId = "ANGjdJ87ZvdZGRtPN507r4FgOWDflpkSfAdV31A-1d4QYcj8gMpHM_gNoriauMvylraY5QLCDOmVnbB6hoUVYbbtDogvl3RFeeLqdtckqCCd_0t0BEebsMRTG9IvuWwVjcvF8ywzxds2jX7W4QUWg0S3UNTOT4Uu7d-fqeOd-GlhFn5c9_urwGHnOT_v_xMDMiG4gXDkZO2T-7HHpIyt2PdFo8KconeP5R2OyzEFoAF6ui2wDJRCmA7cH2dw274NByl2x7FLts0BWvw5Vy1kk4_rUhd0eGF4TIeaB5MAPwabTHTCwOt4pl5tdGDb0sRX5A5AggNgHYplReVm_PrjFq7vj7y8zRFZEmBjYY3d4nMSjDnBSZEGWsRwjuMaMIzxcEMI7OSbKP_vPH-1_7ol"

    console.log('Testing with long attachment ID:', testAttachmentId.length, 'characters')

    // Test insert with truncated attachment ID
    const { data: pdfRecord, error: insertError } = await supabase
      .from('pdfs')
      .insert({
        filename: 'real-gmail-test.pdf',
        mime_type: 'application/pdf',
        size: 98555,
        attachment_id: testAttachmentId.substring(0, 250), // Truncate to fit
        file_data: 'JVBERi0xLjQKJdPr6eEKMSAwIG9iaiA...', // Mock base64 PDF data
        status: 'PENDING',
        processing_status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      return res.status(500).json({
        error: 'Insert failed',
        details: insertError.message,
        attachmentIdLength: testAttachmentId.length
      })
    }

    return res.status(200).json({
      success: true,
      pdfId: pdfRecord.id,
      message: 'Real Gmail-style PDF stored successfully',
      attachmentIdLength: testAttachmentId.length,
      truncatedLength: testAttachmentId.substring(0, 250).length
    })

  } catch (error) {
    return res.status(500).json({
      error: 'Test failed',
      details: error.message
    })
  }
}