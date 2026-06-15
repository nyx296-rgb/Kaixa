// ParsingProgressBar.tsx
// Granular progress bar shown during mailbox indexing with cancel button

import React from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import { cancelJob } from '../../lib/api';

export default function ParsingProgressBar() {
  const jobProgress = useEmailStore((s) => s.jobProgress);
  const activeJobId = useEmailStore((s) => s.activeJobId);
  const setJobProgress = useEmailStore((s) => s.setJobProgress);

  if (!jobProgress || !activeJobId) return null;

  const { status, progress, indexed, total, current_folder } = jobProgress;

  // Only show while actively indexing
  if (!['pending', 'parsing', 'indexing'].includes(status)) return null;

  const pct = Math.round(progress);
  const indexedFmt = indexed?.toLocaleString('pt-BR') ?? '0';
  const totalFmt = total > 0 ? total.toLocaleString('pt-BR') : '…';

  const handleCancel = async () => {
    if (!activeJobId) return;
    try {
      await cancelJob(activeJobId);
      setJobProgress({ ...jobProgress, status: 'cancelled' });
    } catch {
      // ignore
    }
  };

  return (
    <div
      id="parsing-progress-bar"
      className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
          <Loader2 size={12} className="animate-spin" />
          <span>Indexando…</span>
        </div>
        <button
          id="btn-cancel-indexing"
          onClick={handleCancel}
          title="Cancelar indexação"
          className="p-0.5 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{indexedFmt} / {totalFmt} emails</span>
        <span>{pct}%</span>
      </div>

      {/* Current folder */}
      {current_folder && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600 truncate">
          <FolderOpen size={10} className="flex-shrink-0 text-blue-500/60" />
          <span className="truncate">{current_folder}</span>
        </div>
      )}
    </div>
  );
}
