// pages/api/debug-email-data.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { artist } = req.body
    
    console.log('Debug email data received:', {
      artistName: artist?.givenName + ' ' + artist?.familyName,
      sourceEmailId: artist?.sourceEmailId,
      sourceEmailSubject: artist?.sourceEmailSubject,
      sourceEmailFrom: artist?.sourceEmailFrom,
      fullArtistData: artist
    })
    
    return res.status(200).json({
      success: true,
      message: 'Email data debug logged',
      artistData: {
        name: artist?.givenName + ' ' + artist?.familyName,
        sourceEmailId: artist?.sourceEmailId,
        sourceEmailSubject: artist?.sourceEmailSubject,
        sourceEmailFrom: artist?.sourceEmailFrom
      }
    })
    
  } catch (error) {
    console.error('Debug email data error:', error)
    return res.status(500).json({ 
      error: 'Debug failed', 
      details: error.message 
    })
  }
} 