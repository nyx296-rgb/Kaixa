// HtmlViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api, { getAttachmentPreviewUrl } from '../../lib/api';
import DOMPurify from 'dompurify';
import { useZoom } from '../../hooks/useZoom';
import ZoomBar from '../ZoomBar';
import { ExternalLink } from 'lucide-react';

interface Props {
  attachment: Attachment;
}

const HtmlViewer: React.FC<Props> = ({ attachment }) => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
        const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const sanitized = DOMPurify.sanitize(raw, {
          USE_PROFILES: { html: true },
          ADD_TAGS: ['iframe', 'object', 'embed'],
          ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'],
        });
        setHtml(sanitized);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setError('Erro ao carregar conteúdo HTML.');
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [attachment.id]);

  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  body { margin: 0; padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  img { max-width: 100%; height: auto; }
  a { color: #60a5fa; }
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <div
      className="relative p-4 max-w-full max-h-[80vh] overflow-auto bg-[var(--bg-primary)] rounded-lg flex flex-col"
      ref={containerRef}
    >
      <div className="sticky top-0 right-0 z-10 self-end mb-2 bg-slate-900/80 backdrop-blur border border-white/10 rounded p-1 shadow-lg flex items-center gap-2">
        <ZoomBar
          zoom={zoom}
          zoomPercent={zoomPercent}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
        />
        <a
          href={getAttachmentPreviewUrl(attachment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all duration-100"
          title="Abrir HTML em nova aba"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {loading ? (
        <div className="text-slate-400">Carregando HTML…</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <div className="flex-1" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-same-origin"
            title={attachment.filename}
            className="w-full border-0 rounded bg-white min-h-[60vh]"
            style={{ height: '70vh' }}
          />
        </div>
      )}
    </div>
  );
};

export default HtmlViewer;
