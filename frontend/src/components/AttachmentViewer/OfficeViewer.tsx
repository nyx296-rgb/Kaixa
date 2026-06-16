// OfficeViewer.tsx
import React, { useEffect, useState } from 'react';
import { Attachment } from '../../hooks/useAttachmentViewer';
import api, { getAttachmentUrl } from '../../lib/api';
import { Loader2 } from 'lucide-react';

interface OfficeViewerProps {
  attachment: Attachment;
}

const OfficeViewer: React.FC<OfficeViewerProps> = ({ attachment }) => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAndConvert = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/attachment/${attachment.id}`, {
          responseType: 'blob'
        });

        if (cancelled) return;
        const blob = response.data;
        const fileContent = await blob.arrayBuffer();

        const convertResponse = await api.post('/convert/office', {
          file_content: Array.from(new Uint8Array(fileContent)),
          mime_type: attachment.mime_type
        });

        if (cancelled) return;
        if (convertResponse.data.html) {
          setHtml(convertResponse.data.html);
        } else {
          setError('Conversão falhou');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Office conversion error:', err);
          setError('Falha ao converter documento');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAndConvert();
    return () => { cancelled = true; };
  }, [attachment]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 size={28} className="animate-spin text-blue-400" />
        <p className="text-sm">Convertendo documento…</p>
      </div>
    );
  }

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
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 text-[11px] text-slate-500">
        <span className="font-medium text-slate-300">{attachment.filename}</span>
      </div>
      <div
        className="flex-1 overflow-auto p-6 office-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .office-content { color: var(--text-primary); font-size: 14px; line-height: 1.7; }
        .office-content h1, .office-content h2, .office-content h3,
        .office-content h4, .office-content h5, .office-content h6 {
          color: var(--text-primary); margin: 1.2em 0 0.5em; font-weight: 600;
        }
        .office-content h1 { font-size: 1.5em; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.3em; }
        .office-content h2 { font-size: 1.3em; }
        .office-content h3 { font-size: 1.15em; }
        .office-content .docx-title { font-size: 1.8em; text-align: center; margin-bottom: 1em; }
        .office-content .docx-subtitle { text-align: center; color: var(--text-secondary); font-size: 1.1em; margin-bottom: 2em; }
        .office-content p { margin: 0.5em 0; }
        .office-content blockquote {
          border-left: 3px solid var(--accent-blue); padding: 0.5em 1em; margin: 1em 0;
          background: rgba(59,130,246,0.05); color: var(--text-secondary); border-radius: 0 6px 6px 0;
        }
        .office-content ul, .office-content ol {
          margin: 0.5em 0; padding-left: 1.5em;
        }
        .office-content li { margin: 0.3em 0; }
        .office-content ul { list-style: disc; }
        .office-content ol { list-style: decimal; }
        .office-content table {
          width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 13px;
        }
        .office-content th {
          background: var(--bg-tertiary); color: var(--text-primary); text-align: left;
          padding: 8px 12px; border: 1px solid var(--border-primary); font-weight: 600;
        }
        .office-content td {
          padding: 6px 12px; border: 1px solid var(--border-subtle);
        }
        .office-content tr:nth-child(even) td { background: var(--bg-hover); }
        .office-content img { max-width: 100%; border-radius: 4px; margin: 0.5em 0; }
        .office-content strong { color: var(--text-primary); }
        .office-content em { color: var(--text-secondary); }
        .office-content u { text-decoration-color: var(--accent-blue); }
        .office-content a { color: var(--accent-blue); }
        .office-content .slide {
          background: var(--bg-tertiary); border: 1px solid var(--border-primary);
          border-radius: 8px; padding: 24px; margin: 16px 0;
        }
        .office-content .slide-number {
          font-size: 11px; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;
        }
        .office-content .slide-title { color: var(--text-primary); font-size: 1.3em; margin-bottom: 0.5em; }
      `}</style>
    </div>
  );
};

export default OfficeViewer;
