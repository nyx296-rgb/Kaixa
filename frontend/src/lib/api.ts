// lib/api.ts
// Axios API client for the MailExplorer backend

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth Interceptor ──

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !err?.config?.url?.includes('/auth/')) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// ── Types ──

export interface Folder {
  id: string;
  mailbox_id: string;
  name: string;
  full_path: string;
  parent_id: string | null;
  total_count: number;
  unread_count: number;
  children: Folder[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at?: number;
}

export interface EmailSummary {
  id: string;
  mailbox_id: string;
  folder_path: string;
  subject: string | null;
  sender: string | null;
  recipients: string[];
  cc: string[];
  bcc: string[];
  date_ts: number;
  is_read: boolean;
  importance: string;
  has_attach: boolean;
  body_preview: string | null;
  tags?: Tag[];
}

export interface EmailDetail extends EmailSummary {
  body_text: string | null;
  body_html: string | null;
  parse_error: string | null;
  attachments: Attachment[];
}

export interface Attachment {
  id: string;
  email_id: string;
  filename: string;
  mime_type: string;
  size: number;
  raw_offset: number | null;
}

export interface Mailbox {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_format: string;
  encoding?: string | null;
  created_at: number;
  last_opened: number;
}

export interface Highlight {
  id: string;
  email_id: string;
  start_pos: number;
  end_pos: number;
  color: string;
  note?: string | null;
  created_at: number;
}

export interface JobProgress {
  status: string;
  progress: number;
  indexed: number;
  total: number;
  current_folder?: string | null;
  error?: string;
}

export interface EmailListResponse {
  emails: EmailSummary[];
  next_cursor: { after_date_ts: number; after_id: string } | null;
}

// ── API Calls ──

export async function openMailbox(path: string) {
  const res = await api.post('/mailbox/open', { path });
  return res.data as { mailbox_id: string; job_id: string; format: string };
}

export async function uploadMailbox(
  files: FileList | File[],
  onProgress?: (progressEvent: any) => void
): Promise<{ mailbox_id: string; job_id: string | null; format: string; needs_format?: boolean }> {
  const THRESHOLD = 50 * 1024 * 1024; // 50MB

  const largeFiles: File[] = [];
  const smallFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > THRESHOLD) {
      largeFiles.push(file);
    } else {
      smallFiles.push(file);
    }
  }

  // If there's a single large file, use TUS
  if (largeFiles.length === 1 && smallFiles.length === 0) {
    return uploadMailboxTus(largeFiles[0], onProgress);
  }

  // If there are large files mixed with small files, upload large ones via TUS
  // and small ones via POST, then return the last result
  if (largeFiles.length > 0) {
    let lastResult: any = null;

    // Upload large files one by one via TUS
    for (const file of largeFiles) {
      lastResult = await uploadMailboxTus(file, (progressEvent: any) => {
        if (onProgress) onProgress(progressEvent);
      });
    }

    // Upload small files via POST if any
    if (smallFiles.length > 0) {
      const form = new FormData();
      for (const file of smallFiles) {
        const path = file.webkitRelativePath || file.name;
        form.append('files', file, path);
      }
      const res = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: onProgress,
      });
      lastResult = res.data;
    }

    return lastResult!;
  }

  // All files are small: standard FormData upload
  const form = new FormData();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = file.webkitRelativePath || file.name;
    form.append('files', file, path);
  }
  const res = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: onProgress,
  });
  return res.data;
}

// ── TUS Resumable Upload ──

