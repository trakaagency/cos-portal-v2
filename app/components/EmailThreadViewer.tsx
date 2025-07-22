import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Paperclip, 
  Search, 
  X, 
  ChevronLeft,
  Clock,
  User,
  Users,
  FileText,
  Download
} from 'lucide-react';

interface ThreadMessage {
  id: string;
  sender: string;
  subject: string;
  timestamp: string;
  snippet: string;
  body: string;
  to: string;
  cc: string;
  attachments: any[];
  threadId: string;
}

interface EmailThreadViewerProps {
  threadId: string;
  onClose: () => void;
  initialEmail?: {
    id: string;
    subject: string;
    sender: string;
  };
}

export default function EmailThreadViewer({ 
  threadId, 
  onClose, 
  initialEmail 
}: EmailThreadViewerProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<ThreadMessage[]>([]);

  // Fetch thread messages
  useEffect(() => {
    const fetchThread = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/email-thread?threadId=${threadId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch thread');
        }
        
        const data = await response.json();
        setMessages(data.messages);
        setFilteredMessages(data.messages);
      } catch (err) {
        console.error('Error fetching thread:', err);
        setError('Failed to load email thread');
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [threadId]);

  // Filter messages based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMessages(messages);
      return;
    }

    const filtered = messages.filter(message => {
      const searchLower = searchTerm.toLowerCase();
      return (
        message.subject.toLowerCase().includes(searchLower) ||
        message.sender.toLowerCase().includes(searchLower) ||
        message.body.toLowerCase().includes(searchLower) ||
        message.snippet.toLowerCase().includes(searchLower) ||
        message.to.toLowerCase().includes(searchLower) ||
        message.cc.toLowerCase().includes(searchLower)
      );
    });

    setFilteredMessages(filtered);
  }, [searchTerm, messages]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-black px-1 rounded">$1</mark>');
  };

  const downloadAttachment = async (messageId: string, attachmentId: string, filename: string) => {
    try {
      const response = await fetch('/api/download-gmail-attachment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: messageId,
          attachmentId,
          filename
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download attachment:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#43ffa4] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Email Thread</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="text-center py-8 text-red-400">
            <p>{error}</p>
            <button
              onClick={onClose}
              className="mt-4 btn-gradient btn-small"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#332740] border border-[#43ffa4]/20 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Mail className="h-5 w-5 text-[#43ffa4]" />
            <h2 className="text-lg font-semibold text-white">Email Thread</h2>
            <span className="px-2 py-1 bg-[#43ffa4]/20 text-[#43ffa4] rounded-full text-xs">
              {filteredMessages.length} messages
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search through thread..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#43ffa4]"
          />
        </div>

        {/* Messages */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {searchTerm ? 'No messages found matching your search' : 'No messages in thread'}
              </p>
            </div>
          ) : (
            filteredMessages.map((message, index) => (
              <div
                key={message.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4"
              >
                {/* Message Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-[#43ffa4]" />
                      <span className="text-white font-medium text-sm">
                        {message.sender}
                      </span>
                    </div>
                    <h3 
                      className="text-white font-medium text-sm mb-1"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightSearchTerm(message.subject) 
                      }}
                    />
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(message.timestamp)}
                      </div>
                      {message.to && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          To: {message.to}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Attachments */}
                  {message.attachments.length > 0 && (
                    <div className="flex items-center space-x-1 text-green-400 flex-shrink-0">
                      <Paperclip className="w-3 h-3" />
                      <span className="text-xs">{message.attachments.length}</span>
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div className="mb-3">
                  <div 
                    className="text-gray-300 text-sm whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightSearchTerm(message.body || message.snippet) 
                    }}
                  />
                </div>

                {/* Attachments */}
                {message.attachments.length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Attachments ({message.attachments.length})
                    </h4>
                    <div className="space-y-2">
                      {message.attachments.map((attachment, attIndex) => (
                        <div
                          key={attIndex}
                          className="flex items-center justify-between bg-white/5 rounded p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-gray-300">
                              {attachment.filename}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({(attachment.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => downloadAttachment(message.id, attachment.id, attachment.filename)}
                            className="text-[#43ffa4] hover:text-[#43ffa4]/80 p-1"
                            title="Download attachment"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 