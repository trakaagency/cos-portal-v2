export default function handler(req, res) {
    res.status(200).json({ 
      message: 'NEW API WORKING',
      timestamp: new Date().toISOString()
    })
  }