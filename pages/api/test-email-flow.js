// pages/api/test-email-flow.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { emailData } = req.body
    
    console.log('🧪 Test email flow received:', emailData)
    
    // Simulate the extraction process
    const mockExtractedData = [{
      familyName: "Test",
      givenName: "Artist",
      sourceEmailId: emailData.emailId,
      sourceEmailSubject: emailData.emailSubject,
      sourceEmailFrom: emailData.emailFrom
    }]
    
    console.log('🧪 Mock extracted data with email info:', mockExtractedData)
    
    return res.status(200).json({
      success: true,
      message: 'Email flow test completed',
      extractedData: mockExtractedData,
      originalEmailData: emailData
    })
    
  } catch (error) {
    console.error('Test email flow error:', error)
    return res.status(500).json({ 
      error: 'Test failed', 
      details: error.message 
    })
  }
} 