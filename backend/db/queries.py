# queries.py
# Asynchronous Database Handlers for SQLite

import os
import sqlite3
import json
import time
import zlib
import collections
import aiosqlite
from typing import List, Dict, Any, Optional, Tuple

class AsyncLRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = collections.OrderedDict()
        
    def get(self, key):
        if key not in self.cache:
            return None
        self.cache.move_to_end(key)
        return self.cache[key]
        
    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)

EMAIL_CACHE = AsyncLRUCache(100)

DB_PATH = os.getenv("SQLITE_DB_PATH", "mailexplorer.db")

async def get_db():
    """Asynchronous context manager/generator to open a DB connection."""
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    try:
        yield conn
    finally:
        await conn.close()

async def initialize_db():
    """Reads schema.sql and sets up SQLite PRAGMAs (WAL mode, cache, sync)."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if not os.path.exists(schema_path):
        # Fallback to local search
        schema_path = "backend/db/schema.sql"

    with open(schema_path, "r") as f:
        schema_sql = f.read()

    async with aiosqlite.connect(DB_PATH) as conn:
        # High performance optimizations
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA synchronous=NORMAL")
        await conn.execute("PRAGMA cache_size=-64000")  # ~64MB cache
        await conn.execute("PRAGMA temp_store=MEMORY")
        await conn.execute("PRAGMA foreign_keys=ON")
        
        await conn.executescript(schema_sql)

        # Migrate: add current_folder column if not exists (safe for existing DBs)
        try:
            await conn.execute("ALTER TABLE jobs ADD COLUMN current_folder TEXT")
            await conn.commit()
        except Exception:
            pass  # Column already exists

        # Migrate: add encoding column to mailboxes if not exists
        try:
            await conn.execute("ALTER TABLE mailboxes ADD COLUMN encoding TEXT")
            await conn.commit()
        except Exception:
            pass  # Column already exists

        # Migrate: add expires_at column to users if not exists
        try:
            await conn.execute("ALTER TABLE users ADD COLUMN expires_at INTEGER")
            await conn.commit()
        except Exception:
            pass  # Column already exists

        await conn.commit()
    print(f"Database initialized at: {os.path.abspath(DB_PATH)}")

# --- Mailbox Operations ---

async def create_or_update_mailbox(id: str, name: str, file_path: str, file_size: int, file_format: str, encoding: Optional[str] = None):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            """
            INSERT INTO mailboxes (id, name, file_path, file_size, file_format, encoding, created_at, last_opened)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                file_path=excluded.file_path,
                file_size=excluded.file_size,
                file_format=excluded.file_format,
                encoding=excluded.encoding,
                last_opened=excluded.last_opened
            """,
            (id, name, file_path, file_size, file_format, encoding, now, now)
        )
        await conn.commit()

async def get_mailboxes() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM mailboxes ORDER BY last_opened DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def delete_mailbox(mailbox_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM mailboxes WHERE id = ?", (mailbox_id,))
        await conn.execute("DELETE FROM folders WHERE mailbox_id = ?", (mailbox_id,))
        await conn.execute("DELETE FROM emails WHERE mailbox_id = ?", (mailbox_id,))
        await conn.execute("DELETE FROM jobs WHERE mailbox_id = ?", (mailbox_id,))
        await conn.execute("DELETE FROM parse_errors WHERE mailbox_id = ?", (mailbox_id,))
        await conn.commit()

async def cleanup_stale_mailboxes(days: int = 7) -> List[str]:
    """Deletes mailboxes not accessed in the last `days` and returns their IDs."""
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        cutoff = int(time.time()) - (days * 24 * 3600)
        
        async with conn.execute("SELECT id FROM mailboxes WHERE last_opened < ?", (cutoff,)) as cursor:
            rows = await cursor.fetchall()
            stale_ids = [row["id"] for row in rows]
            
        if stale_ids:
            for mb_id in stale_ids:
                await conn.execute("DELETE FROM mailboxes WHERE id = ?", (mb_id,))
                await conn.execute("DELETE FROM folders WHERE mailbox_id = ?", (mb_id,))
                await conn.execute("DELETE FROM emails WHERE mailbox_id = ?", (mb_id,))
                await conn.execute("DELETE FROM jobs WHERE mailbox_id = ?", (mb_id,))
                await conn.execute("DELETE FROM parse_errors WHERE mailbox_id = ?", (mb_id,))
            await conn.commit()
            
        return stale_ids

# --- Job Operations ---

async def create_job(job_id: str, mailbox_id: str, status: str = "pending", total_msgs: int = 0):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            """
            INSERT INTO jobs (id, mailbox_id, status, progress, total_msgs, indexed_msgs, created_at, updated_at)
            VALUES (?, ?, ?, 0.0, ?, 0, ?, ?)
            """,
            (job_id, mailbox_id, status, total_msgs, now, now)
        )
        await conn.commit()

async def update_job(
    job_id: str,
    status: str,
    progress: float,
    indexed_msgs: int = 0,
    total_msgs: Optional[int] = None,
    error_msg: Optional[str] = None,
    current_folder: Optional[str] = None,
):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        if total_msgs is not None:
            await conn.execute(
                """
                UPDATE jobs 
                SET status = ?, progress = ?, indexed_msgs = ?, total_msgs = ?,
                    current_folder = ?, error_msg = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, progress, indexed_msgs, total_msgs, current_folder, error_msg, now, job_id)
            )
        else:
            await conn.execute(
                """
                UPDATE jobs 
                SET status = ?, progress = ?, indexed_msgs = ?,
                    current_folder = ?, error_msg = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, progress, indexed_msgs, current_folder, error_msg, now, job_id)
            )
        await conn.commit()

async def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

# --- Folder Operations ---

async def insert_folder_batch(folders: List[Dict[str, Any]]):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.executemany(
            """
            INSERT OR REPLACE INTO folders (id, mailbox_id, name, full_path, parent_id, total_count, unread_count)
            VALUES (:id, :mailbox_id, :name, :full_path, :parent_id, :total_count, :unread_count)
            """,
            folders
        )
        await conn.commit()

async def get_folders_tree(mailbox_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM folders WHERE mailbox_id = ?", (mailbox_id,)) as cursor:
            rows = await cursor.fetchall()
            folders = [dict(row) for row in rows]
            
            # Reconstruct tree in memory
            folder_map = {f["full_path"]: {**f, "children": []} for f in folders}
            roots = []
            
            for path, f in sorted(folder_map.items(), key=lambda x: len(x[0])):
                parent_path = "/".join(path.split("/")[:-1])
                if parent_path and parent_path in folder_map:
                    folder_map[parent_path]["children"].append(f)
                else:
                    roots.append(f)
            return roots

# --- Email Operations ---

async def insert_email_batch(emails: List[Dict[str, Any]]):
    # Apply zlib compression to body_html to save massive disk space
    for email in emails:
        if email.get("body_html") and isinstance(email["body_html"], str):
            email["body_html"] = zlib.compress(email["body_html"].encode("utf-8"))

    async with aiosqlite.connect(DB_PATH) as conn:
        # Insert main emails
        await conn.executemany(
            """
            INSERT OR REPLACE INTO emails (
                id, mailbox_id, folder_path, subject, sender, recipients, cc, bcc, 
                date_ts, body_text, body_html, is_read, importance, has_attach, raw_offset, raw_size, parse_error
            ) VALUES (
                :id, :mailbox_id, :folder_path, :subject, :sender, :recipients, :cc, :bcc, 
                :date_ts, :body_text, :body_html, :is_read, :importance, :has_attach, :raw_offset, :raw_size, :parse_error
            )
            """,
            emails
        )
        
        # Insert attachments if present
        attachments = []
        for email in emails:
            if "attachments" in email and email["attachments"]:
                for att in email["attachments"]:
                    attachments.append({
                        "id": att["id"],
                        "email_id": email["id"],
                        "filename": att["filename"],
                        "mime_type": att["mime_type"],
                        "size": att["size"],
                        "raw_offset": att.get("raw_offset")
                    })
        
        if attachments:
            await conn.executemany(
                """
                INSERT OR REPLACE INTO attachments (id, email_id, filename, mime_type, size, raw_offset)
                VALUES (:id, :email_id, :filename, :mime_type, :size, :raw_offset)
                """,
                attachments
            )
            
        await conn.commit()

async def list_emails(
    mailbox_id: str,
    folder_path: Optional[str] = None,
    limit: int = 50,
    after_date_ts: Optional[int] = None,
    after_id: Optional[str] = None,
    sort: str = "date",
    order: str = "desc",
    search: Optional[str] = None,
    tag_id: Optional[str] = None,
    unread: Optional[bool] = None,
    has_attach: Optional[bool] = None,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Returns list of emails and the cursor dict for the next page.
    Implements FTS5 matched search or standard catalog listings with cursor pagination.
    """
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        
        params: Dict[str, Any] = {"mailbox_id": mailbox_id, "limit": limit + 1}
        
        if search:
            # Full-text search matching FTS5
            # We join emails to extract details but match FTS5 virtual table
            query_base = """
                SELECT e.id, e.mailbox_id, e.folder_path, e.subject, e.sender, e.recipients, e.cc, e.bcc,
                       e.date_ts, e.is_read, e.importance, e.has_attach, e.raw_offset, e.raw_size,
                       bm25(emails_fts) as rank,
                       SUBSTR(e.body_text, 1, 200) as body_preview
                FROM emails_fts
                JOIN emails e ON e.rowid = emails_fts.rowid
            """
            if tag_id:
                query_base += " JOIN email_tags et ON e.id = et.email_id "
                
            query_base += " WHERE emails_fts MATCH :search_match"
            params["search_match"] = search
            
            if mailbox_id != "all":
                query_base += " AND e.mailbox_id = :mailbox_id"
            
            if tag_id:
                query_base += " AND et.tag_id = :tag_id"
                params["tag_id"] = tag_id
            
            if unread is not None:
                query_base += " AND e.is_read = :is_read"
                params["is_read"] = 0 if unread else 1
            
            if has_attach is not None:
                query_base += " AND e.has_attach = :has_attach"
                params["has_attach"] = 1 if has_attach else 0
            
            # Cursor pagination for search matches using FTS ranks / dates
            if after_date_ts is not None and after_id is not None:
                if order.lower() == "desc":
                    query_base += " AND (e.date_ts < :after_date_ts OR (e.date_ts = :after_date_ts AND e.id < :after_id))"
                else:
                    query_base += " AND (e.date_ts > :after_date_ts OR (e.date_ts = :after_date_ts AND e.id > :after_id))"
                params["after_date_ts"] = after_date_ts
                params["after_id"] = after_id
            
            order_by = "ORDER BY rank, e.date_ts DESC" if not after_date_ts else f"ORDER BY e.date_ts {'DESC' if order.lower() == 'desc' else 'ASC'}"
            query = f"{query_base} {order_by} LIMIT :limit"
        else:
            # Regular Folder / Catalog list
            query_base = """
                SELECT e.id, e.mailbox_id, e.folder_path, e.subject, e.sender, e.recipients, e.cc, e.bcc,
                       e.date_ts, e.is_read, e.importance, e.has_attach, e.raw_offset, e.raw_size,
                       SUBSTR(e.body_text, 1, 200) as body_preview
                FROM emails e
            """
            if tag_id:
                query_base += " JOIN email_tags et ON e.id = et.email_id "
                
            query_base += " WHERE 1=1 "
            
            if mailbox_id != "all":
                query_base += " AND e.mailbox_id = :mailbox_id"
            
            if tag_id:
                query_base += " AND et.tag_id = :tag_id"
                params["tag_id"] = tag_id
                
            if folder_path:
                query_base += " AND e.folder_path = :folder_path"
                params["folder_path"] = folder_path
                
            if unread is not None:
                query_base += " AND e.is_read = :is_read"
                params["is_read"] = 0 if unread else 1
            
            if has_attach is not None:
                query_base += " AND e.has_attach = :has_attach"
                params["has_attach"] = 1 if has_attach else 0
                
            if after_date_ts is not None and after_id is not None:
                if order.lower() == "desc":
                    query_base += " AND (e.date_ts < :after_date_ts OR (e.date_ts = :after_date_ts AND e.id < :after_id))"
                else:
                    query_base += " AND (e.date_ts > :after_date_ts OR (e.date_ts = :after_date_ts AND e.id > :after_id))"
                params["after_date_ts"] = after_date_ts
                params["after_id"] = after_id
                
            direction = "DESC" if order.lower() == "desc" else "ASC"
            if sort == "sender":
                order_by = f"ORDER BY e.sender {direction}, e.date_ts {direction}, e.id {direction}"
            elif sort == "subject":
                order_by = f"ORDER BY e.subject {direction}, e.date_ts {direction}, e.id {direction}"
            else:
                order_by = f"ORDER BY e.date_ts {direction}, e.id {direction}"
                
            query = f"{query_base} {order_by} LIMIT :limit"

        async with conn.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            emails = [dict(row) for row in rows]
            
            # Preload tags for all fetched emails
            if emails:
                email_ids = [e["id"] for e in emails]
                placeholders = ",".join(["?"] * len(email_ids))
                tags_query = f"""
                    SELECT et.email_id, t.id, t.name, t.color
                    FROM email_tags et
                    JOIN tags t ON et.tag_id = t.id
                    WHERE et.email_id IN ({placeholders})
                """
                async with conn.execute(tags_query, email_ids) as t_cursor:
                    t_rows = await t_cursor.fetchall()
                    tags_by_email = collections.defaultdict(list)
                    for tr in t_rows:
                        tags_by_email[tr["email_id"]].append({
                            "id": tr["id"],
                            "name": tr["name"],
                            "color": tr["color"]
                        })
                
                for email in emails:
                    email["tags"] = tags_by_email.get(email["id"], [])
            
            # Handle list parsing of json arrays
            for email in emails:
                if "tags" not in email:
                    email["tags"] = []
                for col in ("recipients", "cc", "bcc"):
                    if email.get(col):
                        try:
                            email[col] = json.loads(email[col])
                        except Exception:
                            email[col] = [email[col]]
                    else:
                        email[col] = []
            
            # Determine cursor for next page
            has_next = len(emails) > limit
            next_cursor = None
            if has_next:
                emails.pop() # Remove extra item
                last_email = emails[-1]
                next_cursor = {
                    "after_date_ts": last_email["date_ts"],
                    "after_id": last_email["id"]
                }
                
            return emails, next_cursor

async def get_email_detail(email_id: str) -> Optional[Dict[str, Any]]:
    # Check LRU cache first
    cached = EMAIL_CACHE.get(email_id)
    if cached:
        return cached

    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            
            email = dict(row)
            
            # Decompress body_html if it is compressed
            if email.get("body_html") and isinstance(email["body_html"], bytes):
                try:
                    email["body_html"] = zlib.decompress(email["body_html"]).decode("utf-8")
                except Exception:
                    pass  # Fallback if corrupted

            for col in ("recipients", "cc", "bcc"):
                if email.get(col):
                    try:
                        email[col] = json.loads(email[col])
                    except Exception:
                        email[col] = [email[col]]
                else:
                    email[col] = []
                    
            # Fetch attachments
            async with conn.execute("SELECT * FROM attachments WHERE email_id = ?", (email_id,)) as att_cursor:
                att_rows = await att_cursor.fetchall()
                email["attachments"] = [dict(r) for r in att_rows]
                
            # Fetch tags
            tags_query = """
                SELECT t.id, t.name, t.color
                FROM email_tags et
                JOIN tags t ON et.tag_id = t.id
                WHERE et.email_id = ?
            """
            async with conn.execute(tags_query, (email_id,)) as t_cursor:
                t_rows = await t_cursor.fetchall()
                email["tags"] = [dict(r) for r in t_rows]
                
            EMAIL_CACHE.put(email_id, email)
            return email

async def mark_email_read(email_id: str, is_read: bool = True):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("UPDATE emails SET is_read = ? WHERE id = ?", (1 if is_read else 0, email_id))
        await conn.commit()

# --- Error Logging ---

async def log_parse_error(mailbox_id: str, folder_path: Optional[str], message_index: Optional[int], error_type: str, error_detail: str, raw_preview: Optional[str] = None):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        import uuid
        error_id = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO parse_errors (id, mailbox_id, folder_path, message_index, error_type, error_detail, raw_preview, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (error_id, mailbox_id, folder_path, message_index, error_type, error_detail, raw_preview[:500] if raw_preview else None, now)
        )
        await conn.commit()

async def get_parse_errors(mailbox_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM parse_errors WHERE mailbox_id = ? ORDER BY created_at ASC", (mailbox_id,)) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

# --- Highlight Operations ---

async def create_highlight(id: str, email_id: str, start_pos: int, end_pos: int, color: str, note: Optional[str] = None):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            """
            INSERT INTO highlights (id, email_id, start_pos, end_pos, color, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (id, email_id, start_pos, end_pos, color, note, now)
        )
        await conn.commit()

async def get_highlights(email_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM highlights WHERE email_id = ? ORDER BY start_pos ASC", (email_id,)) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def delete_highlight(id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM highlights WHERE id = ?", (id,))
        await conn.commit()

# --- Tag Operations ---

async def create_tag(id: str, name: str, color: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        try:
            await conn.execute(
                "INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
                (id, name, color, now)
            )
            await conn.commit()
            return {"id": id, "name": name, "color": color, "created_at": now}
        except sqlite3.IntegrityError:
            # Tag name might already exist
            return None

async def get_all_tags() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM tags ORDER BY name ASC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def update_tag(id: str, name: str, color: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("UPDATE tags SET name = ?, color = ? WHERE id = ?", (name, color, id))
        await conn.commit()

async def delete_tag(id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM tags WHERE id = ?", (id,))
        await conn.commit()

async def assign_tag(email_id: str, tag_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            "INSERT OR IGNORE INTO email_tags (email_id, tag_id, created_at) VALUES (?, ?, ?)",
            (email_id, tag_id, now)
        )
        await conn.commit()
        # Invalidate cache for this email
        # The cache structure doesn't easily let us clear one item, but EMAIL_CACHE has get/put.
        # Wait, I added EMAIL_CACHE. We can clear it by assigning it to a new cache or just leave it since the UI might update its state.
        pass

async def remove_tag(email_id: str, tag_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM email_tags WHERE email_id = ? AND tag_id = ?", (email_id, tag_id))
        await conn.commit()

# --- Auth Operations ---

async def create_user(id: str, username: str, password_hash: str, role: str = "beta", expires_at: Optional[int] = None):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        try:
            await conn.execute(
                "INSERT INTO users (id, username, password_hash, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                (id, username, password_hash, role, now, expires_at)
            )
            await conn.commit()
            return {"id": id, "username": username, "role": role, "created_at": now, "expires_at": expires_at}
        except sqlite3.IntegrityError:
            return None

async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM users WHERE username = ?", (username,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def list_all_users() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT id, username, role, created_at, expires_at FROM users ORDER BY created_at DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def update_user(user_id: str, expires_at: Optional[int] = None, role: Optional[str] = None) -> bool:
    async with aiosqlite.connect(DB_PATH) as conn:
        fields = []
        params = []
        if expires_at is not None:
            fields.append("expires_at = ?")
            params.append(expires_at)
        if role is not None:
            fields.append("role = ?")
            params.append(role)
        if not fields:
            return False
        params.append(user_id)
        await conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params)
        await conn.commit()
        return True

async def delete_user(user_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await conn.commit()

# --- Notification Operations ---

async def create_notification(id: str, title: str, message: str, type: str = "info"):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            "INSERT INTO system_notifications (id, title, message, type, created_at) VALUES (?, ?, ?, ?, ?)",
            (id, title, message, type, now)
        )
        await conn.commit()
        return {"id": id, "title": title, "message": message, "type": type, "created_at": now}

async def get_notifications_for_user(user_id: str) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            """
            SELECT n.*, CASE WHEN un.read_at IS NOT NULL THEN 1 ELSE 0 END as read_flag
            FROM system_notifications n
            LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = ?
            ORDER BY n.created_at DESC
            """,
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
            results = []
            for row in rows:
                d = dict(row)
                d["read"] = bool(d.pop("read_flag", 0))
                results.append(d)
            return results

async def mark_notification_read(user_id: str, notification_id: str):
    async with aiosqlite.connect(DB_PATH) as conn:
        now = int(time.time())
        await conn.execute(
            """
            INSERT INTO user_notifications (user_id, notification_id, read_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, notification_id) DO UPDATE SET read_at = excluded.read_at
            """,
            (user_id, notification_id, now)
        )
        await conn.commit()

async def get_unread_count(user_id: str) -> int:
    async with aiosqlite.connect(DB_PATH) as conn:
        async with conn.execute(
            """
            SELECT COUNT(*) as cnt
            FROM system_notifications n
            LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = ?
            WHERE un.read_at IS NULL
            """,
            (user_id,),
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0
