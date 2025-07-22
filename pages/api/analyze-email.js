import { getSession } from 'next-auth/react';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { subject, sender, snippet, attachmentCount } = req.body;

    if (!subject || !sender) {
      return res.status(400).json({ message: 'Subject and sender are required' });
    }

    // Create AI prompt for email analysis
    const prompt = `
You are an AI assistant that analyzes emails for a Certificate of Sponsorship (CoS) visa processing system. 

Analyze this email and provide a JSON response with the following structure:

{
  "category": "urgent|standard|low|processed|duplicate",
  "priority": 1-10,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of the analysis",
  "extractedInfo": {
    "artistName": "string|null",
    "eventType": "string|null",
    "venue": "string|null",
    "dates": "string|null",
    "isCoSRelated": boolean,
    "urgencyKeywords": ["array", "of", "keywords"]
  }
}

Email Details:
- Subject: "${subject}"
- Sender: "${sender}"
- Snippet: "${snippet || 'No preview available'}"
- Attachment Count: ${attachmentCount || 0}

Analysis Guidelines:
1. URGENT (8-10): Contains words like "urgent", "emergency", "asap", "deadline", "expires", "today", "tomorrow", visa deadlines
2. STANDARD (4-7): Regular CoS applications, contains "certificate of sponsorship", "visa", "tier 2", "work permit"
3. LOW (1-3): General inquiries, follow-ups, non-urgent correspondence
4. PROCESSED (0): Replies to already processed applications, confirmations, "thank you" emails
5. DUPLICATE (0): Looks like a duplicate of previous applications

Look for:
- Artist/performer names
- Event types (concert, performance, festival, etc.)
- Venue names
- Date references
- CoS-related keywords
- Urgency indicators
- Whether this is a new application or follow-up

Respond with valid JSON only.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email analyzer for visa processing. Respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0].message.content;
    
    try {
      const analysis = JSON.parse(aiResponse);
      
      // Validate response structure
      if (!analysis.category || !analysis.priority || analysis.confidence === undefined) {
        throw new Error('Invalid response structure');
      }

      // Ensure priority is within valid range
      analysis.priority = Math.max(1, Math.min(10, analysis.priority));
      
      // Ensure confidence is within valid range
      analysis.confidence = Math.max(0, Math.min(1, analysis.confidence));

      // Add timestamp
      analysis.analyzedAt = new Date().toISOString();

      res.status(200).json(analysis);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI Response:', aiResponse);
      
      // Fallback analysis
      const fallbackAnalysis = {
        category: 'standard',
        priority: 5,
        confidence: 0.5,
        reasoning: 'AI analysis failed, using fallback categorization',
        extractedInfo: {
          artistName: null,
          eventType: null,
          venue: null,
          dates: null,
          isCoSRelated: subject.toLowerCase().includes('certificate') || 
                        subject.toLowerCase().includes('visa') || 
                        subject.toLowerCase().includes('sponsorship'),
          urgencyKeywords: []
        },
        analyzedAt: new Date().toISOString()
      };

      res.status(200).json(fallbackAnalysis);
    }

  } catch (error) {
    console.error('Email analysis error:', error);
    res.status(500).json({ 
      message: 'Failed to analyze email',
      error: error.message 
    });
  }
}