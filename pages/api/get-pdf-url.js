import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pdfId } = req.query;

    if (!pdfId) {
      return res.status(400).json({ error: 'PDF ID is required' });
    }

    // Get PDF from database
    const { data, error } = await supabase
      .from('pdfs')
      .select('downloadUrl, localPath, filename, status')
      .eq('id', pdfId)
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to get PDF' });
    }

    if (!data) {
      return res.status(404).json({ error: 'PDF not found in database' });
    }

    // Try to get URL from downloadUrl first, then localPath
    let pdfUrl = data.downloadUrl;
    
    if (!pdfUrl && data.localPath) {
      pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs/${data.localPath}`;
    }

    if (!pdfUrl) {
      return res.status(404).json({ error: 'PDF file not available for viewing' });
    }

    return res.status(200).json({ 
      url: pdfUrl,
      filename: data.filename
    });

  } catch (error) {
    console.error('Get PDF URL error:', error);
    return res.status(500).json({ 
      error: 'Failed to get PDF URL',
      details: error.message 
    });
  }
} 