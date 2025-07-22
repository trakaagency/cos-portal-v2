'use client'

import { useState, useEffect } from 'react'
import { Activity, Copy, Upload, Mail, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface Artist {
  familyName?: string
  givenName?: string
  passportNumber?: string
  nationality?: string
  venueAddress?: string
  showDateStartDay?: string
  showDateStartMonth?: string
  showDateStartYear?: string
  showDateEndDay?: string
  showDateEndMonth?: string
  showDateEndYear?: string
  grossSalary?: string
  countryOfBirth?: string
  sourceEmailId?: string
  sourceEmailSubject?: string
  sourceEmailFrom?: string
  [key: string]: any
}

interface ArtistWithStatus extends Artist {
  id: string
  status: 'pending' | 'processing' | 'approved'
  visaImageUrl?: string
  visaDocuments?: Array<{
    url: string
    filename: string
    type: string
  }>
  emailId?: string
  recipientEmail?: string
}

interface CombinedTrackerSectionProps {
  allExtractedArtists?: Artist[]
}

export default function CombinedTrackerSection({ allExtractedArtists = [] }: CombinedTrackerSectionProps) {
  const [artists, setArtists] = useState<ArtistWithStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [creatingDraft, setCreatingDraft] = useState<string | null>(null)

  // Load saved artists from localStorage on component mount
  useEffect(() => {
    try {
      const savedArtists = localStorage.getItem('cos-portal-artists')
      if (savedArtists) {
        const parsed = JSON.parse(savedArtists)
        setArtists(parsed)
        console.log('Loaded saved artists from localStorage:', parsed.length)
      }
    } catch (error) {
      console.warn('Failed to load saved artists:', error)
    }
  }, [])

  // Save artists to localStorage whenever they change (but not on initial load)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    
    try {
      localStorage.setItem('cos-portal-artists', JSON.stringify(artists))
      console.log('Saved artists to localStorage:', artists.length)
    } catch (error) {
      console.warn('Failed to save artists:', error)
    }
  }, [artists, isInitialLoad])

  // Convert extracted artists to tracked artists with status
  useEffect(() => {
    console.log('🔍 CombinedTrackerSection received artists:', allExtractedArtists)
    console.log('🔍 Current artists state:', artists)
    
    // Debug: Log detailed information for each artist
    allExtractedArtists.forEach((artist, index) => {
      console.log(`🔍 Artist ${index} details:`, {
        name: `${artist.givenName} ${artist.familyName}`,
        passportNumber: artist.passportNumber,
        nationality: artist.nationality,
        sourceEmailId: artist.sourceEmailId,
        sourceEmailSubject: artist.sourceEmailSubject,
        sourceEmailFrom: artist.sourceEmailFrom
      })
    })
    
    if (allExtractedArtists && allExtractedArtists.length > 0) {
      console.log(`🔍 Processing ${allExtractedArtists.length} extracted artists`)
      
      const newArtists = allExtractedArtists.map((artist, index) => {
        console.log(`🔍 Processing artist ${index}:`, artist)
        
        // More flexible duplicate detection
        const existingArtist = artists.find(a => {
          // Check by passport number first (most reliable)
          if (artist.passportNumber && a.passportNumber && artist.passportNumber === a.passportNumber) {
            console.log(`🔍 Found existing artist by passport: ${artist.passportNumber}`)
            return true
          }
          
          // Check by exact name match
          if (artist.givenName && artist.familyName && 
              a.givenName && a.familyName &&
              artist.givenName === a.givenName && artist.familyName === a.familyName) {
            console.log(`🔍 Found existing artist by name: ${artist.givenName} ${artist.familyName}`)
            return true
          }
          
          return false
        })
        
        if (existingArtist) {
          console.log('🔍 Found existing artist:', existingArtist)
          return existingArtist
        }
        
        const newArtist = {
          ...artist,
          id: `artist-${Date.now()}-${index}`,
          status: 'pending' as const,
          emailId: '',
          recipientEmail: ''
        }
        console.log('🔍 Created new artist:', newArtist)
        return newArtist
      })
      
      setArtists(prev => {
        const combined = [...prev]
        let addedCount = 0
        
        newArtists.forEach(newArtist => {
          // More flexible duplicate detection for adding
          const exists = combined.some(a => {
            // Check by passport number first
            if (newArtist.passportNumber && a.passportNumber && newArtist.passportNumber === a.passportNumber) {
              return true
            }
            
            // Check by exact name match
            if (newArtist.givenName && newArtist.familyName && 
                a.givenName && a.familyName &&
                newArtist.givenName === a.givenName && newArtist.familyName === a.familyName) {
              return true
            }
            
            return false
          })
          
          if (!exists) {
            console.log('🔍 Adding new artist to state:', newArtist)
            combined.push(newArtist)
            addedCount++
          } else {
            console.log('🔍 Skipping duplicate artist:', newArtist)
          }
        })
        
        console.log(`🔍 Final artists state: ${combined.length} total, added ${addedCount} new artists`)
        return combined
      })
    } else {
      console.log('🔍 No extracted artists received')
    }
    // Don't clear artists if no extracted artists - keep existing saved artists
  }, [allExtractedArtists])

  const updateArtistStatus = (artistId: string, status: 'pending' | 'processing' | 'approved') => {
    setArtists(prev => prev.map(artist => 
      artist.id === artistId ? { ...artist, status } : artist
    ))
  }

  const deleteArtist = (artistId: string) => {
    const artistToDelete = artists.find(artist => artist.id === artistId)
    
    // Track deletion for admin analytics
    if (artistToDelete) {
      fetch('/api/admin/track-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: artistId,
          artistName: `${artistToDelete.givenName || ''} ${artistToDelete.familyName || ''}`.trim(),
          userId: 'current-user', // This would be the actual user ID in production
          userEmail: 'tommygra8@gmail.com' // This would be the actual user email in production
        })
      }).catch(err => console.error('Failed to track deletion:', err))
    }
    
    setArtists(prev => prev.filter(artist => artist.id !== artistId))
  }

  const handleCopyJSON = async (artist: ArtistWithStatus) => {
    try {
      const jsonData = {
        familyName: artist.familyName || '',
        givenName: artist.givenName || '',
        otherNames: artist.otherNames || '',
        nationality: artist.nationality || '',
        placeOfBirth: artist.placeOfBirth || '',
        countryOfBirth: artist.countryOfBirth || '',
        birthDay: artist.birthDay || '',
        birthMonth: artist.birthMonth || '',
        birthYear: artist.birthYear || '',
        sex: artist.sex || '',
        countryOfResidence: artist.countryOfResidence || '',
        passportNumber: artist.passportNumber || '',
        passportIssueDay: artist.passportIssueDay || '',
        passportIssueMonth: artist.passportIssueMonth || '',
        passportIssueYear: artist.passportIssueYear || '',
        passportExpiryDay: artist.passportExpiryDay || '',
        passportExpiryMonth: artist.passportExpiryMonth || '',
        passportExpiryYear: artist.passportExpiryYear || '',
        placeOfIssueOfPassport: artist.placeOfIssueOfPassport || '',
        address: artist.address || '',
        addressLine2: artist.addressLine2 || '',
        addressLine3: artist.addressLine3 || '',
        city: artist.city || '',
        county: artist.county || '',
        postcode: artist.postcode || '',
        country: artist.country || '',
        ukIdCardNumber: artist.ukIdCardNumber || '',
        ukNationalInsuranceNumber: artist.ukNationalInsuranceNumber || '',
        nationalIdCardNumber: artist.nationalIdCardNumber || '',
        employeeNumber: artist.employeeNumber || '',
        showDateStartDay: artist.showDateStartDay || '',
        showDateStartMonth: artist.showDateStartMonth || '',
        showDateStartYear: artist.showDateStartYear || '',
        showDateEndDay: artist.showDateEndDay || '',
        showDateEndMonth: artist.showDateEndMonth || '',
        showDateEndYear: artist.showDateEndYear || '',
        doesMigrantNeedToLeaveAndReenter: 'Y',
        totalWeeklyHours: '2',
        addPWSAddress: '',
        addWSAddress: '',
        jobTitle: 'Touring DJ',
        jobType: 'X3145',
        summaryOfJobDescription: `Internationally renowned touring DJ from ${artist.countryOfBirth || ''} performing in the UK as part of international tour. No impact on resident labor.`,
        forEach: 'PERF',
        grossSalary: artist.grossSalary || '',
        grossAllowances: '',
        allowanceDetails: '',
        creativeCodeCompliance: 'Creative Sector - Live Music - No Code of Conduct',
        certifyMaintenance: 'Y'
      }

      await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2))
      updateArtistStatus(artist.id, 'processing')
      alert('JSON copied to clipboard! Status updated to Processing.')
    } catch (err) {
      console.error('Failed to copy JSON:', err)
      alert('Failed to copy JSON to clipboard')
    }
  }

  const handleDocumentUpload = async (artist: ArtistWithStatus, file: File) => {
    if (!file) return
    setUploadingImage(artist.id)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('artistId', artist.id)
      formData.append('passportNumber', artist.passportNumber || '')
      formData.append('artistName', `${artist.givenName || ''} ${artist.familyName || ''}`.trim())
      const response = await fetch('/api/upload-visa-image', {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }
      
      // Update artist with new document
      setArtists(prev => prev.map(a => {
        if (a.id === artist.id) {
          const existingDocs = a.visaDocuments || []
          const newDoc = {
            url: result.imageUrl,
            filename: file.name,
            type: file.type
          }
          return {
            ...a,
            visaImageUrl: result.imageUrl, // Keep for backward compatibility
            visaDocuments: [...existingDocs, newDoc],
            status: 'approved' as const
          }
        }
        return a
      }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setUploadingImage(null)
    }
  }

  const handleCreateGmailDraft = async (artist: ArtistWithStatus) => {
    if (!artist.visaDocuments || artist.visaDocuments.length === 0) {
      alert('Please upload visa documents first')
      return
    }

    setCreatingDraft(artist.id)
    setError(null)

    try {
      // Email data flow is now working correctly - no need for debug alerts
      
      const requestBody = {
        artistId: artist.id,
        artistName: `${artist.givenName || ''} ${artist.familyName || ''}`.trim(),
        passportNumber: artist.passportNumber || '',
        visaDocuments: artist.visaDocuments,
        recipientEmail: artist.recipientEmail || '',
        originalEmailSubject: artist.sourceEmailSubject || 'Certificate of Sponsorship',
        originalEmailId: artist.sourceEmailId || null,
        originalEmailFrom: artist.sourceEmailFrom || '',
        showDateStartMonth: artist.showDateStartMonth || '',
        artist: artist
      }
      
      console.log('Creating Gmail draft with data:', requestBody)
      console.log('Artist source email data:', {
        sourceEmailId: artist.sourceEmailId,
        sourceEmailSubject: artist.sourceEmailSubject,
        sourceEmailFrom: artist.sourceEmailFrom
      })
      
      const response = await fetch('/api/create-gmail-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      if (!response.ok) {
        if (result.code === 'GMAIL_PERMISSION_ERROR' || result.code === 'GMAIL_SCOPE_ERROR') {
          throw new Error('Gmail permissions required. Please sign out and sign in again to grant Gmail access.')
        }
        throw new Error(result.error || 'Failed to create draft')
      }

      alert('Gmail draft created successfully!')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft')
    } finally {
      setCreatingDraft(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-[#332740]'
      case 'processing': return 'bg-[#5a4a6a]'
      case 'approved': return 'bg-[#43ffa4]'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'processing': return <AlertCircle className="h-4 w-4" />
      case 'approved': return <CheckCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatEventDate = (day: any, month: any, year: any) => {
    if (!day || !month || !year) return ''
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    const m = months[Number(month)] || month
    return `${day}-${m}-${String(year).slice(-2)}`
  }

  const getPersonName = (person: any) => {
    const firstName = person.givenName || ''
    const lastName = person.familyName || ''
    return `${firstName} ${lastName}`.trim() || 'Artist Name'
  }

  const getNationalityFlag = (nationality: string) => {
    if (!nationality) return '🏳️'
    
    const nationalityLower = nationality.toLowerCase()
    
    // Common nationality to flag mappings
    const flagMap: { [key: string]: string } = {
      'british': '🇬🇧',
      'english': '🇬🇧',
      'scottish': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'welsh': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
      'american': '🇺🇸',
      'usa': '🇺🇸',
      'canadian': '🇨🇦',
      'australian': '🇦🇺',
      'french': '🇫🇷',
      'german': '🇩🇪',
      'italian': '🇮🇹',
      'spanish': '🇪🇸',
      'portuguese': '🇵🇹',
      'dutch': '🇳🇱',
      'belgian': '🇧🇪',
      'swiss': '🇨🇭',
      'austrian': '🇦🇹',
      'swedish': '🇸🇪',
      'norwegian': '🇳🇴',
      'danish': '🇩🇰',
      'finnish': '🇫🇮',
      'polish': '🇵🇱',
      'czech': '🇨🇿',
      'slovak': '🇸🇰',
      'hungarian': '🇭🇺',
      'romanian': '🇷🇴',
      'bulgarian': '🇧🇬',
      'greek': '🇬🇷',
      'turkish': '🇹🇷',
      'russian': '🇷🇺',
      'ukrainian': '🇺🇦',
      'belarusian': '🇧🇾',
      'lithuanian': '🇱🇹',
      'latvian': '🇱🇻',
      'estonian': '🇪🇪',
      'japanese': '🇯🇵',
      'chinese': '🇨🇳',
      'korean': '🇰🇷',
      'indian': '🇮🇳',
      'pakistani': '🇵🇰',
      'bangladeshi': '🇧🇩',
      'sri lankan': '🇱🇰',
      'nepali': '🇳🇵',
      'afghan': '🇦🇫',
      'iranian': '🇮🇷',
      'iraqi': '🇮🇶',
      'syrian': '🇸🇾',
      'lebanese': '🇱🇧',
      'jordanian': '🇯🇴',
      'israeli': '🇮🇱',
      'palestinian': '🇵🇸',
      'egyptian': '🇪🇬',
      'libyan': '🇱🇾',
      'tunisian': '🇹🇳',
      'algerian': '🇩🇿',
      'moroccan': '🇲🇦',
      'sudanese': '🇸🇩',
      'ethiopian': '🇪🇹',
      'kenyan': '🇰🇪',
      'ugandan': '🇺🇬',
      'tanzanian': '🇹🇿',
      'nigerian': '🇳🇬',
      'ghanaian': '🇬🇭',
      'senegalese': '🇸🇳',
      'ivorian': '🇨🇮',
      'cameroonian': '🇨🇲',
      'congolese': '🇨🇩',
      'angolan': '🇦🇴',
      'zambian': '🇿🇲',
      'zimbabwean': '🇿🇼',
      'south african': '🇿🇦',
      'namibian': '🇳🇦',
      'botswanan': '🇧🇼',
      'lesotho': '🇱🇸',
      'eswatini': '🇸🇿',
      'mozambican': '🇲🇿',
      'malawian': '🇲🇼',
      'brazilian': '🇧🇷',
      'argentine': '🇦🇷',
      'chilean': '🇨🇱',
      'peruvian': '🇵🇪',
      'colombian': '🇨🇴',
      'venezuelan': '🇻🇪',
      'ecuadorian': '🇪🇨',
      'bolivian': '🇧🇴',
      'paraguayan': '🇵🇾',
      'uruguayan': '🇺🇾',
      'mexican': '🇲🇽',
      'guatemalan': '🇬🇹',
      'belizean': '🇧🇿',
      'honduran': '🇭🇳',
      'salvadoran': '🇸🇻',
      'nicaraguan': '🇳🇮',
      'costa rican': '🇨🇷',
      'panamanian': '🇵🇦',
      'cuban': '🇨🇺',
      'jamaican': '🇯🇲',
      'haitian': '🇭🇹',
      'dominican': '🇩🇴',
      'puerto rican': '🇵🇷',
      'trinidadian': '🇹🇹',
      'barbadian': '🇧🇧',
      'grenadian': '🇬🇩',
      'saint lucian': '🇱🇨',
      'saint vincentian': '🇻🇨',
      'antiguan': '🇦🇬',
      'saint kittsian': '🇰🇳',
      'montserratian': '🇲🇸',
      'anguillan': '🇦🇮',
      'british virgin islander': '🇻🇬',
      'cayman islander': '🇰🇾',
      'turks and caicos islander': '🇹🇨',
      'bermudian': '🇧🇲',
      'falkland islander': '🇫🇰',
      'gibraltarian': '🇬🇮',
      'isle of man': '🇮🇲',
      'guernsey': '🇬🇬',
      'jersey': '🇯🇪',
      'faroe islander': '🇫🇴',
      'greenlandic': '🇬🇱',
      'icelandic': '🇮🇸',
      'maldivian': '🇲🇻',
      'seychellois': '🇸🇨',
      'mauritian': '🇲🇺',
      'comorian': '🇰🇲',
      'madagascan': '🇲🇬',
      'malagasy': '🇲🇬'
    }
    
    // Try exact match first
    if (flagMap[nationalityLower]) {
      return flagMap[nationalityLower]
    }
    
    // Try partial matches
    for (const [key, flag] of Object.entries(flagMap)) {
      if (nationalityLower.includes(key) || key.includes(nationalityLower)) {
        return flag
      }
    }
    
    // Default flag for unknown nationalities
    return '🏳️'
  }

  // Calculate counts for progress tracker
  const pendingCount = artists.filter(a => a.status === 'pending').length
  const processingCount = artists.filter(a => a.status === 'processing').length
  const approvedCount = artists.filter(a => a.status === 'approved').length

  return (
    <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#43ffa4]" />
          <h2 className="text-lg font-semibold text-white">Progress Tracker</h2>
          {artists.length > 15 && (
            <span className="text-sm text-gray-400 ml-2">
              (Showing latest 15 of {artists.length} total)
            </span>
          )}
        </div>

      </div>

      {/* Progress Tracker Section - Left Side */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{pendingCount}</div>
          <div className="text-sm text-gray-300">Pending</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{processingCount}</div>
          <div className="text-sm text-gray-300">Processing</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{approvedCount}</div>
          <div className="text-sm text-gray-300">Approved</div>
        </div>
      </div>

      {/* Artist Entries Section - Right Side */}
      <div className="space-y-4">
        {artists.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No artists to track</p>
            <p className="text-sm mt-1">Process PDF files to generate artist entries</p>
          </div>
        ) : (
          // Show only the latest 15 artists to avoid loading issues
          artists.slice(-15).map((artist, index) => {
            const eventStart = formatEventDate(artist.showDateStartDay, artist.showDateStartMonth, artist.showDateStartYear)
            const eventEnd = formatEventDate(artist.showDateEndDay, artist.showDateEndMonth, artist.showDateEndYear)
            const dateRange = eventStart && eventEnd ? `${eventStart} - ${eventEnd}` : 'Date TBD'

            return (
              <div key={artist.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                <div className="flex items-center justify-between">
                  {/* Left Side: Name & Date */}
                  <div className="flex flex-col items-start">
                    <h3 className="text-lg font-semibold text-white">
                      {getPersonName(artist)}
                    </h3>
                    <span className="text-sm text-gray-300">{dateRange}</span>
                  </div>
                  
                  {/* Center: Venue Address & Copy Button */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-white mb-2">
                      {(() => {
                        const fullAddress = artist.venueAddress || artist.venue || artist.address || "No venue address available"
                        
                        // If the address contains multiple venues (separated by commas or other delimiters)
                        if (fullAddress.includes(',')) {
                          const venues = fullAddress.split(',').map((v: string) => v.trim()).filter((v: string) => v)
                          if (venues.length > 1) {
                            const firstVenue = venues[0]
                            const otherVenuesCount = venues.length - 1
                            return `${firstVenue} (+${otherVenuesCount} other venues)`
                          }
                        }
                        
                        return fullAddress
                      })()}
                    </div>
                    <button
                      onClick={(e) => {
                        // Copy only the first venue address
                        const fullAddress = artist.venueAddress || artist.venue || artist.address || "No venue address available";
                        let addressToCopy = fullAddress;
                        
                        // If multiple venues, copy only the first one
                        if (fullAddress.includes(',')) {
                          const venues = fullAddress.split(',').map((v: string) => v.trim()).filter((v: string) => v)
                          if (venues.length > 1) {
                            addressToCopy = venues[0]
                          }
                        }
                        
                        navigator.clipboard.writeText(addressToCopy);
                        // Optional: Show a brief success message
                        const button = e.currentTarget as HTMLButtonElement;
                        const originalText = button.innerHTML;
                        button.innerHTML = '<span>Copied!</span>';
                        setTimeout(() => {
                          button.innerHTML = originalText;
                        }, 1000);
                      }}
                      className="btn-gradient btn-small"
                      style={{ width: '264px' }}
                      title="Copy first venue address"
                    >
                      <span>Copy Venue Address</span>
                    </button>
                  </div>
                  
                  {/* Right Side: Action Buttons & Status Badge */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyJSON(artist)}
                        className="btn-gradient btn-small"
                      >
                        <span>Copy JSON</span>
                      </button>
                      <label className="btn-gradient btn-small cursor-pointer">
                        <span>
                          {uploadingImage === artist.id ? 'Uploading...' : 
                           artist.visaDocuments && artist.visaDocuments.length > 0 
                             ? `Upload Documents (${artist.visaDocuments.length})` 
                             : 'Upload Documents (PDF/Images)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf,.PDF,.doc,.docx,.DOC,.DOCX"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              Array.from(e.target.files).forEach(file => {
                                handleDocumentUpload(artist, file);
                              });
                            }
                          }}
                        />
                      </label>
                      <button
                        onClick={() => handleCreateGmailDraft(artist)}
                        disabled={creatingDraft === artist.id}
                        className="btn-gradient btn-small disabled:opacity-50"
                      >
                        <span>{creatingDraft === artist.id ? 'Creating...' : 'Draft Email'}</span>
                      </button>
                    </div>
                    
                    {/* Status Badge & Delete Button */}
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-lg ${getStatusColor(artist.status)} text-white text-xs font-medium flex items-center gap-1`}>
                        {getStatusIcon(artist.status)}
                        {artist.status.charAt(0).toUpperCase() + artist.status.slice(1)}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${getPersonName(artist)}? This cannot be undone.`)) {
                            deleteArtist(artist.id)
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                        title={`Delete ${getPersonName(artist)}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  )
} 