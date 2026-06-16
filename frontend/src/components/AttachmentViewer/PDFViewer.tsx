// PDFViewer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api, { getAttachmentUrl } from '../../lib/api';
import { Loader2 } from 'lucide-react';
import { useZoom } from '../../hooks/useZoom';
import ZoomBar from '../ZoomBar';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface Props {
  attachment: Attachment;
}

const PDFViewer: React.FC<Props> = ({ attachment }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { zoom, zoomIn, zoomOut, resetZoom, zoomPercent } = useZoom({
    min: 0.5,
    max: 3.0,
    step: 0.2,
    initial: 1.0,
    scrollTarget: containerRef,
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    
    const fetchPdf = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/attachment/${attachment.id}`, { responseType: 'blob' });
        if (cancelled) return;
        
        objectUrl = URL.createObjectURL(response.data);
        setPdfUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch PDF', err);
          setError('Falha ao carregar o PDF (Não autorizado ou arquivo inválido)');
          setLoading(false);
        }
      }
    };
    
    fetchPdf();
    
    return () => { 
      cancelled = true; 
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setPageNumber(1);
  };

  const goPrev = () => setPageNumber((p) => Math.max(p - 1, 1));
  const goNext = () => setPageNumber((p) => Math.min(p + 1, numPages));

  // Base width for the PDF page
  const baseWidth = 800;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <a
          href={getAttachmentUrl(attachment.id)}
          download
          className="text-[12px] text-blue-400 hover:text-blue-300 underline"
        >
          Download {attachment.filename}
        </a>
      </div>
    );
  }

  return (
    <div 
      className="relative flex flex-col items-center bg-[var(--bg-primary)] p-4 rounded-lg max-w-full max-h-[80vh] overflow-auto"
      ref={containerRef}
    >
      <div className="sticky top-0 right-4 z-10 self-end mb-2 bg-slate-900/80 backdrop-blur border border-white/10 rounded p-1 shadow-lg">
        <ZoomBar
          zoom={zoom}
          zoomPercent={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
        />
      </div>

      {loading && !pdfUrl && (
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Loader2 className="animate-spin" size={20} />
          Baixando PDF…
        </div>
      )}
      {pdfUrl && (
        <div className="bg-white rounded-sm shadow-sm overflow-hidden" style={{ minHeight: '50vh', minWidth: '50vw' }}>
          <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={console.error} loading={(
            <div className="flex items-center justify-center h-full text-slate-400 py-10">
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}>
            <Page
              pageNumber={pageNumber}
              width={baseWidth * zoom}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        </div>
      )}
      {numPages > 1 && (
        <div className="flex items-center gap-4 mt-4 sticky bottom-0 bg-slate-900/90 px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <button
            onClick={goPrev}
            disabled={pageNumber <= 1}
            className="px-2 py-1 bg-gray-700 text-slate-200 rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
          >
            Anterior
          </button>
          <span className="text-slate-300 text-[13px] font-medium">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goNext}
            disabled={pageNumber >= numPages}
            className="px-2 py-1 bg-gray-700 text-slate-200 rounded disabled:opacity-50 hover:bg-gray-600 transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
