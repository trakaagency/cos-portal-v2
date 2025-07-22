import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { filenames } = req.body;

    if (!filenames || !Array.isArray(filenames)) {
      return res.status(400).json({ error: 'Filenames array is required' });
    }

    const summaries = [];

    for (const filename of filenames) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that analyzes PDF filenames for music industry documents. 
              Extract the artist name and determine if the document is an "Itinerary" or "Details" document.
              
              Rules:
              - Look for artist names in the filename
              - Determine if it's an itinerary (schedule, dates, travel) or details (personal info, passport, visa)
              - If no clear artist name is found, use "Unknown"
              - If unclear if itinerary or details, default to "Details"
              - Return only the format: "[Artist Name] - [Itinerary/Details]"
              - Keep it concise and clean`
            },
            {
              role: 'user',
              content: `Analyze this PDF filename: "${filename}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 50
        });

        const summary = response.choices[0].message.content.trim();
        summaries.push({
          original: filename,
          summary: summary
        });
      } catch (error) {
        console.error('OpenAI error for filename:', filename, error);
        summaries.push({
          original: filename,
          summary: 'Unknown - Details'
        });
      }
    }

    return res.status(200).json({ summaries });

  } catch (error) {
    console.error('Summarize PDF names error:', error);
    return res.status(500).json({ 
      error: 'Failed to summarize PDF names',
      details: error.message 
    });
  }
} 