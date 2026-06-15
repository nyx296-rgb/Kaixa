// TextViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api from '../../lib/api';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useZoom } from '../../hooks/useZoom';
import ZoomBar from '../ZoomBar';

interface Props {
  attachment: Attachment;
}

const TextViewer: React.FC<Props> = ({ attachment }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { zoom, zoomIn, zoomOut, resetZoom, zoomPercent } = useZoom({
    min: 0.5,
    max: 3.0,
    step: 0.1,
    initial: 1.0,
    scrollTarget: containerRef,
  });

  useEffect(() => {
    let cancelled = false;
    api.get(`/attachment/${attachment.id}?inline=true`, { responseType: 'text' })
      .then((res) => {
        if (cancelled) return;
        const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        setContent(txt);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setContent('Erro ao carregar conteúdo.');
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [attachment.id]);

  // Determine language based on mime type for highlighting
  const languageMap: Record<string, string> = {
    'application/json': 'json',
    'application/xml': 'xml',
    'text/css': 'css',
    'text/html': 'html',
    'text/javascript': 'javascript',
    'application/javascript': 'javascript',
    'text/plain': 'text',
    'text/markdown': 'markdown',
    'text/csv': 'csv',
    // default fallback
    default: 'text',
  };
  const lang =
    languageMap[attachment.mime_type] || languageMap['default'];

  // Base font size for the text
  const baseFontSize = 13;
  const currentFontSize = Math.round(baseFontSize * zoom);

  return (
    <div 
      className="relative p-4 max-w-full max-h-[80vh] overflow-auto bg-[var(--bg-primary)] rounded-lg flex flex-col"
      ref={containerRef}
    >
      <div className="sticky top-0 right-0 z-10 self-end mb-2 bg-slate-900/80 backdrop-blur border border-white/10 rounded p-1 shadow-lg">
        <ZoomBar
          zoom={zoom}
          zoomPercent={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
        />
      </div>

      {loading ? (
        <div className="text-slate-400">Carregando texto…</div>
      ) : (
        <div className="flex-1" style={{ fontSize: `${currentFontSize}px` }}>
          <SyntaxHighlighter 
            language={lang} 
            style={darcula} 
            wrapLongLines={true}
            customStyle={{ margin: 0, borderRadius: '6px', fontSize: 'inherit' }}
            codeTagProps={{ style: { fontSize: 'inherit' } }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export default TextViewer;
