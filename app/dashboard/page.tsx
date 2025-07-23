'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Import components with proper error handling
const EmailSection = dynamic(() => import('../components/EmailSection'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-96"></div>
});

const PDFSection = dynamic(() => import('../components/PDFSection'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-96"></div>
});

const CombinedTrackerSection = dynamic(() => import('../components/CombinedTrackerSection'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-96"></div>
});

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
}

interface PDFFile {
  id: string;
  filename: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: any;
}

interface Application {
  id: string;
  pdfId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: any;
  timestamp: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Check if user is admin
  const isAdmin = session?.user?.email === 'trakaagency@gmail.com';
  
  // State management
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for expandable email section
  const [emailSectionExpanded, setEmailSectionExpanded] = useState(false);
  
  // PDF filter state
  const [pdfsOnly, setPdfsOnly] = useState(true);
  const [filterVisa, setFilterVisa] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterAttachments, setFilterAttachments] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Load initial data
  useEffect(() => {
    if (session) {
      // Track user activity for admin
      fetch('/api/admin/track-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'dashboard_access',
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
      
      fetchEmails();
      fetchPDFs();
      fetchApplications();
    }
  }, [session, filterVisa, filterAttachments]);

  // Fetch emails from Gmail API
  const fetchEmails = async (isRefresh?: boolean) => {
    setLoading(true);
    if (isRefresh) setRefreshLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/emails?filterVisa=${filterVisa}&attachmentsOnly=${filterAttachments}`);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle authentication errors
        if (response.status === 401 && errorData.code === 'REFRESH_TOKEN_ERROR') {
          setError('Authentication expired. Please sign out and sign in again.');
          setLoading(false);
          if (isRefresh) setRefreshLoading(false);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to fetch emails');
      }
      
      const data = await response.json();
      
      // Merge with existing closed status from database
      const emailsWithStatus = await Promise.all(
        data.emails.map(async (email: Email) => {
          try {
            const statusResponse = await fetch(`/api/emails/status?emailId=${email.id}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              return {
                ...email,
                isClosed: statusData.isClosed,
                closedAt: statusData.closedAt
              };
            }
          } catch (err) {
            console.error('Failed to fetch email status:', err);
          }
          return email;
        })
      );
      
      setEmails(emailsWithStatus);
    } catch (err) {
      console.error('Error fetching emails:', err);
      setError('Failed to load emails. Please try again.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshLoading(false);
      if (filterLoading) setFilterLoading(false);
    }
  };

  // Fetch PDFs from database
  const fetchPDFs = async () => {
    try {
      const response = await fetch('/api/debug-pdfs');
      if (response.ok) {
        const data = await response.json();
        setPdfs(data.pdfs || []);
      }
    } catch (err) {
      console.error('Error fetching PDFs:', err);
    }
  };

  // Fetch applications from database
  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/applications');
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  // Handle email selection
  const handleEmailToggle = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  // Handle PDF extraction
  const handleExtractPDFs = async () => {
    if (selectedEmails.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First, download PDFs from selected emails
      const downloadPromises = selectedEmails.map(emailId => 
        fetch('/api/download-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId })
        })
      );
      
      const downloadResults = await Promise.all(downloadPromises);
      
      // Check if all downloads were successful
      const failedDownloads = downloadResults.filter(result => !result.ok);
      if (failedDownloads.length > 0) {
        throw new Error(`Failed to download ${failedDownloads.length} PDFs`);
      }
      
      // Extract text from downloaded PDFs
      const extractPromises = downloadResults.map(async (result) => {
        const data = await result.json();
        return fetch('/api/extract-pdf-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfId: data.pdfId })
        });
      });
      
      const extractResults = await Promise.all(extractPromises);
      
      // Process extraction results
      const extractedDataResults = await Promise.all(
        extractResults.map(result => result.json())
      );
      
      // Collect all extracted data from all PDFs
      const allExtractedData = extractedDataResults.flatMap(result => 
        result.extractedData || []
      );
      
      // Update extracted data state with all results
      if (allExtractedData.length > 0) {
        setExtractedData(allExtractedData);
      }
      
      // Refresh data
      await fetchPDFs();
      await fetchApplications();
      
      // Clear selection
      setSelectedEmails([]);
      
    } catch (err) {
      console.error('Error extracting PDFs:', err);
      setError('Failed to extract PDFs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle email section expansion toggle
  const handleToggleEmailExpanded = () => {
    setEmailSectionExpanded(!emailSectionExpanded);
  };

  const handlePdfFilterToggle = () => {
    setPdfsOnly(!pdfsOnly);
    // Fetch emails with new filter after a short delay to avoid excessive calls
    setTimeout(() => {
      fetchEmails();
    }, 100);
  };

  const handleVisaFilterToggle = () => {
    console.log('Visa filter toggle clicked. Current state:', filterVisa);
    
    // Prevent multiple rapid toggles
    if (filterLoading) {
      console.log('Filter change already in progress, ignoring toggle');
      return;
    }
    
    const newFilterState = !filterVisa;
    setFilterVisa(newFilterState);
    setFilterLoading(true);
    
    // Clear emails immediately to prevent glitchy display
    setEmails([]);
    setSelectedEmails([]);
  };

  const handleAttachmentsFilterToggle = () => {
    console.log('Attachments filter toggle clicked. Current state:', filterAttachments);
    
    // Prevent multiple rapid toggles
    if (filterLoading) {
      console.log('Filter change already in progress, ignoring toggle');
      return;
    }
    
    const newFilterState = !filterAttachments;
    setFilterAttachments(newFilterState);
    setFilterLoading(true);
    
    // Clear emails immediately to prevent glitchy display
    setEmails([]);
    setSelectedEmails([]);
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              CoS Portal Dashboard
            </h1>
            <p className="text-gray-300">
              AI-powered Certificate of Sponsorship management
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Welcome, {session?.user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <a
                href="/admin"
                className="px-4 py-2 rounded text-white border border-[#43ffa4] hover:bg-[#43ffa4] hover:text-black transition-colors"
              >
                Admin
              </a>
            )}
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded text-white"
              style={{ backgroundColor: '#43ffa4', color: '#000' }}
            >
              Sign Out
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => fetchEmails()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {emailSectionExpanded ? (
          /* Expanded Email Section - Full Screen */
          <EmailSection
            emails={emails}
            selectedEmails={selectedEmails}
            onEmailToggle={handleEmailToggle}
            onRefresh={fetchEmails}
            loading={loading}
            onExtractPDFs={handleExtractPDFs}
            isExpanded={true}
            onToggleExpanded={handleToggleEmailExpanded}
            pdfsOnly={pdfsOnly}
            onPdfFilterToggle={handlePdfFilterToggle}
            filterVisa={filterVisa}
            onVisaFilterToggle={handleVisaFilterToggle}
            filterLoading={filterLoading}
            filterAttachments={filterAttachments}
            onAttachmentsFilterToggle={handleAttachmentsFilterToggle}
            refreshLoading={refreshLoading}
          />
        ) : (
          /* Normal Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Row */}
            <div className="lg:col-span-1">
              <EmailSection
                emails={emails}
                selectedEmails={selectedEmails}
                onEmailToggle={handleEmailToggle}
                onRefresh={fetchEmails}
                loading={loading}
                onExtractPDFs={handleExtractPDFs}
                isExpanded={false}
                onToggleExpanded={handleToggleEmailExpanded}
                pdfsOnly={pdfsOnly}
                onPdfFilterToggle={handlePdfFilterToggle}
                filterVisa={filterVisa}
                onVisaFilterToggle={handleVisaFilterToggle}
                filterLoading={filterLoading}
                filterAttachments={filterAttachments}
                onAttachmentsFilterToggle={handleAttachmentsFilterToggle}
                refreshLoading={refreshLoading}
              />
            </div>
            
            <div className="lg:col-span-1">
              <PDFSection
                selectedEmails={emails.filter(email => selectedEmails.includes(email.id))}
                onExtractComplete={(data) => {
                  console.log('Dashboard received extracted data:', data)
                  // Handle both merged data and individual extraction data
                  let extractedArray = []
                  if (data.isMerged && data.data) {
                    // This is merged data from multiple PDFs
                    extractedArray = Array.isArray(data.data) ? data.data : [data.data]
                  } else if (data.extractedData) {
                    // This is individual extraction data
                    extractedArray = Array.isArray(data.extractedData) ? data.extractedData : [data.extractedData]
                  } else if (Array.isArray(data)) {
                    // Data is already an array
                    extractedArray = data
                  } else {
                    // Fallback
                    extractedArray = [data]
                  }
                  
                  console.log('🔍 Dashboard processed extracted data:', extractedArray.map((item: any) => ({
                    name: `${item.givenName} ${item.familyName}`,
                    sourceEmailId: item.sourceEmailId,
                    sourceEmailSubject: item.sourceEmailSubject,
                    sourceEmailFrom: item.sourceEmailFrom
                  })))
                  
                  console.log('Setting extracted data:', extractedArray)
                  setExtractedData(extractedArray)
                }}
              />
            </div>

            {/* Bottom Row - Combined Progress Tracker and JSON Section */}
            <div className="lg:col-span-2">
              <CombinedTrackerSection
                allExtractedArtists={extractedData || []}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>CoS Portal v1.0</p>
        </div>
      </div>
    </div>
  );
}