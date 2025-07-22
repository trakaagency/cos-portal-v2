import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { emailId } = req.body;

    if (!emailId) {
      return res.status(400).json({ message: 'Email ID is required' });
    }

    // Update email status to open
    const { data, error } = await supabase
      .from('emails')
      .update({
        status: 'open',
        closed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('gmail_id', emailId)
      .select();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ message: 'Failed to reopen email' });
    }

    res.status(200).json({ 
      message: 'Email reopened successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Reopen email error:', error);
    res.status(500).json({ 
      message: 'Failed to reopen email',
      error: error.message 
    });
  }
}