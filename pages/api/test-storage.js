// pages/api/test-storage.js
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
    console.log('Testing Supabase storage connection...')
    
    // Test if we can list buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      return res.status(500).json({ 
        error: 'Failed to list buckets', 
        details: bucketsError.message 
      })
    }
    
    console.log('Available buckets:', buckets.map(b => b.name))
    
    // Check if visa-images bucket exists
    const visaImagesBucket = buckets.find(b => b.name === 'visa-images')
    
    if (!visaImagesBucket) {
      return res.status(404).json({ 
        error: 'visa-images bucket not found',
        availableBuckets: buckets.map(b => b.name),
        message: 'Please create the visa-images bucket in your Supabase project'
      })
    }
    
    // Test if we can list files in the bucket
    const { data: files, error: filesError } = await supabase.storage
      .from('visa-images')
      .list('', { limit: 1 })
    
    if (filesError) {
      console.error('Error listing files:', filesError)
      return res.status(500).json({ 
        error: 'Failed to list files in visa-images bucket', 
        details: filesError.message 
      })
    }
    
    return res.status(200).json({
      success: true,
      message: 'Supabase storage is working correctly',
      bucketExists: true,
      bucketName: 'visa-images',
      filesCount: files.length
    })
    
  } catch (error) {
    console.error('Storage test error:', error)
    return res.status(500).json({ 
      error: 'Storage test failed', 
      details: error.message 
    })
  }
} 