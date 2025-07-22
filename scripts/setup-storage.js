// scripts/setup-storage.js
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setupStorage() {
  try {
    console.log('Setting up Supabase storage...')
    
    // Create the visa-images bucket if it doesn't exist
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return
    }
    
    const visaImagesBucket = buckets.find(bucket => bucket.name === 'visa-images')
    
    if (!visaImagesBucket) {
      console.log('Creating visa-images bucket...')
      const { data, error } = await supabase.storage.createBucket('visa-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        fileSizeLimit: 10485760 // 10MB
      })
      
      if (error) {
        console.error('Error creating bucket:', error)
        return
      }
      
      console.log('✅ visa-images bucket created successfully')
    } else {
      console.log('✅ visa-images bucket already exists')
    }

    // Create the pdfs bucket if it doesn't exist
    const pdfsBucket = buckets.find(bucket => bucket.name === 'pdfs')
    
    if (!pdfsBucket) {
      console.log('Creating pdfs bucket...')
      const { data, error } = await supabase.storage.createBucket('pdfs', {
        public: true,
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword'
        ],
        fileSizeLimit: 52428800 // 50MB
      })
      
      if (error) {
        console.error('Error creating pdfs bucket:', error)
        return
      }
      
      console.log('✅ pdfs bucket created successfully')
    } else {
      console.log('✅ pdfs bucket already exists')
    }
    
    console.log('Storage setup complete!')
    
  } catch (error) {
    console.error('Setup failed:', error)
  }
}

setupStorage() 