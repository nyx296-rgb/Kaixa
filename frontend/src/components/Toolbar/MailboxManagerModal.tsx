// components/Toolbar/MailboxManagerModal.tsx
// Modal for viewing and managing imported mailboxes

import React, { useState } from 'react';
import {
  X, HardDrive, Trash2, FolderOpen, Loader2,
  AlertTriangle, Database,
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FORMAT_COLORS: Record<string, string> = {
  pst: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ost: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  mbox: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  eml: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  msg: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

export default function MailboxManagerModal() {
  const showManagerModal = useEmailStore((s) => s.showManagerModal);
  const setShowManagerModal = useEmailStore((s) => s.setShowManagerModal);
  const mailboxes = useEmailStore((s) => s.mailboxes);
  const activeMailboxId = useEmailStore((s) => s.activeMailboxId);
  const setActiveMailbox = useEmailStore((s) => s.setActiveMailbox);
  const deleteMailbox = useEmailStore((s) => s.deleteMailbox);
  const loadMailboxes = useEmailStore((s) => s.loadMailboxes);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!showManagerModal) return null;

  const handleOpen = async (mailboxId: string) => {
    await setActiveMailbox(mailboxId);
    setShowManagerModal(false);
  };

  const handleDelete = async (mailboxId: string) => {
    if (confirmDeleteId !== mailboxId) {
      setConfirmDeleteId(mailboxId);
      return;
    }
    setDeletingId(mailboxId);
    try {
      await deleteMailbox(mailboxId);
      await loadMailboxes();
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="glass rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-blue-400" />
            <h2 className="text-[14px] font-semibold text-slate-100">Gerenciar Mailboxes</h2>
          </div>
          <button
            onClick={() => setShowManagerModal(false)}
            className="p-1 rounded-md hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {mailboxes.length === 0 ? (
            <div className="text-center py-10 animate-fadeIn">
              <HardDrive size={36} className="mx-auto mb-3 text-slate-600" />
              <p className="text-[13px] text-slate-400 font-medium">Nenhum mailbox importado</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Clique em "Abrir Mailbox" na barra lateral para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mailboxes.map((mb) => {
                const isActive = activeMailboxId === mb.id;
                const isDeleting = deletingId === mb.id;
                const isConfirming = confirmDeleteId === mb.id;
                const fmtClass = FORMAT_COLORS[mb.file_format] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

                return (
                  <div
                    key={mb.id}
                    className={`
                      flex items-center gap-3 px-3.5 py-3 rounded-xl
                      border transition-all duration-200
                      ${isActive
                        ? 'border-blue-500/30 bg-blue-500/[0.06]'
                        : 'border-[var(--border-primary)] bg-white/[0.02] hover:bg-white/[0.04]'
                      }
                    `}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${fmtClass} border`}>
                      <HardDrive size={16} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-medium text-slate-200 truncate">
                          {mb.name}
                        </span>
                        {isActive && (
                          <span className="flex-shrink-0 text-[9px] font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded">
                            Ativo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className={`uppercase font-semibold px-1.5 py-0.5 rounded border text-[10px] ${fmtClass}`}>
                          {mb.file_format}
                        </span>
                        {mb.encoding && (
                          <span className="text-[10px] text-slate-400">
                            {mb.encoding}
                          </span>
                        )}
                        <span>{formatFileSize(mb.file_size)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!isActive && (
                        <button
                          id={`btn-open-mb-${mb.id}`}
                          onClick={() => handleOpen(mb.id)}
                          className="
                            flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                            text-blue-400 hover:text-blue-300
                            bg-blue-500/10 hover:bg-blue-500/20
                            border border-blue-500/20 hover:border-blue-500/30
                            transition-all duration-150
                          "
                          title="Abrir este mailbox"
                        >
                          <FolderOpen size={12} />
                          Abrir
                        </button>
                      )}

                      <button
                        id={`btn-delete-mb-${mb.id}`}
                        onClick={() => handleDelete(mb.id)}
                        disabled={isDeleting}
                        className={`
                          flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                          transition-all duration-150 border
                          ${isConfirming
                            ? 'text-rose-300 bg-rose-500/20 border-rose-500/40 hover:bg-rose-500/30'
                            : 'text-slate-400 hover:text-rose-400 bg-white/[0.03] hover:bg-rose-500/10 border-[var(--border-primary)] hover:border-rose-500/20'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={isConfirming ? 'Clique novamente para confirmar' : 'Excluir mailbox'}
                      >
                        {isDeleting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isConfirming ? (
                          <AlertTriangle size={12} />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        {isConfirming ? 'Confirmar?' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-border)]">
          <span className="text-[11px] text-slate-500">
            {mailboxes.length} mailbox{mailboxes.length !== 1 ? 'es' : ''} importado{mailboxes.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowManagerModal(false)}
            className="btn btn-ghost text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
