import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Mail, 
  Paperclip, 
  Search, 
  Filter, 
  Maximize2, 
  Minimize2, 
  Eye,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Zap,
  MessageSquare
} from 'lucide-react';
import EmailThreadViewer from './EmailThreadViewer';

interface Email {
  id: string;
  subject: string;
  sender: string;
  timestamp: string;
  attachments: any[];
  snippet?: string;
  threadId?: string;
  labelIds?: string[];
  category?: 'urgent' | 'standard' | 'low' | 'processed' | 'duplicate';
  priority?: number;
  aiAnalysis?: {
    confidence: number;
    reasoning: string;
    extractedInfo?: {
      artistName?: string;
      eventType?: string;
      venue?: string;
      dates?: string;
    };
  };
  isClosed?: boolean;
  closedAt?: string;
  isHidden?: boolean;
  hiddenAt?: string;
}

interface EmailSectionProps {
  emails: Email[];
  selectedEmails: string[];
  onEmailToggle: (emailId: string) => void;
  onRefresh: (isRefresh?: boolean) => void;
  loading: boolean;
  onExtractPDFs: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  pdfsOnly?: boolean;
  onPdfFilterToggle?: () => void;
  filterVisa?: boolean;
  onVisaFilterToggle?: () => void;
  filterLoading?: boolean;
  filterAttachments?: boolean;
  onAttachmentsFilterToggle?: () => void;
  refreshLoading: boolean;
}

