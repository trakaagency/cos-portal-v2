// components/EmailSection.tsx - Fixed version
'use client'

import { useState, useEffect } from 'react'

interface Email {
  id: string
  subject: string
  sender: string
  snippet: string
  hasAttachments: boolean
  timestamp: string
  isCoSRelated: boolean
  threadId: string
}

interface EmailSectionProps {
  selectedEmails: string[]
  setSelectedEmails: (emails: string[]) => void
}

export default function EmailSection({ selectedEmails, setSelectedEmails }: EmailSectionProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'cos' | 'unprocessed'>('cos')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Mock data for now - we'll replace this with real Gmail integration after fixing errors
  useEffect(() => {
    const mockEmails: Email[] = [
      {
        id: '1',
        subject: 'Certificate of Sponsorship Request for DJ Luminous',
        sender: 'michael@agency.com',
        snippet: 'Hi, I need a CoS for DJ Luminous for our upcoming festival...',
        hasAttachments: true,
        timestamp: '2025-07-04T10:30:00Z',
        isCoSRelated: true,
        threadId: 'thread1'
      },
      {
        id: '2',
        subject: 'Urgent CoS needed for upcoming festival',
        sender: 'sarah@events.co.uk',
        snippet: 'We need certificates for DJ Beatrix, Producer Kamon, and Sound Collective...',
        hasAttachments: true,
        timestamp: '2025-07-04T09:15:00Z',
        isCoSRelated: true,
        threadId: 'thread2'
      }
    ]
    
    setTimeout(() => {
      setEmails(mockEmails)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredEmails = emails.filter(email => {
    switch (filter) {
      case 'cos': return email.isCoSRelated
      case 'unprocessed': return email.isCoSRelated && !selectedEmails.includes(email.id)
      default: return true
    }
  })

  const toggleEmailSelection = (emailId: string) => {
    if (selectedEmails.includes(emailId)) {
      setSelectedEmails(selectedEmails.filter(id => id !== emailId))
    } else {
      setSelectedEmails([...selectedEmails, emailId])
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">CoS Emails</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-sm text-slate-400">Mock Data (Testing Mode)</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('cos')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'cos' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            CoS Only
          </button>
          <button
            onClick={() => setFilter('unprocessed')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'unprocessed' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Unprocessed
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto pr-2">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => toggleEmailSelection(email.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedEmails.includes(email.id)
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${email.isCoSRelated ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                    <h3 className="font-medium text-white text-sm leading-tight">{email.subject}</h3>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    {email.hasAttachments && (
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                    <span className="text-xs text-slate-400">{formatTimestamp(email.timestamp)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-2">From: {email.sender}</p>
                <p className="text-sm text-slate-300 line-clamp-2">{email.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {selectedEmails.length} selected • {filteredEmails.length} total
          </span>
          <button className="btn-primary text-xs py-2 px-4">
            Test Mode
          </button>
        </div>
      </div>
    </div>
  )
}
