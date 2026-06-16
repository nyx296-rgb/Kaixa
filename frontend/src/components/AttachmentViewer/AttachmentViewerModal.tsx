// AttachmentViewerModal.tsx
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useAttachmentViewer } from '../../hooks/useAttachmentViewer';
import { getAttachmentUrl } from '../../lib/api';
import ImageViewer from './ImageViewer';
import PDFViewer from './PDFViewer';
import TextViewer from './TextViewer';
import SpreadsheetViewer from './SpreadsheetViewer';
import OfficeViewer from './OfficeViewer';
import HtmlViewer from './HtmlViewer';
import { X, Download } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AttachmentViewerModal: React.FC = () => {
  const { isOpen, selectedAttachment, closeViewer } = useAttachmentViewer();

  const renderContent = () => {
    if (!selectedAttachment) return null;
    const { mime_type } = selectedAttachment;
    if (mime_type.startsWith('image/')) {
      return <ImageViewer attachment={selectedAttachment} />;
    }
    if (mime_type === 'application/pdf') {
      return <PDFViewer attachment={selectedAttachment} />;
    }
    if (mime_type === 'text/html' || mime_type === 'application/xhtml+xml') {
      return <HtmlViewer attachment={selectedAttachment} />;
    }
    if (mime_type.startsWith('text/') || mime_type === 'application/json' || mime_type === 'application/xml') {
      return <TextViewer attachment={selectedAttachment} />;
    }
    if (mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime_type === 'text/csv') {
      return <SpreadsheetViewer attachment={selectedAttachment} />;
    }
    if (mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return <OfficeViewer attachment={selectedAttachment} />;
    }
    // fallback: download link
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <p className="text-sm">Visualização não disponível para este tipo de arquivo</p>
        <a
          href={getAttachmentUrl(selectedAttachment.id)}
          download={selectedAttachment.filename}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
        >
          <Download size={16} />
          <span className="text-sm font-medium">Download {selectedAttachment.filename}</span>
        </a>
      </div>
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) closeViewer(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="attachment-modal-overlay" />
        <Dialog.Content className="attachment-modal-content">
          <VisuallyHidden>
            <Dialog.Title>{selectedAttachment?.filename || 'Attachment'}</Dialog.Title>
            <Dialog.Description>Visualizador de anexo</Dialog.Description>
          </VisuallyHidden>
          
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-slate-400 truncate font-medium">
                {selectedAttachment?.filename}
              </span>
              {selectedAttachment && (
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {formatBytes(selectedAttachment.size)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedAttachment && (
                <a
                  href={getAttachmentUrl(selectedAttachment.id)}
                  download={selectedAttachment.filename}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all duration-100"
                  title="Download"
                >
                  <Download size={15} />
                </a>
              )}
              <Dialog.Close
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-100 cursor-pointer"
                aria-label="Fechar"
              >
                <X size={16} />
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {renderContent()}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AttachmentViewerModal;
