// components/EmailList/EmailList.tsx
// Virtualized email list with search, sort, and multi-select

import React, { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search, Paperclip, CheckSquare, Square,
  Loader2, AlertCircle, Inbox, Filter
} from 'lucide-react';
import { useEmailStore } from '../../store/emailStore';
import { format } from 'date-fns';
import { isToday, isYesterday, isThisYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TagBadge from '../TagBadge';

function formatEmailDate(ts: number): string {
  const date = new Date(ts * 1000);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  if (isThisYear(date)) return format(date, 'dd MMM', { locale: ptBR });
  return format(date, 'dd/MM/yy');
}

function EmailRow({ index }: { index: number }) {
  const email = useEmailStore((s) => s.emails[index]);
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId);
  const selectedEmailIds = useEmailStore((s) => s.selectedEmailIds);
  const selectEmail = useEmailStore((s) => s.selectEmail);
  const toggleSelectEmail = useEmailStore((s) => s.toggleSelectEmail);

  if (!email) return null;

  const isActive = selectedEmailId === email.id;
  const isChecked = selectedEmailIds.has(email.id);
  const isUnread = !email.is_read;

  return (
    <div
      id={`email-row-${email.id}`}
      onClick={() => selectEmail(email.id)}
      className={`
        flex items-start gap-2.5 px-3 py-2.5 cursor-pointer
        border-b border-[var(--border-subtle)]
        transition-all duration-100
        ${isActive
          ? 'bg-[var(--accent-blue)]/10 border-l-2 border-l-[var(--accent-blue)]'
          : 'border-l-2 border-l-transparent hover:bg-[var(--bg-hover)]'
        }
      `}
    >
      {/* Unread dot / space */}
      <div className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full flex items-center justify-center">
        {isUnread && <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Sender + Date row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-[13px] truncate ${isUnread ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {email.sender || '(Sem remetente)'}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0">
            {formatEmailDate(email.date_ts)}
          </span>
        </div>

        {/* Subject */}
        <p className={`text-[12px] truncate mb-0.5 ${isUnread ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {email.subject || '(Sem assunto)'}
        </p>

        {/* Tags */}
        {email.tags && email.tags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-1 overflow-hidden">
            {email.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
            {email.tags.length > 3 && (
              <span className="text-[10px] text-[var(--text-muted)]">+{email.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Preview + indicators */}
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] text-[var(--text-muted)] truncate flex-1">
            {email.body_preview || ''}
          </p>
          {email.has_attach && (
            <Paperclip size={11} className="text-[var(--text-muted)] flex-shrink-0" />
          )}
          {email.importance === 'high' && (
            <AlertCircle size={11} className="text-[var(--accent-rose)] flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleSelectEmail(email.id); }}
        className="flex-shrink-0 mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {isChecked
          ? <CheckSquare size={15} className="text-[var(--accent-blue)]" />
          : <Square size={15} />
        }
      </button>
    </div>
  );
}

export default function EmailList() {
  const emails = useEmailStore((s) => s.emails);
  const isLoadingEmails = useEmailStore((s) => s.isLoadingEmails);
  const nextCursor = useEmailStore((s) => s.nextCursor);
  const loadEmails = useEmailStore((s) => s.loadEmails);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const setSearchQuery = useEmailStore((s) => s.setSearchQuery);
  const selectedFolderPath = useEmailStore((s) => s.selectedFolderPath);
  const selectedEmailIds = useEmailStore((s) => s.selectedEmailIds);
  const selectAllEmails = useEmailStore((s) => s.selectAllEmails);
  const clearSelection = useEmailStore((s) => s.clearSelection);
  const activeFilter = useEmailStore((s) => s.activeFilter);
  const setActiveFilter = useEmailStore((s) => s.setActiveFilter);

  const parentRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  // Infinite scroll: load more when near the bottom
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isLoadingEmails || !nextCursor) return;
    const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (scrollBottom < 200) {
      loadEmails(true);
    }
  }, [isLoadingEmails, nextCursor, loadEmails]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadEmails();
    }, 400);
  };

  const folderName = selectedFolderPath?.split('/').pop() || 'INBOX';

  const filters = [
    { key: 'all' as const, label: 'Todos' },
    { key: 'unread' as const, label: 'Não lidos' },
    { key: 'attachments' as const, label: 'Anexos' },
    { key: 'tagged' as const, label: 'Com tag' },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden border-r border-[var(--border-primary)]">
      {/* ── Header: Search bar + Filters ── */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            id="email-search"
            type="text"
            placeholder="Remetente, assunto, conteúdo..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="
              w-full pl-8 pr-9 py-[7px] rounded-lg text-[12px]
              bg-[var(--bg-tertiary)] border border-[var(--border-primary)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:outline-none focus:border-[var(--accent-blue)]/40 focus:ring-1 focus:ring-[var(--accent-blue)]/20
              transition-all duration-150
            "
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <Filter size={14} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mt-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`filter-chip${activeFilter === f.key ? ' active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Count line */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[var(--text-muted)]">
            {emails.length} e-mails · {folderName}
          </span>
          <button
            onClick={() => selectedEmailIds.size > 0 ? clearSelection() : selectAllEmails()}
            className="text-[10px] text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 transition-colors cursor-pointer"
          >
            {selectedEmailIds.size > 0
              ? `${selectedEmailIds.size} selecionados`
              : 'Selecionar todos'
            }
          </button>
        </div>
      </div>

      {/* ── Email list (virtualized) ── */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {emails.length > 0 ? (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EmailRow index={virtualRow.index} />
              </div>
            ))}
          </div>
        ) : isLoadingEmails ? (
          <div className="px-3 py-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5 py-2">
                <div className="flex justify-between">
                  <div className="skeleton h-3.5 w-32" />
                  <div className="skeleton h-3 w-12" />
                </div>
                <div className="skeleton h-3 w-48" />
                <div className="skeleton h-2.5 w-64" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-xs">
            <div className="text-center">
              <Inbox size={32} className="mx-auto mb-2 opacity-40" />
              <p>Nenhum email encontrado</p>
              {searchQuery && <p className="mt-1 text-[var(--text-muted)]">Tente outra busca</p>}
            </div>
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingEmails && emails.length > 0 && (
          <div className="flex justify-center py-3">
            <Loader2 size={16} className="animate-spin text-[var(--accent-blue)]" />
          </div>
        )}
      </div>
    </div>
  );
}
