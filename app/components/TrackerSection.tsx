'use client'

import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'

interface Artist {
  familyName?: string
  givenName?: string
  passportNumber?: string
  nationality?: string
  showDateStartDay?: string
  showDateStartMonth?: string
  showDateStartYear?: string
  showDateEndDay?: string
  showDateEndMonth?: string
  showDateEndYear?: string
  grossSalary?: string
  countryOfBirth?: string
  [key: string]: any
}

interface ArtistWithStatus extends Artist {
  id: string
  status: 'pending' | 'processing' | 'approved'
  visaImageUrl?: string
  emailId?: string
  recipientEmail?: string
}

interface TrackerSectionProps {
  allExtractedArtists?: Artist[]
}

export default function TrackerSection({ allExtractedArtists = [] }: TrackerSectionProps) {
  const [artists, setArtists] = useState<ArtistWithStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [creatingDraft, setCreatingDraft] = useState<string | null>(null)

  // Convert extracted artists to tracked artists with status
  useEffect(() => {
    if (allExtractedArtists.length > 0) {
      const newArtists = allExtractedArtists.map((artist, index) => {
        const existingArtist = artists.find(a => 
          a.passportNumber === artist.passportNumber ||
          (a.givenName === artist.givenName && a.familyName === artist.familyName)
        )
        
        if (existingArtist) {
          return existingArtist
        }
        
        return {
          ...artist,
          id: `artist-${Date.now()}-${index}`,
          status: 'pending' as const,
          emailId: '', // Will be set when email is selected
          recipientEmail: '' // Will be set when email is selected
        }
      })
      
      setArtists(prev => {
        const combined = [...prev]
        newArtists.forEach(newArtist => {
          const exists = combined.some(a => 
            a.passportNumber === newArtist.passportNumber ||
            (a.givenName === newArtist.givenName && a.familyName === newArtist.familyName)
          )
          if (!exists) {
            combined.push(newArtist)
          }
        })
        return combined
      })
    }
  }, [allExtractedArtists])

  const updateArtistStatus = (artistId: string, status: 'pending' | 'processing' | 'approved') => {
    setArtists(prev => prev.map(artist => 
      artist.id === artistId ? { ...artist, status } : artist
    ))
  }

  const handleCopyJSON = async (artist: ArtistWithStatus) => {
    try {
      // Create a clean JSON object for the artist
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

      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2))
      
      // Update status to processing
      updateArtistStatus(artist.id, 'processing')
      
      // Show success message
      alert('JSON copied to clipboard! Status updated to Processing.')
    } catch (err) {
      console.error('Failed to copy JSON:', err)
      alert('Failed to copy JSON to clipboard')
    }
  }

  const handleImageUpload = async (artist: ArtistWithStatus, file: File) => {
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
      setArtists(prev => prev.map(a =>
        a.id === artist.id
          ? { ...a, visaImageUrl: result.imageUrl, status: 'approved' as const }
          : a
      ))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingImage(null)
    }
  }

  const handleCreateGmailDraft = async (artist: ArtistWithStatus) => {
    if (!artist.visaImageUrl) {
      alert('Please upload a visa image first')
      return
    }

    setCreatingDraft(artist.id)
    setError(null)

    try {
      const response = await fetch('/api/create-gmail-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artistId: artist.id,
          artistName: `${artist.givenName || ''} ${artist.familyName || ''}`.trim(),
          passportNumber: artist.passportNumber || '',
          visaImageUrl: artist.visaImageUrl,
          recipientEmail: artist.recipientEmail || '',
          nationality: artist.nationality || '',
          eventDates: `${artist.showDateStartDay}/${artist.showDateStartMonth}/${artist.showDateStartYear} - ${artist.showDateEndDay}/${artist.showDateEndMonth}/${artist.showDateEndYear}`,
          salary: artist.grossSalary || ''
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create draft: ${response.statusText}`)
      }

      const result = await response.json()
      alert('Gmail draft created successfully! Check your drafts folder.')
    } catch (err) {
      console.error('Failed to create Gmail draft:', err)
      setError(err instanceof Error ? err.message : 'Failed to create Gmail draft')
    } finally {
      setCreatingDraft(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-400/20'
      case 'processing': return 'text-blue-400 bg-blue-400/20'
      case 'approved': return 'text-green-400 bg-green-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'processing': return '⚡'
      case 'approved': return '✅'
      default: return '❓'
    }
  }

  const statusCounts = artists.reduce((acc, artist) => {
    acc[artist.status] = (acc[artist.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-sm border border-indigo-500/20 rounded-xl p-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-500/10 rounded flex items-center justify-center">
            <Activity className="h-4 w-4" style={{ color: '#58fca9' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Progress Tracker</h2>
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/5 rounded p-2 text-center border border-white/10">
          <div className="text-lg font-bold text-yellow-400">{statusCounts.pending || 0}</div>
          <div className="text-gray-400 text-xs">Pending</div>
        </div>
        <div className="bg-white/5 rounded p-2 text-center border border-white/10">
          <div className="text-lg font-bold text-blue-400">{statusCounts.processing || 0}</div>
          <div className="text-gray-400 text-xs">Processing</div>
        </div>
        <div className="bg-white/5 rounded p-2 text-center border border-white/10">
          <div className="text-lg font-bold text-green-400">{statusCounts.approved || 0}</div>
          <div className="text-gray-400 text-xs">Approved</div>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {artists.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-gray-300">No artists found</div>
            <div className="text-gray-500 text-xs mt-1">Artists will appear here after PDF extraction</div>
          </div>
        ) : (
          artists.map((artist) => (
            <div
              key={artist.id}
              className="bg-white/5 border border-gray-600/30 rounded p-2 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white text-sm">
                  {artist.givenName} {artist.familyName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(artist.status)}`}>
                  {artist.status.charAt(0).toUpperCase() + artist.status.slice(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <div className="text-gray-400">Nationality</div>
                  <div className="text-white">{artist.nationality || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Dates</div>
                  <div className="text-white">
                    {artist.showDateStartDay}/{artist.showDateStartMonth}/{artist.showDateStartYear} - {artist.showDateEndDay}/{artist.showDateEndMonth}/{artist.showDateEndYear}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-600/30">
                <button
                  onClick={() => handleCopyJSON(artist)}
                  disabled={artist.status === 'approved'}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs border border-blue-500/20 transition-all disabled:opacity-50"
                >
                  Copy JSON
                </button>
                <label className="bg-green-500/10 hover:bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs border border-green-500/20 transition-all cursor-pointer">
                  Upload Visa
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(artist, file)
                    }}
                    className="hidden"
                    disabled={uploadingImage === artist.id}
                  />
                </label>
                {error && (
                  <div className="mt-1 text-xs text-red-400">{error}</div>
                )}
                {artist.visaImageUrl && (
                  <button
                    onClick={() => handleCreateGmailDraft(artist)}
                    disabled={creatingDraft === artist.id}
                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs border border-purple-500/20 transition-all disabled:opacity-50"
                  >
                    {creatingDraft === artist.id ? 'Creating...' : 'Gmail Draft'}
                  </button>
                )}
              </div>
              {uploadingImage === artist.id && (
                <div className="mt-1 text-xs text-blue-400">Uploading image...</div>
              )}
              {artist.visaImageUrl && (
                <div className="mt-1 text-xs text-green-400">Visa image uploaded</div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="mt-2 text-gray-400 text-xs">
        • Real-time artist tracking • Total: {artists.length} artists
      </div>
    </div>
  )
}