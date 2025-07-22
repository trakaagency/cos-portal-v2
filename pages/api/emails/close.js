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

    // Update email status to closed
    const { data, error } = await supabase
      .from('emails')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('gmail_id', emailId)
      .select();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ message: 'Failed to close email' });
    }

    if (!data || data.length === 0) {
      // Email doesn't exist in database yet, create it as closed
      const { data: insertData, error: insertError } = await supabase
        .from('emails')
        .insert({
          gmail_id: emailId,
          subject: 'Email from Gmail',
          status: 'closed',
          closed_at: new Date().toISOString(),
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({ message: 'Failed to close email' });
      }

      return res.status(200).json({ 
        message: 'Email closed successfully',
        data: insertData[0]
      });
    }

    res.status(200).json({ 
      message: 'Email closed successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Close email error:', error);
    res.status(500).json({ 
      message: 'Failed to close email',
      error: error.message 
    });
  }
}