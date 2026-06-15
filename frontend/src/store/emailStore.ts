// store/emailStore.ts
// Global state management with Zustand

import { create } from 'zustand';
import type { Folder, EmailSummary, EmailDetail, Mailbox, JobProgress, Tag } from '../lib/api';
import * as api from '../lib/api';

interface EmailStore {
  // ── Mailbox state ──
  mailboxes: Mailbox[];
  activeMailboxId: string | null;
  activeMailbox: Mailbox | null;

  // ── Folder state ──
  folders: Folder[];
  selectedFolderPath: string | null;

  // ── Email list state ──
  emails: EmailSummary[];
  nextCursor: { after_date_ts: number; after_id: string } | null;
  selectedEmailId: string | null;
  selectedEmailIds: Set<string>;
  isLoadingEmails: boolean;

  // ── Email detail state ──
  emailDetail: EmailDetail | null;
  isLoadingDetail: boolean;

  // ── Search ──
  searchQuery: string;
  sortField: string;
  sortOrder: string;
  activeFilter: 'all' | 'unread' | 'attachments' | 'tagged';

  // ── Import job ──
  activeJobId: string | null;
  jobProgress: JobProgress | null;
  showImportModal: boolean;
  showManagerModal: boolean;
  showTagManagerModal: boolean;
  detectedFormat: string | null;
  detectedFilePath: string | null;
  needsFormatSelection: boolean;
  selectedMailboxId: string | null;

  // ── Parse Errors ──
  parseErrors: any[];
  showErrorsModal: boolean;

  // ── UI ──
  sidebarWidth: number;
  listWidth: number;

  // ── Tags ──
  tags: Tag[];
  selectedTagFilter: string | null;

  // ── Actions ──
  loadMailboxes: () => Promise<void>;
  setActiveMailbox: (mailboxId: string) => Promise<void>;
  loadFolders: () => Promise<void>;
  selectFolder: (path: string) => Promise<void>;
  loadEmails: (append?: boolean) => Promise<void>;
  selectEmail: (emailId: string) => Promise<void>;
  toggleSelectEmail: (emailId: string) => void;
  selectAllEmails: () => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (filter: 'all' | 'unread' | 'attachments' | 'tagged') => void;
  setSortField: (field: string) => void;
  setSortOrder: (order: string) => void;
  openMailboxByPath: (path: string) => Promise<void>;
  uploadMailbox: (files: FileList | File[], onProgress?: (progressEvent: any) => void) => Promise<void>;
  deleteMailbox: (mailboxId: string) => Promise<void>;
  setShowImportModal: (show: boolean) => void;
  setShowManagerModal: (show: boolean) => void;
  setShowTagManagerModal: (show: boolean) => void;
  setJobProgress: (progress: JobProgress | null) => void;
  setDetectedFormat: (format: string | null, filePath?: string | null) => void;
  openMailboxWithFormat: (filePath: string, format: string) => Promise<void>;
  setNeedsFormatSelection: (needs: boolean, mailboxId?: string | null) => void;
  selectFormatAndStartParsing: (format: string) => Promise<void>;
  
  loadParseErrors: (mailboxId: string) => Promise<void>;
  setShowErrorsModal: (show: boolean) => void;

  setSidebarWidth: (w: number) => void;
  setListWidth: (w: number) => void;
  exportSelectedPdf: () => Promise<void>;
  exportEmailZip: (emailId: string) => Promise<void>;

  loadTags: () => Promise<void>;
  setSelectedTagFilter: (tagId: string | null) => void;
  updateEmailTags: (emailId: string, tags: Tag[]) => void;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  // ── Initial state ──
  mailboxes: [],
  activeMailboxId: null,
  activeMailbox: null,
  folders: [],
  selectedFolderPath: null,
  emails: [],
  nextCursor: null,
  selectedEmailId: null,
  selectedEmailIds: new Set(),
  isLoadingEmails: false,
  emailDetail: null,
  isLoadingDetail: false,
  searchQuery: '',
  sortField: 'date',
  sortOrder: 'desc',
  activeFilter: 'all',
  activeJobId: null,
  jobProgress: null,
  showImportModal: false,
  showManagerModal: false,
  showTagManagerModal: false,
  detectedFormat: null,
  detectedFilePath: null,
  needsFormatSelection: false,
  selectedMailboxId: null,
  parseErrors: [],
  showErrorsModal: false,
  sidebarWidth: 240,
  listWidth: 340,
  tags: [],
  selectedTagFilter: null,

  // ── Actions ──

  loadMailboxes: async () => {
    const mailboxes = await api.listMailboxes();
    set({ mailboxes });
  },

