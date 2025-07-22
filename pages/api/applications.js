import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'

export default async function handler(req, res) {
  try {
    console.log('Applications API called:', req.method)
    
    const session = await getServerSession(req, res, authOptions)
    
    if (!session) {
      console.log('No session found')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('Session found:', session.user.email)

    if (req.method === 'GET') {
      // Mock applications data
      const mockApplications = [
        {
          id: '1',
          artist_name: 'John Doe',
          passport_number: 'AB123456',
          nationality: 'American',
          event_name: 'London Music Festival',
          venue: 'O2 Arena',
          start_date: '2025-08-15',
          end_date: '2025-08-20',
          status: 'processing',
          email_id: '1'
        },
        {
          id: '2',
          artist_name: 'Jane Smith',
          passport_number: 'CD789012',
          nationality: 'Canadian',
          event_name: 'Edinburgh Fringe',
          venue: 'Various Venues',
          start_date: '2025-08-01',
          end_date: '2025-08-31',
          status: 'pending',
          email_id: '2'
        }
      ]

      console.log('Returning applications:', mockApplications.length)
      return res.status(200).json({ applications: mockApplications })
    }

    if (req.method === 'POST') {
      const applicationData = req.body
      console.log('Creating application:', applicationData)
      
      return res.status(201).json({ 
        application: { 
          id: Date.now().toString(), 
          ...applicationData 
        } 
      })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  } catch (error) {
    console.error('Applications API error:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}