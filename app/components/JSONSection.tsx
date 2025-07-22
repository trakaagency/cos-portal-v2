// components/JSONSection.tsx
'use client'

import { useState, useEffect } from 'react'
import { Code2, Copy, Download, CheckCircle, AlertCircle, Merge } from 'lucide-react'

interface JSONSectionProps {
  extractedData: any[]
  currentExtraction?: any
  allExtractedArtists: any[]
}

export default function JSONSection({ extractedData, currentExtraction, allExtractedArtists }: JSONSectionProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [selectedPersonIndex, setSelectedPersonIndex] = useState(0)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState<number | null>(null)
  const [persistedArtists, setPersistedArtists] = useState<any[]>([])
  const [copiedVenue, setCopiedVenue] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cosportal_artists')
    if (stored) {
      try {
        setPersistedArtists(JSON.parse(stored))
      } catch {}
    }
  }, [])

  // Save to localStorage when new extraction occurs
  useEffect(() => {
    if (extractedData && extractedData.length > 0) {
      setPersistedArtists(prev => {
        // Add new artists to the top, remove duplicates by a unique key (e.g., JSON.stringify)
        const newArtists = [...extractedData, ...prev]
        const seen = new Set()
        const deduped = []
        for (const artist of newArtists) {
          const key = JSON.stringify(artist)
          if (!seen.has(key)) {
            seen.add(key)
            deduped.push(artist)
          }
          if (deduped.length >= 10) break
        }
        localStorage.setItem('cosportal_artists', JSON.stringify(deduped))
        return deduped
      })
    }
  }, [extractedData])

  // Reset selected person when new data comes in
  useEffect(() => {
    if (extractedData.length > 0) {
      setSelectedPersonIndex(0)
      setSelectedDropdownIndex(null)
    }
  }, [extractedData])

  const copyToClipboard = async (data: any, index: number) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      setCopiedIndex(index)
      // Show "Copied!" inline for 2 seconds
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadJSON = (data: any, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getPersonName = (person: any) => {
    const firstName = person.givenName || ''
    const lastName = person.familyName || ''
    return `${firstName} ${lastName}`.trim() || 'Unknown Person'
  }

  const validateRequiredFields = (person: any) => {
    const requiredFields = [
      'familyName', 'givenName', 'nationality', 'passportNumber',
      'showDateStartDay', 'showDateStartMonth', 'showDateStartYear',
      'grossSalary'
    ]
    
    const missing = requiredFields.filter(field => !person[field])
    return {
      isValid: missing.length === 0,
      missingFields: missing
    }
  }

  const isMergedData = (person: any) => {
    return person.mergedFrom && (person.mergedFrom.artistDetails || person.mergedFrom.itinerary)
  }

  const getMergeInfo = (person: any) => {
    if (!isMergedData(person)) return null
    
    const mergeInfo = person.mergedFrom
    return {
      hasArtistDetails: !!mergeInfo.artistDetails,
      hasItinerary: !!mergeInfo.itinerary,
      artistDetailsPDF: mergeInfo.artistDetails,
      itineraryPDF: mergeInfo.itinerary,
      artistDetailsEmail: mergeInfo.artistDetailsEmail,
      itineraryEmail: mergeInfo.itineraryEmail
    }
  }

  // Helper to format event dates as DD-MONTH-YY
  const formatEventDate = (day: any, month: any, year: any) => {
    if (!day || !month || !year) return ''
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    const m = months[Number(month)] || month
    return `${day}-${m}-${String(year).slice(-2)}`
  }

  // Only show non-personal, non-sensitive fields in the summary
  const summaryFields = [
    'nationality', 'countryOfBirth', 'countryOfResidence',
    'showDateStartDay', 'showDateStartMonth', 'showDateStartYear',
    'showDateEndDay', 'showDateEndMonth', 'showDateEndYear',
    'jobTitle', 'jobType', 'summaryOfJobDescription',
    'creativeCodeCompliance', 'certifyMaintenance'
  ];

  // Determine which list to show: extractedData (current) or allExtractedArtists (dropdown)
  const peopleList = selectedDropdownIndex === null ? extractedData : persistedArtists
  const personIndex = selectedDropdownIndex === null ? selectedPersonIndex : selectedDropdownIndex

  // In the summary rendering, only show the required fields
  const venue = peopleList[personIndex]?.venue || ''
  const venueAddress = peopleList[personIndex]?.venueAddress || ''
  const eventStart = formatEventDate(peopleList[personIndex]?.showDateStartDay, peopleList[personIndex]?.showDateStartMonth, peopleList[personIndex]?.showDateStartYear)
  const eventEnd = formatEventDate(peopleList[personIndex]?.showDateEndDay, peopleList[personIndex]?.showDateEndMonth, peopleList[personIndex]?.showDateEndYear)

  return (
    <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5" style={{ color: '#58fca9' }} />
          <h2 className="text-lg font-semibold text-white">JSON Output</h2>
          {peopleList.length > 0 && (
            <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">
              {peopleList.length} person{peopleList.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Dropdown for all extracted artists */}
      {persistedArtists.length > 0 && (
        <div className="mb-4">
          <label className="text-sm text-gray-300 mr-2">Previously extracted artists:</label>
          <select
            className="bg-gray-800 text-white rounded px-2 py-1"
            value={selectedDropdownIndex !== null ? selectedDropdownIndex : ''}
            onChange={e => {
              const idx = e.target.value === '' ? null : Number(e.target.value)
              setSelectedDropdownIndex(idx)
            }}
          >
            <option value="">Current Extraction</option>
            {persistedArtists.map((person, idx) => (
              <option key={idx} value={idx}>
                {getPersonName(person)}
              </option>
            ))}
          </select>
        </div>
      )}

      {peopleList.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No extracted data available</p>
          <p className="text-sm mt-1">Process PDF files to generate JSON output</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Person Selector */}
          {peopleList.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {peopleList.map((person, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (selectedDropdownIndex === null) setSelectedPersonIndex(index)
                    else setSelectedDropdownIndex(index)
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    (selectedDropdownIndex === null ? selectedPersonIndex : selectedDropdownIndex) === index
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {getPersonName(person)}
                  {isMergedData(person) && <Merge className="h-3 w-3" />}
                </button>
              ))}
            </div>
          )}

          {/* Current Person Data */}
          {peopleList[personIndex] && (
            <div className="space-y-4">
              {/* Merge Status */}
              {(() => {
                const mergeInfo = getMergeInfo(peopleList[personIndex])
                if (mergeInfo) {
                  return (
                    <div className="p-3 rounded-lg border bg-blue-900/20 border-blue-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Merge className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">
                          Merged Data
                        </span>
                      </div>
                      <div className="text-sm text-blue-300 space-y-1">
                        {mergeInfo.hasArtistDetails && (
                          <p>Artist Details: {mergeInfo.artistDetailsPDF}</p>
                        )}
                        {mergeInfo.hasItinerary && (
                          <p>Itinerary: {mergeInfo.itineraryPDF}</p>
                        )}
                        {!mergeInfo.hasItinerary && (
                          <p className="text-yellow-400">No itinerary found - using artist details only</p>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Validation Status */}
              {(() => {
                const validation = validateRequiredFields(peopleList[personIndex])
                return (
                  <div className={`p-3 rounded-lg border ${
                    validation.isValid
                      ? 'bg-green-900/20 border-green-700/50'
                      : 'bg-yellow-900/20 border-yellow-700/50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {validation.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        validation.isValid ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {validation.isValid ? 'All required fields present' : 'Missing required fields'}
                      </span>
                    </div>
                    {!validation.isValid && (
                      <p className="text-sm text-yellow-300">
                        Missing: {validation.missingFields.join(', ')}
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Remove the old summary rendering. Only render the new summary and Copy JSON button after the dropdown and before the JSON output. */}
              {peopleList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-white text-base font-semibold">Nationality: <span className="text-[#58fca9]">{peopleList[personIndex]?.nationality || ''}</span></div>
                      <div className="text-white text-base font-semibold">Event Dates: <span className="text-[#58fca9]">{eventStart} - {eventEnd}</span></div>
                      <div className="text-white text-base font-semibold flex items-center gap-2">
                        Venue: <span className="text-[#58fca9]">{venue} {venueAddress}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${venue} ${venueAddress}`.trim());
                            setCopiedVenue(true);
                            setTimeout(() => setCopiedVenue(false), 2000);
                          }}
                          className="ml-2 px-2 py-0.5 rounded border border-[#58fca9] text-xs text-[#58fca9] hover:bg-[#58fca9]/10 transition-all"
                        >
                          <Copy className="inline h-3 w-3 mr-1" />Copy Venue
                        </button>
                        {copiedVenue && (
                          <span className="ml-2 text-xs text-[#58fca9]">Copied!</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => copyToClipboard(peopleList[personIndex], personIndex)}
                      className="bg-[#332740] border border-white text-white px-6 py-2 rounded text-sm font-semibold hover:bg-[#241a36] transition-all"
                      style={{ minWidth: 120 }}
                    >
                      Copy JSON
                    </button>
                    {copiedIndex === personIndex && (
                      <span className="ml-2 text-xs text-[#58fca9] self-center">Copied!</span>
                    )}
                  </div>
                </div>
              )}

              {/* JSON Display */}
              <div className="bg-gray-900/60 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono">
                  {JSON.stringify(peopleList[personIndex], null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Current Extraction Info */}
          {currentExtraction && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <p className="text-blue-400 text-sm">
                Latest extraction from: <span className="font-medium">{currentExtraction.filename}</span>
                {currentExtraction.notes && (
                  <span className="block mt-1 text-yellow-400">{currentExtraction.notes}</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}