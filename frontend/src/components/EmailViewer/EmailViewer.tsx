// components/EmailViewer/EmailViewer.tsx
// Email detail viewer with sandboxed HTML rendering

import React, { useRef, useEffect, useState } from 'react';
import {
  FileDown, Paperclip, Download, Eye, AlertTriangle, Loader2,
  Archive, ChevronRight, FileText, Image, FileType, Table,
  Presentation, Globe, FileArchive, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import { getAttachmentUrl } from '../../lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import { useAttachmentViewer } from '../../hooks/useAttachmentViewer';
import AttachmentViewerModal from '../AttachmentViewer/AttachmentViewerModal';
import { useZoom } from '../../hooks/useZoom';
import { useTextHighlight } from '../../hooks/useTextHighlight';
import TagPicker from '../TagPicker';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInlineViewableType(filename: string, mimeType: string): 'image' | 'pdf' | 'text' | 'html' | 'spreadsheet' | 'office' | null {
  const name = filename.toLowerCase();
  const mime = mimeType.toLowerCase();
  
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) {
    return 'image';
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (mime === 'text/html' || /\.(html?|xhtml)$/i.test(name)) {
    return 'html';
  }
  if (
    mime.startsWith('text/') || 
    mime === 'application/json' ||
    /\.(txt|log|json|csv|xml|ini|md)$/i.test(name)
  ) {
    return 'text';
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'text/csv' ||
    /\.(xlsx?|csv)$/i.test(name)
  ) {
    return 'spreadsheet';
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    /\.(docx?|pptx?)$/i.test(name)
  ) {
    return 'office';
  }
  return null;
}

function EmailHeader({ onExportPdf, onExportZip, isZipping, hasAttachments }: {
  onExportPdf: () => void;
  onExportZip: () => void;
  isZipping: boolean;
  hasAttachments: boolean;
}) {
  const email = useEmailStore((s) => s.emailDetail);
  const selectedFolderPath = useEmailStore((s) => s.selectedFolderPath);
  const activeMailbox = useEmailStore((s) => s.activeMailbox);
  if (!email) return null;

  const dateStr = email.date_ts
    ? format(new Date(email.date_ts * 1000), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : 'Data desconhecida';

  const folderName = selectedFolderPath?.split('/').pop() || 'INBOX';
  const mailboxName = activeMailbox?.name || 'Mailbox';

  return (
    <div className="px-5 py-4 border-b border-[var(--border-primary)] animate-fadeIn">
      {/* Top row: Breadcrumb + Action buttons */}
      <div className="flex items-start justify-between gap-4 mb-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] flex-wrap">
          <span>{mailboxName}</span>
          <ChevronRight size={10} />
          <span>{folderName}</span>
          <ChevronRight size={10} />
          <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{email.subject || '(Sem assunto)'}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
            }}
            title="Exportar como PDF (P)"
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <FileDown size={13} /> PDF
          </button>

          {hasAttachments && (
            <button
              onClick={onExportZip}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
              }}
              title="Baixar e-mail + anexos como .zip"
              onMouseEnter={e => { if (!isZipping) { e.currentTarget.style.borderColor = 'var(--accent-emerald)'; e.currentTarget.style.color = 'var(--accent-emerald)'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {isZipping ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              {isZipping ? 'ZIP…' : 'ZIP'}
            </button>
          )}
        </div>
      </div>

      {/* Subject */}
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-3 leading-snug">
        {email.subject || '(Sem assunto)'}
      </h2>

      {/* Meta grid */}
      <div className="space-y-1.5 text-[12px]">
        <div className="flex gap-2">
          <span className="text-[var(--text-muted)] w-12 flex-shrink-0 font-medium">De:</span>
          <span className="text-[var(--text-primary)]">{email.sender}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[var(--text-muted)] w-12 flex-shrink-0 font-medium">Para:</span>
          <span className="text-[var(--text-secondary)]">{email.recipients?.join(', ')}</span>
        </div>
        {email.cc && email.cc.length > 0 && (
          <div className="flex gap-2">
            <span className="text-[var(--text-muted)] w-12 flex-shrink-0 font-medium">CC:</span>
            <span className="text-[var(--text-secondary)]">{email.cc.join(', ')}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-[var(--text-muted)] w-12 flex-shrink-0 font-medium">Data:</span>
          <span className="text-[var(--text-secondary)]">{dateStr}</span>
        </div>
      </div>

      {/* Importance & parse error badges */}
      <div className="flex items-center gap-2 mt-2">
        {email.importance === 'high' && (
          <span className="badge badge-red text-[10px]">
            <AlertTriangle size={10} className="mr-1" /> Alta prioridade
          </span>
        )}
        {email.parse_error && (
          <span className="badge badge-red text-[10px]">
            ⚠ Erro de parsing parcial
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="mt-3">
        <TagPicker emailId={email.id} emailTags={email.tags || []} />
      </div>
    </div>
  );
}

function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(filename)) {
    return { icon: <Image size={14} />, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/15' };
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { icon: <FileText size={14} />, color: 'text-[var(--accent-rose)]', bg: 'bg-[var(--accent-rose)]/15' };
  }
  if (/\.(xlsx?|csv)$/i.test(filename)) {
    return { icon: <Table size={14} />, color: 'text-[var(--accent-emerald)]', bg: 'bg-[var(--accent-emerald)]/15' };
  }
  if (/\.(docx?|pptx?)$/i.test(filename)) {
    return { icon: <Presentation size={14} />, color: 'text-[var(--accent-amber)]', bg: 'bg-[var(--accent-amber)]/15' };
  }
  if (/\.(html?|xhtml)$/i.test(filename)) {
    return { icon: <Globe size={14} />, color: 'text-[var(--accent-indigo)]', bg: 'bg-[var(--accent-indigo)]/15' };
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(filename)) {
    return { icon: <FileArchive size={14} />, color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--text-secondary)]/15' };
  }
  return { icon: <FileType size={14} />, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--text-muted)]/15' };
}

function AttachmentBar({ onPreview }: { onPreview: (att: any) => void }) {
  const email = useEmailStore((s) => s.emailDetail);
  if (!email?.attachments?.length) return null;

  return (
    <div className="px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 animate-fadeIn">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 mr-1">
          <Paperclip size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] font-medium">
            {email.attachments.length} anexo{email.attachments.length > 1 ? 's' : ''}
          </span>
        </div>
        {email.attachments.map((att) => {
          const viewableType = getInlineViewableType(att.filename, att.mime_type);
          const fileIcon = getFileIcon(att.filename, att.mime_type);
          
          return (
            <div
              key={att.id}
              className="
                group flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg
                bg-[var(--bg-tertiary)] border border-[var(--border-primary)]
                text-sm text-[var(--text-secondary)]
                hover:border-[var(--accent-blue)]/30
                transition-all duration-150
              "
            >
              <div className={`p-1.5 rounded-md ${fileIcon.bg} ${fileIcon.color}`}>
                {fileIcon.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate max-w-[140px] font-medium text-[12px] leading-tight text-[var(--text-primary)]">{att.filename}</span>
                <span className="text-[var(--text-muted)] text-[10px] leading-tight">{formatBytes(att.size)}</span>
              </div>
              
              <div className="flex items-center gap-1 ml-1">
                {viewableType && (
                  <button
                    onClick={() => onPreview(att)}
                    className="
                      p-1.5 rounded-md 
                      text-[var(--text-muted)] hover:text-[var(--accent-blue)] 
                      hover:bg-[var(--accent-blue)]/10 
                      transition-all duration-100 cursor-pointer
                    "
                    title="Visualizar"
                  >
                    <Eye size={14} />
                  </button>
                )}
                <a
                  href={getAttachmentUrl(att.id)}
                  download={att.filename}
                  className="
                    p-1.5 rounded-md 
                    text-[var(--text-muted)] hover:text-[var(--text-primary)] 
                    hover:bg-[var(--bg-hover)] 
                    transition-all duration-100
                  "
                  title="Download"
                >
                  <Download size={14} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProcessedResult {
  html: string;
  hasExternalImages: boolean;
}

function processAndSanitizeHtml(html: string, showImages: boolean): ProcessedResult {
  if (typeof window === 'undefined') return { html, hasExternalImages: false };

  let hasExternalImages = false;

  // 1. Sanitizar com DOMPurify (remove scripts, on*, javascript:, objects, applets, iframes etc)
  // Adicionamos um hook para interceptar URLs de imagens e estilos e bloquear se necessário.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'img') {
      const el = node as Element;
      const src = el.getAttribute('src') || '';
      const isExternal = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//');
      if (isExternal) {
        hasExternalImages = true;
        if (!showImages) {
          el.setAttribute('data-blocked-src', src);
          el.setAttribute('src', "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect width='18' height='18' x='3' y='3' rx='2' ry='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>");
          el.setAttribute('style', 'border: 1px dashed #334155; border-radius: 4px; padding: 8px; background-color: #1e293b;');
        }
      }
    }
  });

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      const style = data.attrValue || '';
      if (style.includes('url(') && (style.includes('http://') || style.includes('https://') || style.includes('//'))) {
        hasExternalImages = true;
        if (!showImages) {
          const newStyle = style.replace(/url\((['"]?)(https?:\/\/|\/\/)([^'")]+)\1\)/gi, 'url()');
          node.setAttribute('style', newStyle);
          node.setAttribute('data-blocked-bg', style);
          data.attrValue = newStyle; // Update DOMPurify internal state
        }
      }
    }
  });

  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    ADD_ATTR: ['target', 'data-blocked-src', 'data-blocked-bg'],
  });

  // Limpar os hooks após o uso para não afetar outras instâncias
  DOMPurify.removeAllHooks();

  return {
    html: cleanHtml as string,
    hasExternalImages
  };
}

function EmailBody() {
  const email = useEmailStore((s) => s.emailDetail);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [showExternalImages, setShowExternalImages] = useState(false);
  const [hasExternalImages, setHasExternalImages] = useState(false);
  const [processedHtml, setProcessedHtml] = useState('');

  const { zoom, zoomIn, zoomOut, resetZoom, zoomPercent, bindWheel } = useZoom({
    min: 0.5, max: 2.5, step: 0.1, initial: 1.0, scrollTarget: bodyContainerRef,
  });

  const {
    highlights, selectionRange, menuPos, handleSelection, addHighlight, removeHighlight, getHighlightedTextChunks, clearSelection
  } = useTextHighlight({
    emailId: email?.id || null,
    containerRef: bodyContainerRef,
    text: email?.body_text || '',
  });

  // Auto-select mode: html if available, else text
  useEffect(() => {
    if (email && !email.body_html && email.body_text) {
      setViewMode('text');
    } else if (email && email.body_html) {
      setViewMode('html');
    }
  }, [email?.id]);

  useEffect(() => {
    setShowExternalImages(false);
    setHasExternalImages(false);
    clearSelection();
  }, [email?.id, viewMode]);

  useEffect(() => {
    if (!email) return;
    const { html, hasExternalImages: externalFound } = processAndSanitizeHtml(
      email.body_html || '',
      showExternalImages
    );
    setProcessedHtml(html);
    setHasExternalImages(externalFound);
  }, [email?.body_html, showExternalImages]);

  useEffect(() => {
    if (!iframeRef.current || !email) return;
    if (viewMode === 'html' && processedHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        // Read theme CSS vars from document root — respects dark/light switching
        const root = document.documentElement;
        const cs = getComputedStyle(root);
        const iframeBg   = cs.getPropertyValue('--iframe-bg').trim()   || '#0D1117';
        const iframeText = cs.getPropertyValue('--iframe-text').trim() || '#E6EDF3';
        const iframeLink = cs.getPropertyValue('--iframe-link').trim() || '#60a5fa';
        const iframeCodeBg = cs.getPropertyValue('--iframe-code-bg').trim() || '#161B22';
        const iframeBq   = cs.getPropertyValue('--iframe-blockquote').trim() || '#21262D';
        const iframeBqTx = cs.getPropertyValue('--iframe-blockquote-text').trim() || '#8B949E';
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13px;
                line-height: 1.65;
                color: ${iframeText};
                background: ${iframeBg};
                padding: 20px;
                margin: 0;
                word-wrap: break-word;
                overflow-wrap: break-word;
                transform: scale(${zoom});
                transform-origin: top left;
                width: ${100 / zoom}%;
              }
              a { color: ${iframeLink}; text-decoration: none; }
              a:hover { text-decoration: underline; }
              img { max-width: 100%; height: auto; border-radius: 4px; }
              table { max-width: 100%; border-collapse: collapse; }
              td, th { padding: 6px 8px; border: 1px solid ${iframeBq}; }
              pre, code {
                white-space: pre-wrap;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 12px;
                background: ${iframeCodeBg};
                padding: 2px 5px;
                border-radius: 4px;
              }
              pre { padding: 12px 16px; }
              blockquote {
                border-left: 3px solid ${iframeBq};
                padding-left: 14px;
                margin: 10px 0;
                color: ${iframeBqTx};
              }
              hr { border: none; border-top: 1px solid ${iframeBq}; margin: 16px 0; }
            </style>
          </head>
          <body>${processedHtml}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [email, viewMode, processedHtml, zoom]);

  if (!email) return null;

  const hasHtml = !!email.body_html;
  const hasText = !!email.body_text;

  const textFontSize = Math.round(13 * zoom);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={bodyContainerRef}>
      {/* Privacy Warning Banner */}
      {hasHtml && hasExternalImages && !showExternalImages && (
        <div className="flex-shrink-0 px-5 py-2 bg-[var(--accent-blue)]/10 border-b border-[var(--accent-blue)]/20 flex items-center justify-between text-[11px] text-[var(--accent-blue)] animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-[13px]">🛡️</span>
            <span>Para proteger sua privacidade, imagens externas foram bloqueadas.</span>
          </div>
          <button
            onClick={() => setShowExternalImages(true)}
            className="
              px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider
              text-[var(--accent-blue)] bg-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/30
              border border-[var(--accent-blue)]/30 hover:border-[var(--accent-blue)]/40
              transition-all duration-150 cursor-pointer
            "
          >
            Carregar Imagens
          </button>
        </div>
      )}

      {/* Body content */}
      <div className="flex-1 relative overflow-hidden flex flex-col" onMouseUp={viewMode === 'text' ? handleSelection : undefined}>
        {viewMode === 'html' && hasHtml ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin allow-scripts"
            className="flex-1 w-full border-none bg-[#0D1117]"
            title="Email body"
          />
        ) : hasText ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <pre
              className="text-[var(--text-secondary)] whitespace-pre-wrap font-sans leading-relaxed transition-[font-size] duration-150"
              style={{ fontSize: `${textFontSize}px` }}
            >
              {getHighlightedTextChunks().map((chunk, i) => (
                chunk.highlight ? (
                  <mark 
                    key={i} 
                    className="relative group cursor-pointer"
                    style={{ backgroundColor: chunk.highlight.color === 'yellow' ? '#facc15' : chunk.highlight.color, color: '#000' }}
                    onClick={() => removeHighlight(chunk.highlight!.id)}
                    title="Clique para remover"
                  >
                    {chunk.text}
                  </mark>
                ) : (
                  <span key={i}>{chunk.text}</span>
                )
              ))}
            </pre>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-xs">
            (Sem conteúdo para exibir)
          </div>
        )}

        {/* Selection Context Menu */}
        {menuPos && selectionRange && viewMode === 'text' && (
          <div 
            className="fixed z-50 bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-xl rounded-lg p-1.5 flex items-center gap-1.5 animate-scaleIn origin-bottom"
            style={{ left: menuPos.x, top: menuPos.y, transform: 'translate(-50%, -100%)' }}
          >
            <span className="text-[10px] text-[var(--text-muted)] px-1 uppercase tracking-wider font-semibold select-none">Marcar</span>
            <div className="w-px h-4 bg-[var(--border-primary)] mx-0.5"></div>
            {['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa'].map((color) => (
              <button
                key={color}
                className="w-5 h-5 rounded-full hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  addHighlight(color);
                }}
              />
            ))}
          </div>
        )}

        {/* Floating zoom control — appears on hover at bottom-right */}
        {zoom !== 1.0 ? (
          <div
            className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg shadow-lg animate-fadeIn"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              padding: '3px 4px',
              zIndex: 40,
            }}
          >
            <button onClick={zoomOut} disabled={zoom <= 0.5} title="Diminuir" className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer">
              <ZoomOut size={12} />
            </button>
            <span
              className="text-[10px] font-mono text-[var(--text-secondary)] px-1 cursor-pointer select-none"
              onClick={resetZoom}
              title="Clique para resetar"
            >{zoomPercent}</span>
            <button onClick={zoomIn} disabled={zoom >= 2.5} title="Aumentar" className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer">
              <ZoomIn size={12} />
            </button>
            <div className="w-px h-3 bg-[var(--border-primary)] mx-0.5" />
            <button onClick={resetZoom} title="Resetar zoom" className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              <RotateCcw size={11} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}



export default function EmailViewer() {
  const emailDetail = useEmailStore((s) => s.emailDetail);
  const isLoadingDetail = useEmailStore((s) => s.isLoadingDetail);
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId);
  const exportSelectedPdf = useEmailStore((s) => s.exportSelectedPdf);
  const exportEmailZip = useEmailStore((s) => s.exportEmailZip);
  const { openViewer, closeViewer } = useAttachmentViewer();
  const [isZipping, setIsZipping] = useState(false);

  const handleExportZip = async () => {
    if (!selectedEmailId) return;
    setIsZipping(true);
    try { await exportEmailZip(selectedEmailId); }
    finally { setIsZipping(false); }
  };

  // Reset preview when email changes
  useEffect(() => {
    closeViewer();
  }, [selectedEmailId]);

  if (isLoadingDetail) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <div className="p-5 space-y-3">
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-3 w-56" />
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="flex-1 p-5">
          <div className="skeleton h-4 w-full mb-2" />
          <div className="skeleton h-4 w-full mb-2" />
          <div className="skeleton h-4 w-5/6 mb-2" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!emailDetail) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-20">✉️</div>
          <p className="text-[var(--text-muted)] text-sm">Selecione um email para visualizar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <EmailHeader
        onExportPdf={exportSelectedPdf}
        onExportZip={handleExportZip}
        isZipping={isZipping}
        hasAttachments={(emailDetail?.attachments?.length ?? 0) > 0}
      />
      <AttachmentBar onPreview={openViewer} />
      <EmailBody />
      <AttachmentViewerModal />
    </div>
  );
}