export default function EmailSection({
  emails,
  selectedEmails,
  onEmailToggle,
  onRefresh,
  loading,
  onExtractPDFs,
  isExpanded = false,
  onToggleExpanded,
  pdfsOnly = true,
  onPdfFilterToggle,
  filterVisa = false,
  onVisaFilterToggle,
  filterLoading = false,
  filterAttachments = false,
  onAttachmentsFilterToggle,
  refreshLoading = false,
}: EmailSectionProps) {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [localEmails, setLocalEmails] = useState<Email[]>(emails);
  const [pdfSummaries, setPdfSummaries] = useState<{[key: string]: string}>({});
  const [selectedThread, setSelectedThread] = useState<{
    threadId: string;
    email: Email;
  } | null>(null);

  // Summarize PDF filenames using AI
  const summarizePdfNames = async (filenames: string[]) => {
    try {
      const response = await fetch('/api/summarize-pdf-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filenames }),
      });

      if (response.ok) {
        const data = await response.json();
        const newSummaries = { ...pdfSummaries };
        data.summaries.forEach((item: { original: string; summary: string }) => {
          newSummaries[item.original] = item.summary;
        });
        setPdfSummaries(newSummaries);
      }
    } catch (error) {
      console.error('Failed to summarize PDF names:', error);
    }
  };

  // Update local emails when props change
  useEffect(() => {
    // Load hidden emails from localStorage
    const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]');
    
    // Mark emails as hidden based on localStorage
    const emailsWithHiddenStatus = emails.map(email => ({
      ...email,
      isHidden: hiddenEmails.includes(email.id),
      hiddenAt: hiddenEmails.includes(email.id) ? new Date().toISOString() : undefined
    }));
    
    setLocalEmails(emailsWithHiddenStatus);
    
    // Generate PDF summaries for new emails
    const newFilenames = emails.flatMap(email => 
      email.attachments.map(att => att.filename)
    ).filter(filename => !pdfSummaries[filename]);
    
    if (newFilenames.length > 0) {
      summarizePdfNames(newFilenames);
    }
  }, [emails]);

  // Hide email (mark as hidden)
  const handleHideEmail = (emailId: string) => {
    // Store hidden emails in localStorage
    const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]');
    if (!hiddenEmails.includes(emailId)) {
      hiddenEmails.push(emailId);
      localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));
    }
    
    setLocalEmails(prev => prev.map(email => 
      email.id === emailId 
        ? { ...email, isHidden: true, hiddenAt: new Date().toISOString() }
        : email
    ));
  };

  // Show email (unmark as hidden)
  const handleShowEmail = (emailId: string) => {
    // Remove from localStorage
    const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]');
    const updatedHiddenEmails = hiddenEmails.filter((id: string) => id !== emailId);
    localStorage.setItem('hiddenEmails', JSON.stringify(updatedHiddenEmails));
    
    setLocalEmails(prev => prev.map(email => 
      email.id === emailId 
        ? { ...email, isHidden: false, hiddenAt: undefined }
        : email
    ));
  };

  // Handle select all/unselect all
  const handleSelectAll = () => {
    const visibleEmailIds = sortedEmails.map(email => email.id);
    const allVisibleSelected = visibleEmailIds.every(emailId => selectedEmails.includes(emailId));
    
    if (allVisibleSelected) {
      // Unselect all visible emails
      visibleEmailIds.forEach(emailId => {
        if (selectedEmails.includes(emailId)) {
          onEmailToggle(emailId);
        }
      });
    } else {
      // Select all visible emails
      visibleEmailIds.forEach(emailId => {
        if (!selectedEmails.includes(emailId)) {
          onEmailToggle(emailId);
        }
      });
    }
  };

  // Filter emails based on search and hidden status
  const filteredEmails = localEmails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If "Show hidden" is checked, only show hidden emails
    // If "Show hidden" is unchecked, only show non-hidden emails
    const matchesHiddenFilter = showHidden ? email.isHidden : !email.isHidden;
    
    return matchesSearch && matchesHiddenFilter;
  });

  // Ensure we always have emails to show if the user is logged in
  const displayEmails = filteredEmails.length > 0 ? filteredEmails : localEmails;

  // Sort emails by date (newest first) - ensure proper chronological order
  const sortedEmails = [...displayEmails].sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return dateB.getTime() - dateA.getTime();
  });

  // Handle unhide all
  const handleUnhideAll = () => {
    const hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails') || '[]');
    if (hiddenEmails.length > 0) {
      localStorage.removeItem('hiddenEmails');
      setLocalEmails(prev => prev.map(email => ({
        ...email,
        isHidden: false,
        hiddenAt: undefined
      })));
      // Reset the "Show hidden" toggle to show all emails
      setShowHidden(false);
    }
  };

  // Handle opening thread viewer
  const handleOpenThread = (email: Email) => {
    if (email.threadId) {
      setSelectedThread({
        threadId: email.threadId,
        email
      });
    }
  };

  // Handle closing thread viewer
  const handleCloseThread = () => {
    setSelectedThread(null);
  };

  // Handle PDF filter toggle
  const handlePdfFilterToggle = () => {
    if (onPdfFilterToggle) {
      onPdfFilterToggle();
    }
  };

  return (
    <div className={`
      bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6
      transition-all duration-300 ease-in-out
      ${isExpanded ? 'fixed inset-0 z-50' : 'relative'}
    `}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#43ffa4]" />
          <h2 className="text-lg font-semibold text-white">Email Inbox</h2>
          <span className="px-2 py-1 bg-[#43ffa4]/20 text-[#43ffa4] rounded-full text-xs">
            {sortedEmails.length}
          </span>
          {filterVisa && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
              Visa/CoS only
            </span>
          )}
          {!filterVisa && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
              All emails
            </span>
          )}
          {filterAttachments && (
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
              Attachments only
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* Select All/Unselect All Button */}
          <button
            onClick={handleSelectAll}
            className="btn-gradient btn-small"
          >
            <span>
              {sortedEmails.length > 0 && sortedEmails.every(email => selectedEmails.includes(email.id)) 
                ? 'Unselect All' 
                : 'Select All'
              }
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => onRefresh(true)}
            disabled={loading || refreshLoading}
            className="btn-gradient btn-small disabled:opacity-50"
          >
            <span>
              <RefreshCw className={`w-4 h-4 inline mr-1 ${refreshLoading ? 'animate-spin' : ''}`} />
              Refresh
            </span>
          </button>

          {/* Expand/Collapse Button */}
          <button
            onClick={onToggleExpanded}
            className="btn-gradient btn-small"
          >
            <span>
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </span>
          </button>
        </div>
      </div>
      <div className={`space-y-2 overflow-y-auto ${isExpanded ? 'max-h-[calc(100vh-120px)]' : 'max-h-[calc(100vh-300px)]'}`}>
        {loading || refreshLoading || filterLoading ? (
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
        ) : sortedEmails.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No emails found matching your criteria</p>
            <p className="text-xs mt-1">Select emails to begin processing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex items-center space-x-4 mb-4">
              {/* Visa Filter Toggle */}
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filterVisa}
                  onChange={onVisaFilterToggle}
                  disabled={filterLoading}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className={filterLoading ? 'opacity-50' : ''}>
                  Filter Visa/CoS emails only
                  {filterLoading && ' (loading...)'}
                </span>
              </label>
              
              {/* Attachments Filter Toggle */}
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filterAttachments}
                  onChange={onAttachmentsFilterToggle}
                  disabled={filterLoading}
                  className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 disabled:opacity-50"
                />
                <span className={filterLoading ? 'opacity-50' : ''}>
                  Attachments only
                  {filterLoading && ' (loading...)'}
                </span>
              </label>
              
              {/* Show Hidden Toggle */}
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span>Show hidden</span>
              </label>
              
              {showHidden && (
                <button
                  onClick={handleUnhideAll}
                  className="btn-gradient btn-small"
                >
                  <span>Unhide all</span>
                </button>
              )}
            </div>

            {/* Email List */}
            <div className="space-y-1">
              {sortedEmails.map((email) => (
                <div
                  key={email.id}
                  className={`
                    p-2 rounded-lg border transition-all duration-200 cursor-pointer
                    ${selectedEmails.includes(email.id)
                      ? 'bg-[#43ffa4]/20 border-[#43ffa4]/40 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }
                    ${email.isHidden ? 'opacity-60' : ''}
                  `}
                  onClick={() => onEmailToggle(email.id)}
                >
                  <div className="flex items-center justify-between">
                    {/* Left side - Main content */}
                    <div className="flex-1 min-w-0 flex items-center space-x-3">
                      {/* Subject */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">
                          {email.subject}
                        </h3>
                        {/* Band/Artist Name */}
                        {email.aiAnalysis?.extractedInfo?.artistName && (
                          <div className="text-[#43ffa4] text-xs mt-0.5">
                            {email.aiAnalysis.extractedInfo.artistName}
                          </div>
                        )}
                      </div>
                      
                      {/* Attachments indicator */}
                      {email.attachments.length > 0 && (
                        <div className="flex items-center space-x-1 text-green-400 flex-shrink-0">
                          <Paperclip className="w-3 h-3" />
                          <span className="text-xs">{email.attachments.length}</span>
                        </div>
                      )}
                      
                      {/* AI Analysis indicator */}
                      {email.aiAnalysis?.extractedInfo && (
                        <div className="flex items-center space-x-1 text-purple-400 flex-shrink-0">
                          <Zap className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    
                    {/* Right side - Timestamp and actions */}
                    <div className="flex items-center space-x-2 ml-3">
                      {/* Timestamp */}
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(email.timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1">
                        {/* Thread Button */}
                        {email.threadId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenThread(email);
                            }}
                            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                            title="View thread"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Hide/Show Button */}
                        {email.isHidden ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowEmail(email.id);
                            }}
                            className="p-1 text-green-400 hover:text-green-300 transition-colors"
                            title="Show email"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHideEmail(email.id);
                            }}
                            className="p-1 text-[#43ffa4] hover:text-[#43ffa4]/80 transition-colors"
                            title="Hide email"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Email Snippet/Body Text */}
                  {email.snippet && (
                    <div className="mt-2 text-xs text-gray-300 leading-relaxed max-w-full">
                      <div className="text-gray-300 overflow-hidden">
                        <div className="line-clamp-2" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {email.snippet}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Sender Email Address - Bottom Right */}
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-gray-500">
                      {email.sender.includes('@') ? email.sender : ''}
                    </span>
                  </div>
                  
                  {/* Expanded details on hover/selection */}
                  {(selectedEmails.includes(email.id) || email.attachments.length > 0 || email.aiAnalysis?.extractedInfo) && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      {/* PDF Attachments */}
                      {email.attachments.length > 0 && (
                        <div className="mb-1">
                          <div className="text-xs text-green-300 mb-1 flex items-center">
                            <Paperclip className="w-3 h-3 mr-1" />
                            PDF Attachments:
                          </div>
                          <div className="text-xs text-green-400 space-y-0.5">
                            {email.attachments.map((attachment, index) => {
                              const summary = pdfSummaries[attachment.filename] || attachment.filename;
                              return (
                                <div key={index} className="flex items-center space-x-2">
                                  <span className="text-green-400">•</span>
                                  <span className="truncate text-green-400">{summary}</span>
                                  <span className="text-gray-500">({Math.round(attachment.size / 1024)}KB)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* AI Analysis Preview */}
                      {email.aiAnalysis?.extractedInfo && (
                        <div className="mb-1">
                          <div className="text-xs text-purple-300 mb-1 flex items-center">
                            <Zap className="w-3 h-3 mr-1" />
                            AI Analysis:
                          </div>
                          <div className="text-xs text-gray-300">
                            {email.aiAnalysis.extractedInfo.artistName && (
                              <span className="mr-3">Artist: {email.aiAnalysis.extractedInfo.artistName}</span>
                            )}
                            {email.aiAnalysis.extractedInfo.eventType && (
                              <span className="mr-3">Event: {email.aiAnalysis.extractedInfo.eventType}</span>
                            )}
                            {email.aiAnalysis.extractedInfo.venue && (
                              <span>Venue: {email.aiAnalysis.extractedInfo.venue}</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Hidden status */}
                      {email.isHidden && (
                        <div className="text-xs text-gray-500">
                          Hidden {new Date(email.hiddenAt!).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Thread Viewer Modal */}
      {selectedThread && (
        <EmailThreadViewer
          threadId={selectedThread.threadId}
          onClose={handleCloseThread}
          initialEmail={selectedThread.email}
        />
      )}
    </div>
  )
}