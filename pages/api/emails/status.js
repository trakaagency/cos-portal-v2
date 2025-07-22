import { getSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { emailId } = req.query;

    if (!emailId) {
      return res.status(400).json({ message: 'Email ID is required' });
    }

    // Check email status in database
    const { data, error } = await supabase
      .from('emails')
      .select('status, closed_at')
      .eq('gmail_id', emailId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means "not found"
      console.error('Database error:', error);
      return res.status(500).json({ message: 'Failed to check email status' });
    }

    // If email not found in database, it's not closed
    if (!data) {
      return res.status(200).json({ 
        isClosed: false,
        closedAt: null
      });
    }

    // Return email status
    res.status(200).json({ 
      isClosed: data.status === 'closed',
      closedAt: data.closed_at
    });

  } catch (error) {
    console.error('Check email status error:', error);
    res.status(500).json({ 
      message: 'Failed to check email status',
      error: error.message 
    });
  }
}