async function uploadMailboxTus(
  file: File,
  onProgress?: (progressEvent: any) => void
): Promise<{ mailbox_id: string; job_id: string | null; format: string; needs_format?: boolean }> {
  const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
  const tusUrl = `${baseUrl}/upload-tus`;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  // 1. Create upload
  const createRes = await fetch(tusUrl, {
    method: 'POST',
    headers: {
      'Upload-Length': file.size.toString(),
      'Upload-Metadata': `filename ${btoa(file.webkitRelativePath || file.name)}`,
      'Tus-Resumable': '1.0.0',
    },
  });

  if (!createRes.ok) {
    throw new Error(`TUS create failed: ${createRes.status}`);
  }

  const location = createRes.headers.get('Location') || `${tusUrl}/${createRes.headers.get('Upload-Offset')}`;
  const uploadId = location.split('/').pop()!;

  // 2. Check existing offset (resume support)
  let offset = 0;
  try {
    const headRes = await fetch(`${tusUrl}/${uploadId}`, { method: 'HEAD' });
    if (headRes.ok) {
      offset = parseInt(headRes.headers.get('Upload-Offset') || '0', 10);
    }
  } catch {}

  // 3. Upload chunks
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);

    const patchRes = await fetch(`${tusUrl}/${uploadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': offset.toString(),
        'Tus-Resumable': '1.0.0',
      },
      body: chunk,
    });

    if (!patchRes.ok) {
      if (patchRes.status === 409) {
        // Offset mismatch — re-read from server
        const headRes2 = await fetch(`${tusUrl}/${uploadId}`, { method: 'HEAD' });
        offset = parseInt(headRes2.headers.get('Upload-Offset') || '0', 10);
        continue;
      }
      throw new Error(`TUS patch failed: ${patchRes.status}`);
    }

    offset = parseInt(patchRes.headers.get('Upload-Offset') || end.toString(), 10);

    if (onProgress) {
      onProgress({ loaded: offset, total: file.size });
    }
  }

  // 4. Poll processing status
  const uploadIdClean = location.split('/').pop()!;
  let status = 'in_progress';
  let attempts = 0;
  const maxAttempts = 600; // 10 min max

  while (status === 'in_progress' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;

    const statusRes = await fetch(`${tusUrl}/${uploadIdClean}/status`);
    if (statusRes.ok) {
      const data = await statusRes.json();
      status = data.status;

      if (status === 'processed' && data.mailbox_id) {
        return {
          mailbox_id: data.mailbox_id,
          job_id: null,
          format: 'mbox',
          needs_format: false,
        };
      }

      if (status === 'error') {
        throw new Error(data.error || 'Upload processing failed');
      }
    }
  }

  throw new Error('Upload processing timed out');
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const res = await api.get('/mailboxes');
  return res.data;
}

export async function deleteMailbox(mailboxId: string) {
  await api.delete(`/mailbox/${mailboxId}`);
}

export async function updateMailboxFormat(mailboxId: string, format: string) {
  await api.patch(`/mailbox/${mailboxId}/format`, { format });
}

export async function openMailboxById(mailboxId: string): Promise<{ job_id: string }> {
  const res = await api.post(`/mailbox/${mailboxId}/open-by-id`);
  return res.data;
}

export async function getFolders(mailboxId: string): Promise<Folder[]> {
  const res = await api.get(`/mailbox/${mailboxId}/folders`);
  return res.data;
}

export async function listEmails(
  mailboxId: string,
  params: {
    folder?: string;
    limit?: number;
    after_date_ts?: number;
    after_id?: string;
    sort?: string;
    order?: string;
    search?: string;
    tag_id?: string;
    unread?: boolean;
    has_attach?: boolean;
  } = {},
): Promise<EmailListResponse> {
  const res = await api.get(`/mailbox/${mailboxId}/emails`, { params });
  return res.data;
}

export async function getEmailDetail(mailboxId: string, emailId: string): Promise<EmailDetail> {
  const res = await api.get(`/mailbox/${mailboxId}/email/${emailId}`);
  return res.data;
}

export async function exportEmailPdf(emailId: string): Promise<Blob> {
  const res = await api.post(`/email/${emailId}/export-pdf`, null, { responseType: 'blob' });
  return res.data;
}

export async function exportBatchPdf(mailboxId: string, emailIds: string[]): Promise<Blob> {
  const res = await api.post(`/mailbox/${mailboxId}/export-pdf`, emailIds, { responseType: 'blob' });
  return res.data;
}

export async function exportEmailZip(mailboxId: string, emailId: string): Promise<Blob> {
  const res = await api.get(`/mailbox/${mailboxId}/email/${emailId}/export-zip`, { responseType: 'blob', timeout: 0 });
  return res.data;
}

export async function getJobStatus(jobId: string): Promise<JobProgress> {
  const res = await api.get(`/jobs/${jobId}`);
  return res.data;
}

export async function cancelJob(jobId: string) {
  await api.post(`/jobs/${jobId}/cancel`);
}

export async function getParseErrors(mailboxId: string) {
  const res = await api.get(`/mailbox/${mailboxId}/parse-errors`);
  return res.data;
}

export function getAttachmentUrl(attachmentId: string): string {
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/attachment/${attachmentId}`;
}

