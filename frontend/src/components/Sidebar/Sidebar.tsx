// components/Sidebar/Sidebar.tsx
// Folder tree navigation + mailbox selector

import React, { useState, useEffect } from 'react';
import {
  Inbox, Send, FileText, Archive, Trash2, AlertTriangle,
  FolderOpen, ChevronRight, ChevronDown, Plus, HardDrive, Settings,
  Sun, Moon, Bug
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import type { Folder, Tag } from '../../lib/api';
import ParsingProgressBar from './ParsingProgressBar';
import TagBadge from '../TagBadge';

const FOLDER_ICONS: Record<string, React.ReactNode> = {
  inbox: <Inbox size={15} className="text-blue-400" />,
  sent: <Send size={15} className="text-emerald-400" />,
  drafts: <FileText size={15} className="text-amber-400" />,
  archive: <Archive size={15} className="text-violet-400" />,
  trash: <Trash2 size={15} className="text-rose-400" />,
  deleted: <Trash2 size={15} className="text-rose-400" />,
  spam: <AlertTriangle size={15} className="text-orange-400" />,
  junk: <AlertTriangle size={15} className="text-orange-400" />,
};

function getFolderIcon(name: string) {
  const key = name.toLowerCase();
  for (const [k, icon] of Object.entries(FOLDER_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return <FolderOpen size={15} className="text-slate-400" />;
}

function FolderItem({ folder, depth = 0 }: { folder: Folder; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const selectedFolderPath = useEmailStore((s) => s.selectedFolderPath);
  const selectFolder = useEmailStore((s) => s.selectFolder);
  const hasChildren = folder.children && folder.children.length > 0;
  const isActive = selectedFolderPath === folder.full_path;

  return (
    <div>
      <button
        id={`folder-${folder.id}`}
        onClick={() => selectFolder(folder.full_path)}
        className={`
          w-full flex items-center gap-2 px-3 py-[7px] text-[13px] rounded-md
          transition-all duration-150 group cursor-pointer
          ${isActive
            ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium border-l-2 border-l-[var(--accent-blue)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border-l-2 border-l-transparent'
          }
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0 flex-shrink-0 opacity-50 hover:opacity-100"
          >
            {expanded
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}

        {getFolderIcon(folder.name)}

        <span className="truncate flex-1 text-left">{folder.name}</span>

        {folder.unread_count > 0 && (
          <span className="badge badge-blue">{folder.unread_count > 999 ? '999+' : folder.unread_count}</span>
        )}
      </button>

      {hasChildren && expanded && (
        <div className="animate-fadeIn">
          {folder.children.map((child) => (
            <FolderItem key={child.id} folder={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const mailboxes = useEmailStore((s) => s.mailboxes);
  const activeMailboxId = useEmailStore((s) => s.activeMailboxId);
  const activeMailbox = useEmailStore((s) => s.activeMailbox);
  const folders = useEmailStore((s) => s.folders);
  const setActiveMailbox = useEmailStore((s) => s.setActiveMailbox);
  const loadMailboxes = useEmailStore((s) => s.loadMailboxes);
  const setShowImportModal = useEmailStore((s) => s.setShowImportModal);
  const setShowManagerModal = useEmailStore((s) => s.setShowManagerModal);
  
  const parseErrors = useEmailStore((s) => s.parseErrors);
  const setShowErrorsModal = useEmailStore((s) => s.setShowErrorsModal);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme') as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const tags = useEmailStore((s) => s.tags);
  const loadTags = useEmailStore((s) => s.loadTags);
  const selectedTagFilter = useEmailStore((s) => s.selectedTagFilter);
  const setSelectedTagFilter = useEmailStore((s) => s.setSelectedTagFilter);

  useEffect(() => {
    loadMailboxes();
    loadTags();
  }, [loadMailboxes, loadTags]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)] overflow-hidden border-r border-[var(--border-primary)]">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/icone_logo.png" alt="Kaixa" className="h-6 w-auto" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">
              Kaixa
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <button
          id="btn-open-mailbox"
          onClick={() => setShowImportModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-semibold text-white rounded-lg cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
          style={{ background: '#1D4ED8', boxShadow: '0 2px 10px rgba(29,78,216,0.3)' }}
        >
          <Plus size={14} />
          Abrir Mailbox
        </button>
      </div>

      {/* ── Parse Errors Banner ── */}
      {parseErrors.length > 0 && (
        <div className="px-3 py-2 flex-shrink-0">
          <button
            onClick={() => setShowErrorsModal(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-[var(--accent-rose)]/10 hover:bg-[var(--accent-rose)]/20 border border-[var(--accent-rose)]/20 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2 text-[var(--accent-rose)]">
              <Bug size={13} />
              <span className="text-[11px] font-medium">{parseErrors.length} problemas de leitura</span>
            </div>
            <ChevronRight size={13} className="opacity-70" />
          </button>
        </div>
      )}

      {/* ── Mailbox selector ── */}
      {mailboxes.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Mailboxes
            </p>
            <button
              id="btn-manage-mailboxes"
              onClick={() => setShowManagerModal(true)}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-1"
              title="Gerenciar mailboxes"
            >
              <Settings size={13} />
            </button>
          </div>
          {mailboxes.map((mb) => (
            <button
              key={mb.id}
              onClick={() => setActiveMailbox(mb.id)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] mb-0.5
                transition-all duration-150 cursor-pointer
                ${activeMailboxId === mb.id
                  ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <HardDrive size={13} />
              <span className="truncate flex-1 text-left">{mb.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase">{mb.file_format}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Parsing Progress (if active) ── */}
      <ParsingProgressBar />

      {/* ── Folder tree ── */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {activeMailboxId && folders.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 px-3">
              Pastas
            </p>
            {folders.map((f) => (
              <FolderItem key={f.id} folder={f} />
            ))}
          </div>
        ) : activeMailboxId ? (
          <div className="px-4 py-8 text-center">
            <div className="skeleton w-full h-4 mb-2" />
            <div className="skeleton w-3/4 h-4 mb-2 mx-auto" />
            <div className="skeleton w-2/3 h-4 mx-auto" />
          </div>
        ) : (
          <div className="px-4 py-10 text-center animate-fadeIn">
            <div
              className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <HardDrive size={22} style={{ color: 'var(--accent-indigo)', opacity: 0.8 }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhum mailbox aberto</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>Importe um arquivo <span className="font-semibold">.mbox</span> ou <span className="font-semibold">.pst</span> para começar</p>
            <button
              onClick={() => setShowImportModal(true)}
              className="mt-4 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all duration-150 hover:brightness-110"
              style={{ color: 'var(--accent-indigo)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              + Abrir agora
            </button>
          </div>
        )}

        {/* ── Tags filter ── */}
        {tags.length > 0 && (
          <div className="mt-4 px-1 pb-4">
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex-1">
                Tags
              </p>
              <div className="flex items-center gap-1">
                {selectedTagFilter && (
                  <button
                    onClick={() => setSelectedTagFilter(null)}
                    className="text-[10px] text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <button
                  onClick={() => useEmailStore.getState().setShowTagManagerModal(true)}
                  className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  title="Gerenciar tags"
                >
                  <Settings size={13} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-lg
                    transition-all duration-150 cursor-pointer
                    ${selectedTagFilter === tag.id
                      ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="truncate flex-1 text-left">{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
