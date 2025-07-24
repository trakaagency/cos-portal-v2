// pages/api/merge-pdf-data.js
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { pdfs } = req.body
    if (!pdfs || !Array.isArray(pdfs) || pdfs.length === 0) {
      return res.status(400).json({ error: 'No PDFs provided for merging' })
    }

    console.log('🔍 Merge API received PDFs:', pdfs.map(pdf => ({
      filename: pdf.filename,
      emailSubject: pdf.emailSubject,
      emailFrom: pdf.emailFrom,
      extractedDataCount: pdf.extractedData?.length || 0,
      firstExtractedData: pdf.extractedData?.[0] ? {
        sourceEmailId: pdf.extractedData[0].sourceEmailId,
        sourceEmailSubject: pdf.extractedData[0].sourceEmailSubject,
        sourceEmailFrom: pdf.extractedData[0].sourceEmailFrom
      } : 'No extracted data'
    })))

    // Fetch all extracted text for the PDFs
    let allText = ''
    for (const pdf of pdfs) {
      // Try to fetch extracted text from DB if not present
      let text = pdf.extractedText
      if (!text && pdf.id) {
        const { data, error } = await supabase
          .from('pdfs')
          .select('extracted_text')
          .eq('id', pdf.id)
          .single()
        if (data && data.extracted_text) text = data.extracted_text
      }
      if (text) {
        allText += `\n---\n${pdf.filename}:\n${text}`
      }
    }

    // Use the user's n8n prompt
    const prompt = `You are a visa form data extraction specialist. Extract and MERGE information from ALL provided documents to create ONE SINGLE JSON output for a UK Certificate of Sponsorship form.

CRITICAL MERGING RULES:
1. Read ALL documents provided in the input
2. Extract information from EVERY document
3. If multiple people are found, create SEPARATE JSON objects for each person
4. Output an ARRAY of JSON objects, one per person
5. GROUP RELATED ARTISTS who work the same gigs together

CRITICAL RULES:
1. ONLY extract information explicitly provided in the documents
2. NEVER make assumptions or fill in missing information
3. Leave fields BLANK ("") if information is not provided in ANY document
4. Output ONLY ONE JSON object followed by notes after a clear break

DOCUMENT TYPE DETECTION:
- ITINERARY documents contain: tour schedules, event dates, venue addresses, performance details
- ARTIST DETAILS documents contain: personal information, passport details, birth information, home addresses

EXTRACTION PROCESS:
Step 1: Identify document types (itinerary vs artist details)
Step 2: Extract personal details from artist details documents
Step 3: Extract event dates, fees, and VENUE ADDRESS from itinerary documents
Step 4: Identify artist roles and group related artists
Step 5: Merge all information into separate JSON objects per person

ARTIST ROLE DETECTION:
- Look for roles like: "DJ", "Musician", "Band Member", "Tour Manager", "Sound Engineer", "Lighting Technician"
- Group artists who are mentioned together in the same events/tours
- Artists working the same gigs should have identical venue addresses

VENUE ADDRESS PRIORITY:
- VENUE ADDRESS is ALWAYS found in ITINERARY documents, NEVER in artist details
- When merging, ALWAYS use venue address from itinerary document
- If venue address is in artist details, IGNORE it and use itinerary venue address
- Venue address should be the full venue address where the event will take place
- ALL ARTISTS working the same gigs must have IDENTICAL venue addresses

EXTRACTION RULES:
- Extract REAL names (NOT stage names) for familyName, givenName and otherNames (if applicable)
- Use DD format for days (01, 02, etc.), MM format for months (00-11)
- Convert date formats to form standard: "25th Nov 2024" → day=25, month=10, year=2024
- Handle American date formats (MM/DD/YYYY) and convert to form format
- Handle written months: January=0, February=1, March=2, April=3, May=4, June=5, July=6, August=7, September=8, October=9, November=10, December=11
- Handle numeric months: 1=00, 2=01, 3=02, 4=03, 5=04, 6=05, 7=06, 8=07, 9=08, 10=09, 11=10, 12=11
- For single-day performances: use same date for both start and end dates
- For multiple performance dates: use first date for start, last date for end
- Extract fee amount ONLY (ignore currency symbols/codes like £, AF, USD, etc.)
- AF = Artist Fee, extract the number only
- Keep all text fields on single lines - replace line breaks with spaces
- Ensure summaryOfJobDescription is one continuous line without line breaks
- The summaryOfJobDescription NEEDS TO ALWAYS BE "Internationally renowned touring DJ from [NATIONALITY] performing in the UK as part of international tour. No impact on resident labor." If Nationality is written as 'American' here then you say 'from USA'.
- The grossSalary needs to be an integer.
- If the year is not mentioned, assume 2025.

JOB CLASSIFICATION:
- If document states "DJ" → jobTitle: "Touring DJ", summaryOfJobDescription: "...touring DJ..."
- If document states "Musician" → jobTitle: "Touring Musician", summaryOfJobDescription: "...touring musician..."
- If document states "Band Member" → jobTitle: "Touring Musician", summaryOfJobDescription: "...touring musician..."
- If document states "Tour Manager" → jobTitle: "Tour Manager", summaryOfJobDescription: "...tour manager..."
- If document states "Sound Engineer" → jobTitle: "Sound Engineer", summaryOfJobDescription: "...sound engineer..."
- If document states "Lighting Technician" → jobTitle: "Lighting Technician", summaryOfJobDescription: "...lighting technician..."

ARTIST GROUPING LOGIC:
- If multiple artists are mentioned in the same itinerary/tour schedule, they work together
- All artists in the same group should have identical venue addresses
- All artists in the same group should have identical event dates
- All artists in the same group should have identical gross salary (if applicable)
- If only ONE itinerary document is provided, ALL artists should have identical dates and venue addresses
- If multiple itineraries are provided, group artists by their specific itinerary
- Artists working the same gigs must have identical showDateStartDay/Month/Year and showDateEndDay/Month/Year

REQUIRED OUTPUT FORMAT (ARRAY OF OBJECTS):
[ ... ]

TEMPLATE REPLACEMENTS:
- Replace [COUNTRY] with the artist's countryOfBirth
- If musician instead of DJ, update jobTitle and summaryOfJobDescription accordingly
- grossSalary should be numeric value only (no currency symbols)

NOTES REQUIREMENTS:
Only report missing information for these CRITICAL fields:
- familyName, givenName, nationality, placeOfBirth, countryOfBirth
- birthDay, birthMonth, birthYear, sex, countryOfResidence
- passportNumber, passportIssueDay/Month/Year, passportExpiryDay/Month/Year, placeOfIssueOfPassport
- address, city, postcode, country
- showDateStartDay/Month/Year, showDateEndDay/Month/Year
- grossSalary
- venueAddress (from itinerary document)

IGNORE missing: otherNames, addressLine2/3, county, ukIdCardNumber, ukNationalInsuranceNumber, nationalIdCardNumber, employeeNumber, addPWSAddress, addWSAddress, grossAllowances, allowanceDetails

OUTPUT REQUIREMENTS:
1. Return ONE SINGLE JSON object first (no code block markers)
2. Add clear separator: "---NOTES---"
3. ONLY list missing CRITICAL information - be extremely concise
4. If all critical fields present, output "No critical information missing"
5. All text fields must be single lines (no line breaks within strings)

DOCUMENT TEXT:
${allText}

REMEMBER: Create only ONE merged JSON output. Report only missing critical fields in notes. Aim for minimal or no notes when possible. ALWAYS output valid JSON (if there are issues in the text with spaces and concatenation then please resolve so the JSON is valid).
`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional document extraction specialist. Return only valid JSON arrays." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const aiResponse = completion.choices[0].message.content;

    // Parse the AI response (remove notes if needed)
    let mergedData = [];
    let notes = '';
    try {
      const [jsonPart, notesPart] = aiResponse.split('---NOTES---');
      mergedData = JSON.parse(jsonPart.trim());
      notes = notesPart ? notesPart.trim() : '';
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', aiResponse });
    }

    // Define the required field order and default values
    const fieldOrder = [
      "familyName", "givenName", "otherNames", "nationality", "placeOfBirth", "countryOfBirth",
      "birthDay", "birthMonth", "birthYear", "sex", "countryOfResidence", "passportNumber",
      "passportIssueDay", "passportIssueMonth", "passportIssueYear", "passportExpiryDay",
      "passportExpiryMonth", "passportExpiryYear", "placeOfIssueOfPassport", "address",
      "addressLine2", "addressLine3", "city", "county", "postcode", "country", "ukIdCardNumber",
      "ukNationalInsuranceNumber", "nationalIdCardNumber", "employeeNumber", "showDateStartDay",
      "showDateStartMonth", "showDateStartYear", "showDateEndDay", "showDateEndMonth",
      "showDateEndYear", "doesMigrantNeedToLeaveAndReenter", "totalWeeklyHours", "addPWSAddress",
      "addWSAddress", "jobTitle", "jobType", "summaryOfJobDescription", "forEach", "grossSalary",
      "grossAllowances", "allowanceDetails", "creativeCodeCompliance", "certifyMaintenance", "venueAddress"
    ];

    // Reorder and fill missing fields for each object
    // In the post-processing, guarantee venue and venueAddress fields are present
    const orderedMergedData = Array.isArray(mergedData)
      ? mergedData.map(obj => {
          const ordered = {};
          fieldOrder.forEach(key => { ordered[key] = obj[key] !== undefined ? obj[key] : ""; });
          // Include venue address in merged data
          ordered.venueAddress = obj.venueAddress || "";
          // Set required constant values
          ordered.doesMigrantNeedToLeaveAndReenter = "Y";
          ordered.totalWeeklyHours = "2";
          ordered.addPWSAddress = "";
          ordered.addWSAddress = "";
          ordered.jobTitle = "Touring DJ";
          ordered.jobType = "X3145";
          // summaryOfJobDescription: replace [country] with countryOfBirth
          const country = ordered.countryOfBirth || "";
          ordered.summaryOfJobDescription = `Internationally renowned touring DJ from ${country} performing in the UK as part of international tour. No impact on resident labor.`;
          ordered.forEach = "PERF";
          // grossSalary: keep as is from AI/itinerary
          // grossAllowances, allowanceDetails: always empty
          ordered.grossAllowances = "";
          ordered.allowanceDetails = "";
          ordered.creativeCodeCompliance = "Creative Sector - Live Music - No Code of Conduct";
          ordered.certifyMaintenance = "Y";
          
          // Preserve email information from the original extraction
          if (obj.sourceEmailId) ordered.sourceEmailId = obj.sourceEmailId;
          if (obj.sourceEmailSubject) ordered.sourceEmailSubject = obj.sourceEmailSubject;
          if (obj.sourceEmailFrom) ordered.sourceEmailFrom = obj.sourceEmailFrom;
          
          return ordered;
        })
      : [];

    // If no email data was preserved from the AI extraction, try to get it from the original PDFs
    if (orderedMergedData.length > 0 && !orderedMergedData[0].sourceEmailFrom) {
      console.log('🔍 No email data in AI extraction, trying to preserve from original PDFs')
      
      // Find the first PDF with email data
      const pdfWithEmail = pdfs.find(pdf => pdf.emailFrom || (pdf.extractedData && pdf.extractedData[0] && pdf.extractedData[0].sourceEmailFrom))
      
      if (pdfWithEmail) {
        const emailData = {
          sourceEmailId: pdfWithEmail.emailId || (pdfWithEmail.extractedData && pdfWithEmail.extractedData[0] && pdfWithEmail.extractedData[0].sourceEmailId),
          sourceEmailSubject: pdfWithEmail.emailSubject || (pdfWithEmail.extractedData && pdfWithEmail.extractedData[0] && pdfWithEmail.extractedData[0].sourceEmailSubject),
          sourceEmailFrom: pdfWithEmail.emailFrom || (pdfWithEmail.extractedData && pdfWithEmail.extractedData[0] && pdfWithEmail.extractedData[0].sourceEmailFrom)
        }
        
        console.log('🔍 Preserving email data from original PDF:', emailData)
        
        // Add email data to all merged results
        orderedMergedData.forEach(item => {
          if (emailData.sourceEmailId) item.sourceEmailId = emailData.sourceEmailId;
          if (emailData.sourceEmailSubject) item.sourceEmailSubject = emailData.sourceEmailSubject;
          if (emailData.sourceEmailFrom) item.sourceEmailFrom = emailData.sourceEmailFrom;
        })
      }
    }

    // Post-processing: Ensure date and venue consistency for artists working the same gigs
    if (orderedMergedData.length > 1) {
      console.log('🔍 Post-processing: Ensuring date and venue consistency for artists working same gigs')
      
      // Find the most complete itinerary data (has both dates and venue)
      const itineraryData = orderedMergedData.find(item => 
        item.showDateStartDay && item.showDateStartMonth && item.showDateStartYear &&
        item.showDateEndDay && item.showDateEndMonth && item.showDateEndYear &&
        item.venueAddress && item.venueAddress.trim() !== ""
      );
      
      if (itineraryData) {
        console.log('🔍 Found complete itinerary data, applying to all artists:', {
          dates: `${itineraryData.showDateStartDay}/${itineraryData.showDateStartMonth}/${itineraryData.showDateStartYear} - ${itineraryData.showDateEndDay}/${itineraryData.showDateEndMonth}/${itineraryData.showDateEndYear}`,
          venue: itineraryData.venueAddress
        });
        
        // Apply the same dates and venue to all artists
        orderedMergedData.forEach(item => {
          // Apply dates from itinerary
          item.showDateStartDay = itineraryData.showDateStartDay;
          item.showDateStartMonth = itineraryData.showDateStartMonth;
          item.showDateStartYear = itineraryData.showDateStartYear;
          item.showDateEndDay = itineraryData.showDateEndDay;
          item.showDateEndMonth = itineraryData.showDateEndMonth;
          item.showDateEndYear = itineraryData.showDateEndYear;
          
          // Apply venue from itinerary
          item.venueAddress = itineraryData.venueAddress;
          
          // Apply salary if available
          if (itineraryData.grossSalary && String(itineraryData?.grossSalary).trim() !== "") {
            item.grossSalary = itineraryData.grossSalary;
          }
        });
        
        console.log('✅ Applied consistent dates and venue to all artists');
      } else {
        console.log('⚠️ No complete itinerary data found, keeping individual data');
      }
    }

    console.log('🔍 Final merged data with email info:', orderedMergedData.map(item => ({
      name: `${item.givenName} ${item.familyName}`,
      dates: `${item.showDateStartDay}/${item.showDateStartMonth}/${item.showDateStartYear} - ${item.showDateEndDay}/${item.showDateEndMonth}/${item.showDateEndYear}`,
      venue: item.venueAddress,
      sourceEmailId: item.sourceEmailId,
      sourceEmailSubject: item.sourceEmailSubject,
      sourceEmailFrom: item.sourceEmailFrom
    })))

    return res.status(200).json({
      success: true,
      mergedData: orderedMergedData,
      notes
    });
  } catch (error) {
    console.error('Error in merge-pdf-data:', error)
    return res.status(500).json({ error: 'Failed to merge PDF data', details: error.message })
  }
} 