/** Returns a URL that serves the attachment inline (no download prompt). */
export function getAttachmentPreviewUrl(attachmentId: string): string {
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/attachment/${attachmentId}?inline=true`;
}

// ── Highlights ──

export async function createHighlight(
  emailId: string,
  start_pos: number,
  end_pos: number,
  color: string = 'yellow',
  note?: string
): Promise<Highlight> {
  const res = await api.post(`/emails/${emailId}/highlights`, {
    start_pos,
    end_pos,
    color,
    note,
  });
  return res.data;
}

export async function getHighlights(emailId: string): Promise<Highlight[]> {
  const res = await api.get(`/emails/${emailId}/highlights`);
  return res.data;
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  await api.delete(`/highlights/${highlightId}`);
}

// ── Tags ──

export async function getAllTags(): Promise<Tag[]> {
  const res = await api.get('/tags');
  return res.data;
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const res = await api.post('/tags', { name, color });
  return res.data;
}

export async function updateTag(tagId: string, name: string, color: string): Promise<Tag> {
  const res = await api.put(`/tags/${tagId}`, { name, color });
  return res.data;
}

export async function deleteTag(tagId: string): Promise<void> {
  await api.delete(`/tags/${tagId}`);
}

export async function assignTagToEmail(emailId: string, tagId: string): Promise<void> {
  await api.post(`/emails/${emailId}/tags`, { tag_id: tagId });
}

export async function removeTagFromEmail(emailId: string, tagId: string): Promise<void> {
  await api.delete(`/emails/${emailId}/tags/${tagId}`);
}

// ── Auth ──

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await api.post('/auth/login', { username, password });
  return res.data;
}

export async function register(username: string, password: string): Promise<LoginResponse> {
  const res = await api.post('/auth/register', { username, password });
  return res.data;
}

export async function getMe(): Promise<AuthUser> {
  const res = await api.get('/auth/me');
  return res.data;
}

// ── Superadmin ──

export async function superadminLogin(password: string): Promise<LoginResponse> {
  const res = await api.post('/auth/superadmin/login', { password });
  return res.data;
}

export interface BetaUser {
  id: string;
  username: string;
  role: string;
  created_at: number;
  expires_at: number | null;
}

export async function listUsers(): Promise<BetaUser[]> {
  const res = await api.get('/admin/users');
  return res.data;
}

export async function createBetaUser(username: string, password: string, expires_at: number | null): Promise<BetaUser> {
  const res = await api.post('/admin/users', { username, password, expires_at });
  return res.data;
}

export async function updateUser(userId: string, data: { expires_at?: number | null; role?: string }): Promise<BetaUser> {
  const res = await api.put(`/admin/users/${userId}`, data);
  return res.data;
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

// ── Notifications ──

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: number;
  read: boolean;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const res = await api.get('/notifications');
  return res.data;
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await api.get('/notifications/unread-count');
  return res.data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.put(`/notifications/${notificationId}/read`);
}

export async function createNotification(title: string, message: string, type: string = 'info'): Promise<NotificationItem> {
  const res = await api.post('/notifications', { title, message, type });
  return res.data;
}

export async function reportBug(description: string, steps?: string): Promise<void> {
  await api.post('/report-bug', { description, steps });
}

export default api;
