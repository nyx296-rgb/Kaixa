// SpreadsheetViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api, { getAttachmentPreviewUrl, getAttachmentUrl } from '../../lib/api';
import { Loader2 } from 'lucide-react';
import { useZoom } from '../../hooks/useZoom';
import ZoomBar from '../ZoomBar';

interface Props {
  attachment: Attachment;
}

const SpreadsheetViewer: React.FC<Props> = ({ attachment }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [xlsxHtml, setXlsxHtml] = useState<string>('');
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
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (attachment.mime_type === 'text/csv') {
          const src = getAttachmentPreviewUrl(attachment.id);
          const res = await fetch(src);
          const txt = await res.text();
          if (cancelled) return;
          const rows = txt.trim().split('\n').map((line) => line.split(','));
          setCsvRows(rows);
        } else {
          // XLSX: use backend converter
          const response = await api.get(`/attachment/${attachment.id}`, { responseType: 'blob' });
          if (cancelled) return;
          const fileContent = response.data;

          const formData = new FormData();
          formData.append('file', fileContent, attachment.filename);
          formData.append('mime_type', attachment.mime_type);

          const convertResponse = await api.post('/convert/office', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (cancelled) return;
          if (convertResponse.data.html) {
            setXlsxHtml(convertResponse.data.html);
          } else {
            setError('Conversão falhou');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('Falha ao carregar planilha');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [attachment.id, attachment.mime_type]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 p-4">
        <Loader2 className="animate-spin" size={20} />
        Carregando planilha…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <a href={getAttachmentUrl(attachment.id)} download className="text-[12px] text-blue-400 hover:text-blue-300 underline">
          Download {attachment.filename}
        </a>
      </div>
    );
  }

  // Common Header with ZoomBar
  const header = (
    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span className="font-medium text-slate-300">{attachment.filename}</span>
        {attachment.mime_type === 'text/csv' && <span>{csvRows.length} linhas</span>}
      </div>
      <ZoomBar
        zoom={zoom}
        zoomPercent={zoomPercent}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetZoom}
        compact
      />
    </div>
  );

  // XLSX rendered via backend HTML
  if (xlsxHtml) {
    return (
      <div className="flex flex-col h-full max-h-[80vh]" ref={containerRef}>
        {header}
        <div className="flex-1 overflow-auto p-4 bg-[var(--bg-primary)]">
          <div
            className="spreadsheet-content origin-top-left"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
            dangerouslySetInnerHTML={{ __html: xlsxHtml }}
          />
        </div>
        <style>{`
          .spreadsheet-content { color: var(--text-primary); transition: transform 0.15s ease; }
          .spreadsheet-content .xlsx-content { }
          .spreadsheet-content .sheet { margin-bottom: 24px; }
          .spreadsheet-content .sheet-title {
            font-size: 14px; font-weight: 600; color: var(--text-primary);
            margin-bottom: 8px; padding: 4px 0;
            border-bottom: 1px solid var(--border-primary);
          }
          .spreadsheet-content .table-wrapper { overflow-x: auto; }
          .spreadsheet-content table {
            width: 100%; border-collapse: collapse; font-size: 12px;
          }
          .spreadsheet-content th {
            background: var(--bg-tertiary); color: var(--text-primary);
            padding: 6px 10px; text-align: left; white-space: nowrap;
            border: 1px solid var(--border-primary); font-weight: 600;
            position: sticky; top: 0; z-index: 1;
          }
          .spreadsheet-content td {
            padding: 4px 10px; white-space: nowrap;
            border: 1px solid var(--border-subtle);
          }
          .spreadsheet-content tr:nth-child(even) td { background: var(--bg-hover); }
          .spreadsheet-content tr:hover td { background: var(--bg-secondary); }
        `}</style>
      </div>
    );
  }

  // CSV fallback: client-side table
  return (
    <div className="flex flex-col h-full max-h-[80vh]" ref={containerRef}>
      {header}
      <div className="flex-1 overflow-auto p-4 bg-[var(--bg-primary)]">
        <div className="origin-top-left" style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%`, transition: 'transform 0.15s ease' }}>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              {csvRows.length > 0 && (
                <tr>
                  {csvRows[0].map((cell, j) => (
                    <th key={j} className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-2 py-1.5 text-left border border-[var(--border-primary)] font-semibold sticky top-0">
                      {cell}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {csvRows.slice(1).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-hover)]'}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetViewer;
