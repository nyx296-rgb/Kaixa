// components/Toolbar/MailboxImportModal.tsx
// Modal for opening mailboxes: local path, file upload, and import progress

import React, { useState, useRef, useEffect } from 'react';
import {
  X, FolderOpen, Upload, Cloud, Loader2, CheckCircle2,
  AlertCircle, FileArchive,
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import { useJobProgress } from '../../hooks/useJobProgress';

const FORMAT_COLORS: Record<string, string> = {
  pst: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  ost: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  mbox: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  eml: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  msg: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  directory: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

function getFormatColor(format: string): string {
  return FORMAT_COLORS[format] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}

export default function MailboxImportModal() {
  const showImportModal = useEmailStore((s) => s.showImportModal);
  const setShowImportModal = useEmailStore((s) => s.setShowImportModal);
  const openMailboxByPath = useEmailStore((s) => s.openMailboxByPath);
  const uploadMailbox = useEmailStore((s) => s.uploadMailbox);
  const activeJobId = useEmailStore((s) => s.activeJobId);
  const jobProgress = useEmailStore((s) => s.jobProgress);
  const setActiveMailbox = useEmailStore((s) => s.setActiveMailbox);
  const loadMailboxes = useEmailStore((s) => s.loadMailboxes);
  const detectedFormat = useEmailStore((s) => s.detectedFormat);
  const needsFormatSelection = useEmailStore((s) => s.needsFormatSelection);
  const selectFormatAndStartParsing = useEmailStore((s) => s.selectFormatAndStartParsing);
  const setNeedsFormatSelection = useEmailStore((s) => s.setNeedsFormatSelection);

  const [activeTab, setActiveTab] = useState<'upload' | 'cloud'>('upload');
  const [localPath, setLocalPath] = useState('');
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_mailboxes') || '[]');
    } catch {
      return [];
    }
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Listen to SSE progress
  useJobProgress(activeJobId);

  if (!showImportModal) return null;

  const handleOpenLocal = async (pathOverride?: string) => {
    const pathToOpen = pathOverride || localPath.trim();
    if (!pathToOpen) return;
    setError('');
    setIsSubmitting(true);
    try {
      await openMailboxByPath(pathToOpen);
      // Save to recent paths on success
      setRecentPaths(prev => {
        const updated = [pathToOpen, ...prev.filter(p => p !== pathToOpen)].slice(0, 5);
        localStorage.setItem('recent_mailboxes', JSON.stringify(updated));
        return updated;
      });
      setSuccessMsg('Arquivo aberto com sucesso!');
      setTimeout(() => {
        setSuccessMsg('');
        // check if no background parsing is happening, then close modal
        if (!useEmailStore.getState().activeJobId) {
          setShowImportModal(false);
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      await uploadMailbox(files, (progressEvent: any) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      setSuccessMsg('Upload concluído com sucesso!');
      setTimeout(() => {
        setSuccessMsg('');
        if (!useEmailStore.getState().activeJobId) {
          handleDone();
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      // Reset input so the same file can be selected again
      if (e.target) e.target.value = '';
    }
  };

  const handleDone = async () => {
    // Find the most recently added mailbox and activate it
    await loadMailboxes();
    const mbs = useEmailStore.getState().mailboxes;
    if (mbs.length > 0) {
      await setActiveMailbox(mbs[0].id);
    }
    setShowImportModal(false);
  };

  // Auto close after 3 seconds of inactivity when done
  useEffect(() => {
    if (jobProgress?.status === 'ready') {
      const timeout = setTimeout(() => {
        handleDone();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [jobProgress?.status]);

  const isProcessing = activeJobId && jobProgress && !['ready', 'error', 'cancelled'].includes(jobProgress.status);
  const isDone = jobProgress?.status === 'ready';
  const isError = jobProgress?.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="glass rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)]">
          <h2 className="text-[14px] font-semibold text-slate-100">Abrir Mailbox</h2>
          <button
            onClick={() => setShowImportModal(false)}
            className="p-1 rounded-md hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab selector */}
        {!isProcessing && !isDone && !isError && (
          <div className="flex border-b border-[var(--glass-border)]">
            {[
              { key: 'upload' as const, icon: <Upload size={13} />, label: 'Upload' },
              { key: 'cloud' as const, icon: <Cloud size={13} />, label: 'Cloud ↗' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px]
                  transition-all duration-150 border-b-2
                  ${activeTab === tab.key
                    ? 'border-blue-400 text-blue-300 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-white/[0.02]'
                  }
                `}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-5">
          {/* ── Processing state ── */}
          {(isProcessing || isDone || isError) && !needsFormatSelection ? (
            <div className="text-center py-4 animate-fadeIn">
              {isProcessing && (
                <>
                  <Loader2 size={32} className="mx-auto mb-3 text-blue-400 animate-spin" />
                  <p className="text-sm text-slate-200 font-medium mb-1">
                    {jobProgress?.status === 'parsing' ? 'Indexando emails...' : 'Analisando estrutura...'}
                  </p>
                  {detectedFormat && (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[11px] text-slate-400">Formato detectado:</span>
                      <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${getFormatColor(detectedFormat)}`}>
                        {detectedFormat}
                      </span>
                    </div>
                  )}
                  <div className="progress-bar w-full max-w-xs mx-auto mb-2">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.max(jobProgress?.progress || 0, 2)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {jobProgress?.indexed?.toLocaleString()} / {jobProgress?.total?.toLocaleString() || '?'} emails indexados
                  </p>
                </>
              )}

              {isDone && (
                <>
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
                  <p className="text-sm text-slate-200 font-medium mb-1">Mailbox pronto!</p>
                  <p className="text-[11px] text-slate-500 mb-4">
                    {jobProgress?.indexed?.toLocaleString()} emails indexados
                  </p>
                  <button onClick={handleDone} className="btn btn-primary">
                    Abrir mailbox
                  </button>
                </>
              )}

              {isError && (
                <>
                  <AlertCircle size={32} className="mx-auto mb-3 text-rose-400" />
                  <p className="text-sm text-rose-300 font-medium mb-1">Erro ao processar</p>
                  <p className="text-[11px] text-slate-400 mb-4">{jobProgress?.error || 'Erro desconhecido'}</p>
                  <button onClick={() => setShowImportModal(false)} className="btn btn-ghost">
                    Fechar
                  </button>
                </>
              )}
            </div>
          ) : needsFormatSelection ? (
            /* ── Format selection modal ── */
            <div className="text-center py-4 animate-fadeIn">
              <AlertCircle size={32} className="mx-auto mb-3 text-amber-400" />
              <p className="text-sm text-slate-200 font-medium mb-1">Formato não reconhecido</p>
              <p className="text-[11px] text-slate-400 mb-4">
                Selecione o formato do arquivo manualmente:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {['pst', 'ost', 'mbox', 'eml', 'msg'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => selectFormatAndStartParsing(fmt)}
                    className={`px-4 py-2 rounded-lg border text-[12px] font-medium transition-all hover:scale-105 ${getFormatColor(fmt)}`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => {
                  setNeedsFormatSelection(false);
                  setShowImportModal(false);
                }} 
                className="btn btn-ghost text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              {/* ── Upload tab ── */}
              {activeTab === 'upload' && (
                <div className="space-y-3 animate-fadeIn">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    /* @ts-ignore - webkitdirectory is non-standard but supported by all modern browsers */
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {isSubmitting ? (
                    <div className="py-6 text-center animate-fadeIn">
                      <Loader2 size={28} className="mx-auto mb-3 text-blue-400 animate-spin" />
                      <p className="text-[13px] text-slate-200 font-medium mb-2">Enviando arquivos...</p>
                      <div className="progress-bar w-full max-w-xs mx-auto mb-2 bg-slate-700/50">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.max(uploadProgress, 2)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">{uploadProgress}% concluído</p>
                    </div>
                  ) : (
                    <div
                      className="
                        border-2 border-dashed border-[var(--border-primary)] rounded-xl
                        py-8 px-4 text-center
                        transition-all duration-200
                      "
                    >
                      <FileArchive size={28} className="mx-auto mb-2 text-slate-500" />
                      <p className="text-[12px] text-slate-300 font-medium mb-3">Selecione o que deseja enviar</p>
                      
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 text-[12px] font-medium border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all cursor-pointer"
                        >
                          Arquivo (.pst, .mbox...)
                        </button>
                        <button 
                          onClick={() => folderInputRef.current?.click()}
                          className="px-4 py-2 text-[12px] font-medium border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all cursor-pointer"
                        >
                          Pasta de Arquivos
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 mt-4">
                        Formatos suportados: .pst, .ost, .mbox, .eml, .msg
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Cloud tab ── */}
              {activeTab === 'cloud' && (
                <div className="text-center py-6 animate-fadeIn">
                  <Cloud size={28} className="mx-auto mb-2 text-slate-500" />
                  <p className="text-[12px] text-slate-400 font-medium">Em breve</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Integração com Google Drive, OneDrive e Dropbox
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px] animate-fadeIn">
              {error}
            </div>
          )}

          {/* Success display */}
          {successMsg && (
            <div className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] animate-fadeIn">
              <CheckCircle2 size={14} />
              {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
