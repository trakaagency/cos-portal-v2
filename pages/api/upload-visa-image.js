// pages/api/upload-visa-image.js
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'

// Disable Next.js body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
  },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse the form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      allowedMimeTypes: [
        'image/jpeg', 
        'image/png', 
        'image/jpg', 
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ],
      keepExtensions: true,
      uploadDir: '/tmp'
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })

    const uploadedFile = files.image?.[0] || files.image
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file provided' })
    }

    console.log('File upload details:', {
      originalFilename: uploadedFile.originalFilename,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
      filepath: uploadedFile.filepath
    })

    console.log('Uploaded file details:', {
      filepath: uploadedFile.filepath,
      originalFilename: uploadedFile.originalFilename,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size
    })

    const artistId = fields.artistId?.[0]
    const passportNumber = fields.passportNumber?.[0] || ''
    const artistName = fields.artistName?.[0] || 'Unknown'

    if (!artistId) {
      return res.status(400).json({ error: 'Artist ID is required' })
    }

    // Read the file
    const fs = require('fs')
    console.log('Reading file from:', uploadedFile.filepath)
    const fileBuffer = fs.readFileSync(uploadedFile.filepath)
    console.log('File buffer size:', fileBuffer.length)

    // Generate a unique filename
    const timestamp = Date.now()
    const fileExtension = uploadedFile.originalFilename?.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `visa-images/${artistId}-${timestamp}.${fileExtension}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('visa-images')
      .upload(fileName, fileBuffer, {
        contentType: uploadedFile.mimetype || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Supabase upload error:', error)
      console.error('Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        name: error.name,
        details: error.details
      })
      
      if (error.message && error.message.includes('bucket')) {
        return res.status(500).json({ error: 'Supabase storage bucket visa-images does not exist or is misconfigured.' })
      }
      if (error.message && error.message.includes('permission')) {
        return res.status(500).json({ error: 'Supabase storage permission denied. Check your service role key and bucket policy.' })
      }
      if (error.message && error.message.includes('not found')) {
        return res.status(500).json({ error: 'Supabase storage bucket not found. Please create the visa-images bucket in your Supabase project.' })
      }
      return res.status(500).json({ error: 'Failed to upload image to storage', details: error.message })
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('visa-images')
      .getPublicUrl(fileName)

    // Clean up the temporary file
    fs.unlinkSync(uploadedFile.filepath)

    // Store metadata in database (optional) - disabled due to table not existing
    // try {
    //   await supabase
    //     .from('visa_images')
    //     .insert({
    //       artist_id: artistId,
    //       passport_number: passportNumber,
    //       artist_name: artistName,
    //       file_path: fileName,
    //       file_url: urlData.publicUrl,
    //       uploaded_at: new Date().toISOString()
    //     })
    // } catch (dbError) {
    //   console.warn('Failed to store document metadata:', dbError)
    //   // Don't fail the upload if metadata storage fails
    // }

    return res.status(200).json({
      success: true,
      imageUrl: urlData.publicUrl,
      fileName: fileName,
      fileType: uploadedFile.mimetype
    })

  } catch (error) {
    console.error('Error in upload-visa-image:', error)
    return res.status(500).json({ 
      error: 'Failed to upload visa image', 
      details: error.message 
    })
  }
} 