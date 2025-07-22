// pages/api/test-logs.js
export default async function handler(req, res) {
  console.log('🧪 Test logs endpoint called')
  console.log('📅 Timestamp:', new Date().toISOString())
  console.log('🌐 Request method:', req.method)
  console.log('📝 Request body:', req.body)
  
  return res.status(200).json({
    success: true,
    message: 'Test logs endpoint working',
    timestamp: new Date().toISOString(),
    method: req.method
  })
} 