  setActiveMailbox: async (mailboxId: string) => {
    const { mailboxes } = get();
    const mb = mailboxes.find((m) => m.id === mailboxId) || null;
    set({
      activeMailboxId: mailboxId,
      activeMailbox: mb,
      folders: [],
      emails: [],
      selectedFolderPath: null,
      selectedEmailId: null,
      emailDetail: null,
      nextCursor: null,
      parseErrors: [],
    });
    // Load folders
    const folders = await api.getFolders(mailboxId);
    set({ folders });
    // Load errors
    await get().loadParseErrors(mailboxId);
    // Auto-select first folder
    if (folders.length > 0) {
      const first = folders[0];
      const path = first.full_path;
      get().selectFolder(path);
    }
  },

  loadFolders: async () => {
    const { activeMailboxId } = get();
    if (!activeMailboxId) return;
    const folders = await api.getFolders(activeMailboxId);
    set({ folders });
  },

  selectFolder: async (path: string) => {
    set({
      selectedFolderPath: path,
      emails: [],
      nextCursor: null,
      selectedEmailId: null,
      emailDetail: null,
      selectedEmailIds: new Set(),
    });
    await get().loadEmails();
  },

  loadEmails: async (append = false) => {
    const { activeMailboxId, selectedFolderPath, nextCursor, searchQuery, sortField, sortOrder, selectedTagFilter, activeFilter } = get();
    
    // If no mailbox is selected and no global filter is active, return
    if (!activeMailboxId && !selectedTagFilter) return;

    const targetMailbox = activeMailboxId || "all";

    set({ isLoadingEmails: true });
    try {
      const result = await api.listEmails(targetMailbox, {
        folder: selectedFolderPath || undefined,
        limit: 50,
        after_date_ts: append ? nextCursor?.after_date_ts : undefined,
        after_id: append ? nextCursor?.after_id : undefined,
        sort: sortField,
        order: sortOrder,
        search: searchQuery || undefined,
        tag_id: selectedTagFilter || undefined,
        unread: activeFilter === 'unread' ? true : undefined,
        has_attach: activeFilter === 'attachments' ? true : undefined,
      });

      // Client-side filter for "tagged" (has any tag)
      let filteredEmails = result.emails;
      if (activeFilter === 'tagged' && !selectedTagFilter) {
        filteredEmails = result.emails.filter(e => e.tags && e.tags.length > 0);
      }

      if (append) {
        set((s) => ({
          emails: [...s.emails, ...filteredEmails],
          nextCursor: result.next_cursor,
        }));
      } else {
        set({ emails: filteredEmails, nextCursor: result.next_cursor });
      }
    } finally {
      set({ isLoadingEmails: false });
    }
  },

