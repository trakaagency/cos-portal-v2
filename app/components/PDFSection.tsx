// components/PDFSection.tsx
'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, AlertCircle, CheckCircle, Clock, Loader2, Merge, ExternalLink } from 'lucide-react'

interface PDFSectionProps {
  selectedEmails: any[]
  onExtractComplete: (data: any) => void
}

export default function PDFSection({ selectedEmails, onExtractComplete }: PDFSectionProps) {
  const [pdfFiles, setPDFFiles] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessing, setCurrentProcessing] = useState<string | null>(null)
  const [mergedData, setMergedData] = useState<any[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 })
  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 })

  // Load PDFs from selected emails
  useEffect(() => {
    const loadPDFs = async () => {
      if (!Array.isArray(selectedEmails) || selectedEmails.length === 0) {
        setPDFFiles([])
        setMergedData([])
        return
      }

      const allPDFs: any[] = []
      
      for (const email of selectedEmails) {
        console.log('Processing email:', {
          id: email.id,
          subject: email.subject,
          sender: email.sender,
          attachments: email.attachments?.length || 0
        })
        
        if (Array.isArray(email.attachments) && email.attachments.length > 0) {
          for (const attachment of email.attachments) {
            console.log('Processing attachment:', {
              filename: attachment.filename,
              size: attachment.size,
              id: attachment.id
            })
            
            if (attachment.filename && (
              attachment.filename.toLowerCase().endsWith('.pdf') ||
              attachment.filename.toLowerCase().endsWith('.doc') ||
              attachment.filename.toLowerCase().endsWith('.docx')
            )) {
              const pdfItem = {
                id: attachment.id || `${email.id}-${attachment.filename}`,
                filename: attachment.filename,
                size: attachment.size || 0,
                status: 'pending',
                emailId: email.id,
                attachmentId: attachment.id,
                emailSubject: email.subject,
                emailFrom: email.sender
              }
              
              console.log('Adding PDF item:', pdfItem)
              allPDFs.push(pdfItem)
            }
          }
        }
      }
      setPDFFiles(allPDFs)
      setMergedData([]) // Reset merged data only when emails change
    }
    loadPDFs()
  }, [selectedEmails])

  const extractFromPDF = async (pdfFile: any) => {
    setCurrentProcessing(pdfFile.id)
    
    // Update status to processing
    setPDFFiles(prev => prev.map(pdf => 
      pdf.id === pdfFile.id 
        ? { ...pdf, status: 'processing' }
        : pdf
    ))

    try {
      let pdfId = pdfFile.id
      
      // Check if this is a Gmail attachment ID (not a database UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(pdfFile.id)) {
        console.log('Downloading PDF from Gmail first...')
        
        // Download PDF first
        const downloadResponse = await fetch('/api/download-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            emailId: pdfFile.emailId,
            attachmentId: pdfFile.attachmentId || pdfFile.id.split('-')[0],
            filename: pdfFile.filename
          }),
        })

        const downloadResult = await downloadResponse.json()

        if (!downloadResponse.ok) {
          throw new Error(downloadResult.error || 'Failed to download PDF')
        }

        pdfId = downloadResult.pdfId
        console.log('PDF downloaded successfully, database ID:', pdfId)
        
        // Determine if this is a Word document or PDF
        const isWordDocument = pdfFile.filename.toLowerCase().endsWith('.doc') || 
                              pdfFile.filename.toLowerCase().endsWith('.docx')
        
        console.log(`Starting extraction for ${isWordDocument ? 'Word document' : 'PDF'} ID:`, pdfId)
        
        // For Word documents, we need to download them first like PDFs
        if (isWordDocument) {
          // Download Word document first
          const downloadResponse = await fetch('/api/download-word-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              emailId: pdfFile.emailId,
              attachmentId: pdfFile.attachmentId || pdfFile.id.split('-')[0],
              filename: pdfFile.filename
            }),
          })

          const downloadResult = await downloadResponse.json()

          if (!downloadResponse.ok) {
            throw new Error(downloadResult.error || 'Failed to download Word document')
          }

          pdfId = downloadResult.wordDocId
          console.log('Word document downloaded successfully, database ID:', pdfId)
        }
        
        const requestBody = {
          fileId: pdfId,
          filename: pdfFile.filename,
          emailId: pdfFile.emailId,
          emailSubject: pdfFile.emailSubject,
          emailFrom: pdfFile.emailFrom
        }
        
        console.log('🔍 Sending extraction request with email data:', requestBody)
        
        const response = await fetch('/api/extract-pdf-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Extraction failed')
        }
        
        console.log('🔍 Extraction result received:', {
          success: result.success,
          peopleFound: result.peopleFound,
          extractedData: result.extractedData?.length || 0,
          emailData: result.extractedData?.[0] ? {
            sourceEmailId: result.extractedData[0].sourceEmailId,
            sourceEmailSubject: result.extractedData[0].sourceEmailSubject,
            sourceEmailFrom: result.extractedData[0].sourceEmailFrom
          } : 'No email data'
        })

        // Update PDF status and data
        setPDFFiles(prev => prev.map(pdf => 
          pdf.id === pdfFile.id 
            ? { 
                ...pdf, 
                status: 'completed',
                extractedData: result.extractedData,
                notes: result.notes,
                textLength: result.textLength,
                peopleFound: result.peopleFound,
                dbId: pdfId
              }
            : pdf
        ))
        
        console.log('Extraction result with email data:', {
          filename: pdfFile.filename,
          emailId: pdfFile.emailId,
          emailSubject: pdfFile.emailSubject,
          emailFrom: pdfFile.emailFrom,
          extractedData: result.extractedData
        })
        
        return { success: true, data: result, dbId: pdfId } // Return the result
      }

      // If we have a database ID, extract using fileId
      console.log('Starting extraction for PDF ID:', pdfId)
      
      const response = await fetch('/api/extract-pdf-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileId: pdfId,
          filename: pdfFile.filename
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Extraction failed')
      }

      // Update PDF status and data
      setPDFFiles(prev => prev.map(pdf => 
        pdf.id === pdfFile.id 
          ? { 
              ...pdf, 
              status: 'completed',
              extractedData: result.extractedData,
              notes: result.notes,
              textLength: result.textLength,
              peopleFound: result.peopleFound,
              dbId: pdfId
            }
          : pdf
      ))

      return { success: true, data: result, dbId: pdfId } // Return the result

    } catch (error) {
      console.error('Extraction error:', error)
      
      setPDFFiles(prev => prev.map(pdf => 
        pdf.id === pdfFile.id 
          ? { 
              ...pdf, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          : pdf
      ))
      
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      setCurrentProcessing(null)
    }
  }

  const extractAllPDFs = async () => {
    setIsProcessing(true)
    
    const pendingPDFs = pdfFiles.filter(pdf => pdf.status === 'pending' || pdf.status === 'completed')
    
    for (const pdf of pendingPDFs) {
      await extractFromPDF(pdf)
      // Small delay between extractions
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setIsProcessing(false)
  }

  const extractAndMerge = async () => {
    console.log('Extract & Merge button clicked!')
    
    // First, extract all PDFs
    setIsProcessing(true)
    
    const pendingPDFs = pdfFiles.filter(pdf => pdf.status === 'pending' || pdf.status === 'completed')
    const completedPDFs: any[] = []
    
    // Set up extraction progress
    setExtractionProgress({ current: 0, total: pendingPDFs.length })
    
    for (let i = 0; i < pendingPDFs.length; i++) {
      const pdf = pendingPDFs[i]
      let retryCount = 0
      const maxRetries = 2
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`Processing PDF ${i + 1}/${pendingPDFs.length}: ${pdf.filename}`)
          
          let extractionResult
          if (pdf.status === 'completed' && pdf.extractedData) {
            // Use existing extracted data for completed PDFs
            console.log(`Using existing extracted data for: ${pdf.filename}`)
            extractionResult = {
              success: true,
              data: {
                extractedData: pdf.extractedData,
                extractedText: pdf.extractedText || '',
                textLength: pdf.textLength || 0
              },
              dbId: pdf.dbId || pdf.id
            }
          } else {
            // Extract the PDF
            console.log(`Extracting PDF ${i + 1}/${pendingPDFs.length}: ${pdf.filename} (attempt ${retryCount + 1})`)
            extractionResult = await extractFromPDF(pdf)
          }
          
          if (extractionResult.success && extractionResult.data) {
            // Add the successfully extracted PDF to our merge list
            const mergeItem = {
              id: pdf.id,
              dbId: extractionResult.dbId,
              filename: pdf.filename,
              extractedData: extractionResult.data.extractedData,
              extractedText: extractionResult.data.extractedText || '', // Pass the actual extracted text
              emailSubject: pdf.emailSubject,
              emailFrom: pdf.emailFrom
            }
            
            console.log(`✅ Successfully extracted: ${pdf.filename}`)
            console.log('🔍 Merge item email data:', {
              emailSubject: mergeItem.emailSubject,
              emailFrom: mergeItem.emailFrom,
              extractedDataEmailFrom: mergeItem.extractedData?.[0]?.sourceEmailFrom
            })
            
            console.log('🔍 Adding to completedPDFs array:', mergeItem)
            completedPDFs.push(mergeItem)
            console.log('🔍 completedPDFs length after adding:', completedPDFs.length)
            break // Success, move to next PDF
          } else {
            throw new Error('Extraction returned no data')
          }
        } catch (error) {
          console.error(`Failed to extract PDF ${pdf.filename} (attempt ${retryCount + 1}):`, error)
          
          if (retryCount === maxRetries) {
            console.error(`Failed to extract ${pdf.filename} after ${maxRetries + 1} attempts`)
            // Mark as failed but continue with other PDFs
            setPDFFiles(prev => prev.map(p => 
              p.id === pdf.id 
                ? { ...p, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
                : p
            ))
          } else {
            // Wait longer before retry
            console.log(`Retrying ${pdf.filename} in 3 seconds...`)
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
          retryCount++
        }
      }
      
      // Update extraction progress
      setExtractionProgress({ current: i + 1, total: pendingPDFs.length })
      
      // Longer delay between extractions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    setIsProcessing(false)
    
    // Wait a moment for all extractions to complete
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Then merge the extracted data
    console.log('Starting merge process...')
    console.log('Completed PDFs for merge:', completedPDFs.length)
    
    if (completedPDFs.length === 0) {
      console.log('No completed PDFs to merge')
      return
    }

    console.log('Merging data from', completedPDFs.length, 'PDFs')
    setIsMerging(true)
    setMergeProgress({ current: 0, total: 1 })
    
    try {
      setMergeProgress({ current: 1, total: 1 })

      // Call the merge API
      const response = await fetch('/api/merge-pdf-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          pdfs: completedPDFs.map(pdf => ({
            id: pdf.dbId || pdf.id,
            filename: pdf.filename,
            extractedData: pdf.extractedData,
            extractedText: pdf.extractedText,
            emailSubject: pdf.emailSubject,
            emailFrom: pdf.emailFrom
          }))
        }),
      })

      console.log('Merge API response status:', response.status)
      const result = await response.json()
      console.log('Merge API result:', result)

      if (!response.ok) {
        throw new Error(result.error || 'Merge failed')
      }

      console.log('Merge completed:', result)
      setMergedData(result.mergedData || [])

      console.log('Final merged data being passed to dashboard:', result.mergedData.map((item: any) => ({
        name: `${item.givenName} ${item.familyName}`,
        sourceEmailId: item.sourceEmailId,
        sourceEmailSubject: item.sourceEmailSubject,
        sourceEmailFrom: item.sourceEmailFrom
      })))

      // Pass merged data to parent component
      onExtractComplete({
        pdfId: 'merged',
        filename: 'Merged Data',
        data: result.mergedData,
        notes: `Merged ${completedPDFs.length} PDFs - ${result.mergedData.length} artists found`,
        peopleFound: result.mergedData.length,
        isMerged: true
      })

    } catch (error) {
      console.error('Merge error:', error)
    } finally {
      setIsMerging(false)
      setMergeProgress({ current: 0, total: 0 })
    }
  }

  const getStatusIcon = (status: string, isCurrentlyProcessing: boolean) => {
    if (isCurrentlyProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (pdf: any) => {
    switch (pdf.status) {
      case 'completed':
        return `Extracted ${pdf.peopleFound || 0} person(s) - ${pdf.textLength || 0} chars`
      case 'processing':
        return 'Processing with AI...'
      case 'error':
        return `Error: ${pdf.error}`
      default:
        return 'Ready to extract'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleOpenPDF = async (pdf: any) => {
    try {
      console.log('Attempting to open PDF in new tab:', pdf);
      
      // Check if PDF has been downloaded to database
      if (pdf.dbId) {
        console.log('PDF has dbId, opening via serve-pdf endpoint...');
        // Open PDF using our serve-pdf endpoint
        const pdfUrl = `/api/serve-pdf?pdfId=${pdf.dbId}`;
        window.open(pdfUrl, '_blank');
        return;
      }
      
      // If not in database, try to download it first
      console.log('PDF not in database, downloading first...');
      const requestPayload = {
        emailId: pdf.emailId,
        attachmentId: pdf.attachmentId || pdf.id.split('-')[0],
        filename: pdf.filename
      };
      console.log('Download request payload:', requestPayload);
      console.log('PDF object:', pdf);
      const downloadResponse = await fetch('/api/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailId: pdf.emailId,
          attachmentId: pdf.attachmentId || pdf.id.split('-')[0],
          filename: pdf.filename
        }),
      });

      console.log('Download response status:', downloadResponse.status);
      console.log('Download response headers:', Object.fromEntries(downloadResponse.headers.entries()));

      if (downloadResponse.ok) {
        const downloadResult = await downloadResponse.json();
        
        // Open the PDF using our serve-pdf endpoint
        if (downloadResult.pdfId) {
          const pdfUrl = `/api/serve-pdf?pdfId=${downloadResult.pdfId}`;
          window.open(pdfUrl, '_blank');
        } else {
          alert('No PDF ID received from server');
        }
      } else {
        let errorData = {};
        let errorMessage = 'Unknown error';
        
        try {
          errorData = await downloadResponse.json();
          errorMessage = (errorData as any).error || (errorData as any).details || 'Unknown error';
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          // If we can't parse JSON, use the status text
          errorMessage = downloadResponse.statusText || `HTTP ${downloadResponse.status}`;
          errorData = { error: errorMessage };
        }
        
        alert(`Failed to download PDF: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error opening PDF: ${errorMessage}`);
    }
  }

  const completedCount = pdfFiles.filter(pdf => pdf.status === 'completed').length
  const totalCount = pdfFiles.length
  const canMerge = completedCount > 0 && !isMerging

  return (
    <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#43ffa4]" />
          <h2 className="text-lg font-semibold text-white">Document Processing</h2>
          {pdfFiles.length > 0 && (
            <span className="bg-[#43ffa4]/20 text-[#43ffa4] px-2 py-1 rounded-full text-xs">
              {pdfFiles.length} Document{pdfFiles.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={extractAndMerge}
            disabled={isProcessing || isMerging || pdfFiles.length === 0}
            className="btn-gradient btn-small disabled:opacity-50"
          >
            <span>{isProcessing ? 'Extracting...' : isMerging ? 'Merging...' : 'Extract & Merge'}</span>
          </button>
        </div>
      </div>
      
      {/* Progress Bars */}
      {(isProcessing || isMerging) && (
        <div className="mb-4 space-y-3">
          {/* Extraction Progress */}
          {isProcessing && extractionProgress.total > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">Extracting PDFs</span>
                <span className="text-xs text-gray-300">
                  {extractionProgress.current} / {extractionProgress.total}
                </span>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="loader">
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1 text-center">
                {extractionProgress.current > 0 && extractionProgress.current < extractionProgress.total 
                  ? `Processing PDF ${extractionProgress.current} of ${extractionProgress.total}...`
                  : extractionProgress.current === extractionProgress.total 
                    ? 'Extraction complete!'
                    : 'Starting extraction...'
                }
              </div>
            </div>
          )}
          
          {/* Merge Progress */}
          {isMerging && mergeProgress.total > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium">Merging Data</span>
                <span className="text-xs text-gray-300">
                  {mergeProgress.current} / {mergeProgress.total}
                </span>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="loader">
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                  <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1 text-center">
                {mergeProgress.current === 0 
                  ? 'Preparing to merge...'
                  : mergeProgress.current === mergeProgress.total 
                    ? 'Merging nearly complete...'
                    : 'Merging extracted data...'
                }
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {pdfFiles.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No PDF attachments found in selected emails</p>
            <p className="text-xs mt-1">Select emails with PDF attachments to begin processing</p>
          </div>
        ) : (
          pdfFiles.map((pdf, idx) => (
            <div key={pdf.id} className="bg-white/5 border border-gray-600/20 rounded p-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-white text-xs font-medium">{pdf.filename}</span>
                  <span className="text-gray-400 text-xs">{pdf.size ? `${(pdf.size / 1024).toFixed(1)} KB` : ''}</span>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => handleOpenPDF(pdf)}
                    className="btn-gradient btn-small"
                    title="Open PDF in new tab"
                  >
                    <span><ExternalLink className="w-3 h-3" /></span>
                  </button>
                </div>
              </div>
              {pdf.status === 'completed' && pdf.extractedData && (
                <div className="text-xs text-gray-300 mt-1">
                  Extraction completed successfully
                </div>
              )}
              {pdf.status === 'error' && pdf.error && (
                <div className="text-xs text-red-400 mt-1">{pdf.error}</div>
              )}
            </div>
          ))
        )}
      </div>
      {mergedData.length > 0 && (
        <div className="mt-2 text-[#43ffa4] text-xs">
          Successfully merged {mergedData.length} artist(s) with complete data
        </div>
      )}
      
      {/* Footer to match email section height */}
      <div className="mt-4 pt-4 border-t border-[#43ffa4]/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {pdfFiles.filter(pdf => pdf.status === 'completed').length} extracted
          </span>
        </div>
      </div>
    </div>
  )
}