-- schema.sql
-- SQLite Schema for MailExplorer

PRAGMA foreign_keys = ON;

-- 1. Main Emails table
CREATE TABLE IF NOT EXISTS emails (
    id          TEXT PRIMARY KEY,
    mailbox_id  TEXT NOT NULL,
    folder_path TEXT NOT NULL,
    subject     TEXT,
    sender      TEXT,
    recipients  TEXT,  -- JSON array of strings
    cc          TEXT,  -- JSON array of strings
    bcc         TEXT,  -- JSON array of strings
    date_ts     INTEGER,  -- Unix timestamp for sorting
    body_text   TEXT,
    body_html   BLOB,
    is_read     INTEGER DEFAULT 0,
    importance  TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    has_attach  INTEGER DEFAULT 0,
    raw_offset  INTEGER,  -- Byte offset in raw file or internal index
    raw_size    INTEGER,  -- Raw email size in bytes
    parse_error TEXT      -- Capture any individual message parse warnings/errors
);

-- Indexing for fast retrieval
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_folder ON emails(mailbox_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(mailbox_id, date_ts DESC);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(mailbox_id, sender);

-- 2. Folders tree table
CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    mailbox_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    full_path   TEXT NOT NULL,
    parent_id   TEXT,
    total_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_mailbox ON folders(mailbox_id);

-- 3. Attachments metadata table (contents streamed on-demand via offset/raw identifier)
CREATE TABLE IF NOT EXISTS attachments (
    id          TEXT PRIMARY KEY,
    email_id    TEXT NOT NULL,
    filename    TEXT,
    mime_type   TEXT,
    size        INTEGER,
    raw_offset  INTEGER, -- Byte offset or attachment index in original file
    FOREIGN KEY(email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);

-- 4. Jobs tracking table
CREATE TABLE IF NOT EXISTS jobs (
    id             TEXT PRIMARY KEY,
    mailbox_id     TEXT NOT NULL,
    status         TEXT NOT NULL, -- 'pending', 'parsing', 'indexing', 'ready', 'error', 'cancelled'
    progress       REAL DEFAULT 0,
    total_msgs     INTEGER DEFAULT 0,
    indexed_msgs   INTEGER DEFAULT 0,
    current_folder TEXT,          -- pasta sendo processada no momento (PST)
    error_msg      TEXT,
    created_at     INTEGER,
    updated_at     INTEGER
);

-- 5. Parsing Errors / Mailbox Corruption Logs
CREATE TABLE IF NOT EXISTS parse_errors (
    id            TEXT PRIMARY KEY,
    mailbox_id    TEXT NOT NULL,
    folder_path   TEXT,
    message_index INTEGER,
    error_type    TEXT, -- 'encoding' | 'truncated' | 'malformed_header' | 'attachment_corrupt' | 'unknown'
    error_detail  TEXT,
    raw_preview   TEXT, -- Storing first 500 bytes of raw message for debug
    created_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_parse_errors_mailbox ON parse_errors(mailbox_id);

-- 6. FTS5 Virtual Table for Search (External Content mapping 'emails')
CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
    subject, body_text, sender, recipients,
    content='emails',
    content_rowid='rowid'
);

-- Triggers to maintain emails_fts synchronized with emails
CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
    INSERT INTO emails_fts(rowid, subject, body_text, sender, recipients)
    VALUES (new.rowid, new.subject, new.body_text, new.sender, new.recipients);
END;

CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
    INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, sender, recipients)
    VALUES ('delete', old.rowid, old.subject, old.body_text, old.sender, old.recipients);
END;

CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
    INSERT INTO emails_fts(emails_fts, rowid, subject, body_text, sender, recipients)
    VALUES ('delete', old.rowid, old.subject, old.body_text, old.sender, old.recipients);
    INSERT INTO emails_fts(rowid, subject, body_text, sender, recipients)
    VALUES (new.rowid, new.subject, new.body_text, new.sender, new.recipients);
END;

-- 7. Mailbox Metadata / Opened Files history
CREATE TABLE IF NOT EXISTS mailboxes (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_size    INTEGER,
    file_format  TEXT, -- 'pst', 'ost', 'mbox', 'eml', 'msg'
    encoding     TEXT, -- detected encoding for text formats
    created_at   INTEGER,
    last_opened  INTEGER
);

-- 8. Text Highlights
CREATE TABLE IF NOT EXISTS highlights (
    id         TEXT PRIMARY KEY,
    email_id   TEXT NOT NULL,
    start_pos  INTEGER NOT NULL,
    end_pos    INTEGER NOT NULL,
    color      TEXT DEFAULT 'yellow',
    note       TEXT,
    created_at INTEGER,
    FOREIGN KEY(email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_email ON highlights(email_id);
-- 9. Tags
CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT DEFAULT 'blue',
    created_at INTEGER
);

-- 10. Email Tags (Many-to-Many)
CREATE TABLE IF NOT EXISTS email_tags (
    email_id   TEXT NOT NULL,
    tag_id     TEXT NOT NULL,
    created_at INTEGER,
    PRIMARY KEY(email_id, tag_id),
    FOREIGN KEY(email_id) REFERENCES emails(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_tags_tag ON email_tags(tag_id);

-- 11. Users (Beta Testers)
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'beta',
    created_at    INTEGER,
    expires_at    INTEGER
);

-- 12. System Notifications
CREATE TABLE IF NOT EXISTS system_notifications (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    message    TEXT NOT NULL,
    type       TEXT DEFAULT 'info',
    created_at INTEGER
);

-- 13. User Notification Read Status
CREATE TABLE IF NOT EXISTS user_notifications (
    user_id         TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    read_at         INTEGER,
    PRIMARY KEY(user_id, notification_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(notification_id) REFERENCES system_notifications(id) ON DELETE CASCADE
);