  selectEmail: async (emailId: string) => {
    const { activeMailboxId, emails } = get();
    const email = emails.find(e => e.id === emailId);
    if (!email) return;
    const targetMailboxId = email.mailbox_id;

    set({ selectedEmailId: emailId, isLoadingDetail: true, emailDetail: null });
    try {
      const detail = await api.getEmailDetail(targetMailboxId, emailId);
      set({ emailDetail: detail, isLoadingDetail: false });
      // Mark as read locally
      set((s) => ({
        emails: s.emails.map((e) => (e.id === emailId ? { ...e, is_read: true } : e)),
      }));
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  toggleSelectEmail: (emailId: string) => {
    set((s) => {
      const newSet = new Set(s.selectedEmailIds);
      if (newSet.has(emailId)) newSet.delete(emailId);
      else newSet.add(emailId);
      return { selectedEmailIds: newSet };
    });
  },

  selectAllEmails: () => {
    set((s) => ({ selectedEmailIds: new Set(s.emails.map((e) => e.id)) }));
  },

  clearSelection: () => set({ selectedEmailIds: new Set() }),

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },

  setActiveFilter: (filter: 'all' | 'unread' | 'attachments' | 'tagged') => {
    set({
      activeFilter: filter,
      emails: [],
      nextCursor: null,
      selectedEmailId: null,
      emailDetail: null,
      selectedEmailIds: new Set(),
    });
    get().loadEmails();
  },

  setSortField: (field: string) => {
    set({ sortField: field, emails: [], nextCursor: null });
    get().loadEmails();
  },

  setSortOrder: (order: string) => {
    set({ sortOrder: order, emails: [], nextCursor: null });
    get().loadEmails();
  },

  openMailboxByPath: async (path: string) => {
    try {
      const result = await api.openMailbox(path);
      set({ activeJobId: result.job_id, showImportModal: true });
      // Reload mailboxes list
      await get().loadMailboxes();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao abrir o arquivo';
      throw new Error(msg);
    }
  },

  uploadMailbox: async (files: FileList | File[], onProgress?: (progressEvent: any) => void) => {
    try {
      const result = await api.uploadMailbox(files, onProgress);
      set({ 
        detectedFormat: result.format,
        detectedFilePath: null,
        selectedMailboxId: result.mailbox_id,
      });
      
      if (result.needs_format) {
        // Show format selection modal
        set({ needsFormatSelection: true, showImportModal: true });
      } else {
        // Start parsing
        set({ activeJobId: result.job_id, showImportModal: true });
      }
      
      await get().loadMailboxes();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao enviar o arquivo';
      throw new Error(msg);
    }
  },

  deleteMailbox: async (mailboxId: string) => {
    await api.deleteMailbox(mailboxId);
    const { activeMailboxId } = get();
    if (activeMailboxId === mailboxId) {
      set({
        activeMailboxId: null,
        activeMailbox: null,
        folders: [],
        emails: [],
        emailDetail: null,
      });
    }
    await get().loadMailboxes();
  },

  setShowImportModal: (show: boolean) => {
    if (!show) {
      set({ showImportModal: false, activeJobId: null, jobProgress: null, needsFormatSelection: false });
    } else {
      set({ showImportModal: true });
    }
  },
  setShowManagerModal: (show: boolean) => set({ showManagerModal: show }),
  setShowTagManagerModal: (show: boolean) => set({ showTagManagerModal: show }),
  setJobProgress: (progress: JobProgress | null) => set({ jobProgress: progress }),
  setDetectedFormat: (format: string | null, filePath?: string | null) => set({ 
    detectedFormat: format, 
    detectedFilePath: filePath ?? null 
  }),
  openMailboxWithFormat: async (filePath: string, _format: string) => {
    try {
      const result = await api.openMailbox(filePath);
      set({ 
        activeJobId: result.job_id, 
        showImportModal: true,
        detectedFormat: result.format,
        detectedFilePath: filePath,
      });
      await get().loadMailboxes();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao abrir arquivo';
      throw new Error(msg);
    }
  },
  setNeedsFormatSelection: (needs: boolean, mailboxId?: string | null) => set({ 
    needsFormatSelection: needs, 
    selectedMailboxId: mailboxId ?? null 
  }),
  selectFormatAndStartParsing: async (format: string) => {
    const { selectedMailboxId } = get();
    if (!selectedMailboxId) return;
    
    try {
      // Update mailbox format in the database
      await api.updateMailboxFormat(selectedMailboxId, format);
      
      // Start parsing
      const result = await api.openMailboxById(selectedMailboxId);
      set({ 
        needsFormatSelection: false,
        activeJobId: result.job_id,
        detectedFormat: format,
      });
      await get().loadMailboxes();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Erro ao iniciar parsing';
      throw new Error(msg);
    }
  },
  
  loadParseErrors: async (mailboxId: string) => {
    try {
      const data = await api.getParseErrors(mailboxId);
      set({ parseErrors: data.errors || [] });
    } catch {
      set({ parseErrors: [] });
    }
  },
  setShowErrorsModal: (show: boolean) => set({ showErrorsModal: show }),

  setSidebarWidth: (w: number) => set({ sidebarWidth: Math.max(180, Math.min(400, w)) }),
  setListWidth: (w: number) => set({ listWidth: Math.max(240, Math.min(600, w)) }),

  exportSelectedPdf: async () => {
    const { activeMailboxId, selectedEmailIds, selectedEmailId } = get();
    if (!activeMailboxId) return;

    const ids = selectedEmailIds.size > 0 ? Array.from(selectedEmailIds) : selectedEmailId ? [selectedEmailId] : [];
    if (ids.length === 0) return;

    let blob: Blob;
    if (ids.length === 1) {
      blob = await api.exportEmailPdf(ids[0]);
    } else {
      blob = await api.exportBatchPdf(activeMailboxId, ids);
    }

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ids.length === 1 ? 'email.pdf' : 'emails_export.pdf';
    a.click();
    URL.revokeObjectURL(url);
  },

  exportEmailZip: async (emailId: string) => {
    const { activeMailboxId, emailDetail } = get();
    if (!activeMailboxId || !emailId) return;

    const blob = await api.exportEmailZip(activeMailboxId, emailId);

    // Derive filename from sender displayed name (same logic as backend)
    const sender = emailDetail?.sender || '';
    const nameMatch = sender.match(/^"?([^<"]+)"?\s*</);
    const senderName = nameMatch ? nameMatch[1].trim() : sender.split('@')[0];
    const safeName = senderName.replace(/[^\w\s\-.]/g, '').trim().replace(/\s+/g, '_') || 'email';
    const zipName = `${safeName}.zip`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(url);
  },

  loadTags: async () => {
    const tags = await api.getAllTags();
    set({ tags });
  },

  setSelectedTagFilter: (tagId: string | null) => {
    set({
      selectedTagFilter: tagId,
      activeFilter: tagId ? 'all' : 'all', // Reset filter when selecting a specific tag
      emails: [],
      nextCursor: null,
      selectedEmailId: null,
      emailDetail: null,
      selectedEmailIds: new Set(),
      selectedFolderPath: null, // clear folder selection if picking a tag globally
    });
    get().loadEmails();
  },

  updateEmailTags: (emailId: string, tags: Tag[]) => {
    set((state) => {
      const emails = state.emails.map((e) => (e.id === emailId ? { ...e, tags } : e));
      const emailDetail = state.emailDetail?.id === emailId ? { ...state.emailDetail, tags } : state.emailDetail;
      return { emails, emailDetail };
    });
  },
}));
