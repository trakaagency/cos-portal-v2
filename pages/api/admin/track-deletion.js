export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { artistId, artistName, userId, userEmail } = req.body

    // In a real implementation, you'd store this in a database
    // For now, we'll just log it
    console.log('Admin tracking - Artist deletion:', {
      artistId,
      artistName,
      userId,
      userEmail,
      deletedAt: new Date().toISOString()
    })

    // You could store this in a database table like:
    // artist_deletions: { id, artistId, artistName, userId, userEmail, deletedAt }

    res.status(200).json({ success: true, message: 'Deletion tracked' })
  } catch (error) {
    console.error('Track deletion API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 