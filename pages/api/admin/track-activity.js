export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, action, sessionStart, sessionEnd } = req.body

    // In a real implementation, you'd store this in a database
    // For now, we'll just log it
    console.log('Admin tracking - User activity:', {
      userId,
      userEmail,
      action, // 'sign-in', 'sign-out', 'session-start', 'session-end'
      sessionStart,
      sessionEnd,
      timestamp: new Date().toISOString()
    })

    // You could store this in a database table like:
    // user_activity: { id, userId, userEmail, action, sessionStart, sessionEnd, timestamp }

    res.status(200).json({ success: true, message: 'Activity tracked' })
  } catch (error) {
    console.error('Track activity API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 