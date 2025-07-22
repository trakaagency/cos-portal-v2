// pages/api/extract-pdf-upload.js
import { IncomingForm } from 'formidable';
import fs from 'fs';
import pdf from 'pdf-parse';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📤 Processing PDF upload...');

    const form = new IncomingForm();
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const pdfFile = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    
    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('📄 Processing file:', pdfFile.originalFilename);

    // Read PDF and extract text
    const pdfBuffer = fs.readFileSync(pdfFile.filepath);
    const pdfData = await pdf(pdfBuffer);
    const extractedText = pdfData.text;
    
    console.log('📝 Extracted text length:', extractedText.length);

    // Send to OpenAI
    const structuredData = await extractWithAI(extractedText, pdfFile.originalFilename);

    // Clean up
    fs.unlinkSync(pdfFile.filepath);

    res.status(200).json({
      success: true,
      filename: pdfFile.originalFilename,
      extractedData: structuredData
    });

  } catch (error) {
    console.error('💥 Error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF',
      message: error.message 
    });
  }
}

async function extractWithAI(text, filename) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Extract data from this document and return ONLY valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: `Extract data from this document and return JSON with these fields:
          
{
  "familyName": "",
  "givenName": "",
  "otherNames": "",
  "nationality": "",
  "placeOfBirth": "",
  "countryOfBirth": "",
  "birthDay": "",
  "birthMonth": "",
  "birthYear": "",
  "sex": "",
  "countryOfResidence": "",
  "passportNumber": "",
  "passportIssueDay": "",
  "passportIssueMonth": "",
  "passportIssueYear": "",
  "passportExpiryDay": "",
  "passportExpiryMonth": "",
  "passportExpiryYear": "",
  "placeOfIssueOfPassport": "",
  "address": "",
  "addressLine2": "",
  "addressLine3": "",
  "city": "",
  "county": "",
  "postcode": "",
  "country": "",
  "ukIdCardNumber": "",
  "ukNationalInsuranceNumber": "",
  "nationalIdCardNumber": "",
  "employeeNumber": "",
  "showDateStartDay": "",
  "showDateStartMonth": "",
  "showDateStartYear": "",
  "showDateEndDay": "",
  "showDateEndMonth": "",
  "showDateEndYear": "",
  "doesMigrantNeedToLeaveAndReenter": "Y",
  "totalWeeklyHours": "",
  "addPWSAddress": "",
  "addWSAddress": "",
  "jobTitle": "",
  "jobType": "X3145",
  "summaryOfJobDescription": "",
  "forEach": "PERF",
  "grossSalary": 0,
  "grossAllowances": "",
  "allowanceDetails": "",
  "creativeCodeCompliance": "Creative Sector - Live Music - No Code of Conduct",
  "certifyMaintenance": "Y"
}

Document content: ${text}

Return only the JSON object.`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = response.choices[0].message.content.trim();
    
    // Clean and parse JSON
    let cleanJson = result.replace(/```json/g, '').replace(/```/g, '');
    
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error('AI extraction error:', error);
    return { error: 'AI extraction failed' };
  }
}
