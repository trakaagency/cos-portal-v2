'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  filename: string;
}

export default function PDFViewer({ isOpen, onClose, pdfUrl, filename }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pdfRef = useRef<any>(null);

  const renderPage = async (pageNum: number, currentScale: number) => {
    if (!pdfRef.current) return;
    
    try {
      const page = await pdfRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      // Create a new canvas context to avoid reuse issues
      const context = canvas.getContext('2d');
      if (!context) return;

      // Clear the canvas completely
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      const viewport = page.getViewport({ scale: currentScale });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      // Create render task and wait for completion
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
      setCurrentPage(pageNum);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    // Create a new abort controller for this operation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cancel any existing render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        // Check if operation was aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Load PDF.js dynamically
        const pdfjsLib = await import('pdfjs-dist');
        
        // Use local worker file to avoid CDN issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        let pdfData;
        if (pdfUrl.startsWith('data:')) {
          // Handle base64 data URL
          const base64Data = pdfUrl.split(',')[1];
          console.log('Base64 data length:', base64Data.length);
          console.log('Base64 data preview:', base64Data.substring(0, 100));
          
          try {
            // Clean the base64 data - remove any whitespace or invalid characters
            let cleanBase64 = base64Data.replace(/[\s\n\r]/g, '');
            
            // Handle URL-safe base64 encoding (replace - with + and _ with /)
            cleanBase64 = cleanBase64.replace(/-/g, '+').replace(/_/g, '/');
            
            // Add padding if needed
            while (cleanBase64.length % 4) {
              cleanBase64 += '=';
            }
            
            pdfData = atob(cleanBase64);
            console.log('Successfully decoded base64 data, length:', pdfData.length);
          } catch (error) {
            console.error('Error decoding base64 data:', error);
            console.error('Base64 data that failed:', base64Data.substring(0, 200));
            throw new Error('Invalid base64 data format');
          }
        } else {
          // Handle regular URL
          const response = await fetch(pdfUrl);
          pdfData = await response.arrayBuffer();
        }

        // Check if operation was aborted
        if (abortController.signal.aborted) {
          return;
        }

        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        pdfRef.current = pdf;
        setTotalPages(pdf.numPages);
        
        await renderPage(1, scale);
        
        // Check if operation was aborted after rendering
        if (abortController.signal.aborted) {
          return;
        }
        
        setLoading(false);
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Error loading PDF:', err);
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    };

    loadPDF();

    // Cleanup function
    return () => {
      abortController.abort();
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full bg-white overflow-hidden">
        {/* Close Button - Always Accessible */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-60 bg-red-500 hover:bg-red-600 text-white rounded-full p-3 shadow-lg transition-colors"
          title="Close PDF"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h3 className="text-xl font-semibold text-gray-900 truncate">
              {filename}
            </h3>
            {totalPages > 1 && (
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-gray-100 border border-gray-300 rounded px-2 py-1">
              <button
                onClick={() => {
                  const newScale = Math.max(0.5, scale - 0.25);
                  setScale(newScale);
                  renderPage(currentPage, newScale);
                }}
                className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                title="Zoom Out"
              >
                <span className="text-sm font-bold">−</span>
              </button>
              <span className="text-sm text-gray-700 min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => {
                  const newScale = Math.min(3, scale + 0.25);
                  setScale(newScale);
                  renderPage(currentPage, newScale);
                }}
                className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                title="Zoom In"
              >
                <span className="text-sm font-bold">+</span>
              </button>
            </div>
            
            {/* Page Navigation */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-1 bg-gray-100 border border-gray-300 rounded px-2 py-1">
                <button
                  onClick={() => {
                    if (currentPage > 1) {
                      renderPage(currentPage - 1, scale);
                    }
                  }}
                  disabled={currentPage <= 1}
                  className="p-1 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                  title="Previous Page"
                >
                  <span className="text-sm">‹</span>
                </button>
                <span className="text-sm text-gray-700 px-2">
                  {currentPage}
                </span>
                <button
                  onClick={() => {
                    if (currentPage < totalPages) {
                      renderPage(currentPage + 1, scale);
                    }
                  }}
                  disabled={currentPage >= totalPages}
                  className="p-1 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                  title="Next Page"
                >
                  <span className="text-sm">›</span>
                </button>
              </div>
            )}
            
            <a
              href={pdfUrl}
              download={filename}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 relative bg-gray-50">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-gray-500">Loading PDF...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-red-500">{error}</div>
            </div>
          )}
          <div className="flex justify-center items-center h-full p-4">
            <canvas ref={canvasRef} className="border border-gray-300 shadow-lg bg-white max-w-full max-h-full object-contain rounded" />
          </div>
        </div>
      </div>
    </div>
  );
} 