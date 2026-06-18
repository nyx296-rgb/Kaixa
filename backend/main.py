# main.py
# FastAPI application for Kaixa

import os
import sys
import json
import asyncio
import hashlib
import uuid
import time
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form, Query, Depends
from fastapi.datastructures import UploadFile as FastAPIUploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sse_starlette.sse import EventSourceResponse
import bcrypt
import jwt

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import queries
from models import (
    OpenMailboxRequest, OpenMailboxResponse, JobStatusSchema,
    EmailListSchema, EmailDetailSchema, FolderSchema, MailboxSchema,
    HighlightSchema, CreateHighlightRequest,
    TagSchema, CreateTagRequest, AssignTagRequest,
    RegisterRequest, LoginRequest, TokenResponse, UserSchema,
    NotificationSchema, CreateNotificationRequest,
    SuperadminLoginRequest, CreateBetaUserRequest, UpdateUserRequest,
)
from services.format_detector import detect_format
from services import job_manager
from services.pdf_export import render_email_to_pdf, render_batch_to_pdf
from services.tus_upload import setup_tus

# ── Auth Config ──
SECRET_KEY = os.getenv("JWT_SECRET", "mailexplorer-beta-secret-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "admin123")

security = HTTPBearer(auto_error=False)


UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))


def generate_mailbox_id(file_path: str) -> str:
    """Generates a deterministic mailbox ID from the file path."""
    return hashlib.sha256(file_path.encode()).hexdigest()[:16]

import shutil

async def cleanup_background_task():
    """Runs every 24h to clean up mailboxes not accessed in 7 days."""
    while True:
        try:
            mailboxes = await queries.get_mailboxes()
            cutoff = int(asyncio.get_event_loop().time()) - (7 * 24 * 3600)
            
            for mb in mailboxes:
                # We use time.time() for DB comparisons but here let's just do it properly
                import time
                real_cutoff = int(time.time()) - (7 * 24 * 3600)
                if mb.get("last_opened", 0) < real_cutoff:
                    await queries.delete_mailbox(mb["id"])
                    
                    # Delete physical files
                    if mb.get("file_path"):
                        abs_upload = os.path.abspath(UPLOAD_DIR)
                        abs_file = os.path.abspath(mb["file_path"])
                        if abs_file.startswith(abs_upload):
                            parent_dir = os.path.dirname(abs_file)
                            if os.path.isdir(parent_dir) and parent_dir != abs_upload:
                                shutil.rmtree(parent_dir, ignore_errors=True)
                            elif os.path.isfile(abs_file):
                                os.remove(abs_file)
        except Exception as e:
            print(f"Cleanup error: {e}")
            
        await asyncio.sleep(86400)  # Sleep 24 hours

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB on startup and start background tasks."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    await queries.initialize_db()
    
    # Create superadmin user if not exists
    sa = await queries.get_user_by_username("superadmin")
    if not sa:
        sa_id = str(uuid.uuid4())
        sa_hash = bcrypt.hashpw(SUPERADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await queries.create_user(sa_id, "superadmin", sa_hash, role="superadmin")
        print(f"Superadmin created (login: superadmin / password from SUPERADMIN_PASSWORD env)")
    
    # Start cleanup task
    cleanup_task = asyncio.create_task(cleanup_background_task())
    
    yield
    
    cleanup_task.cancel()


app = FastAPI(
    title="Kaixa API",
    description="Email Archive Reader — REST API",
    version="0.1.0",
    lifespan=lifespan,
)

# TUS resumable upload support (>1GB files)
setup_tus(app)

# CORS — configurable via env, defaults to dev origins
_cors_raw = os.getenv("CORS_ORIGINS", "")
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()] if _cors_raw else [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Location", "Upload-Offset", "Tus-Resumable", "Tus-Version",
        "Tus-Extension", "Tus-Max-Size", "Upload-Expires", "Upload-Length",
    ],
)


# ─────────────────────────────────────────────────
# Auth Helpers
# ─────────────────────────────────────────────────

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await queries.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    # Check expiry for beta users
    if user.get("expires_at") and user["expires_at"] < int(time.time()):
        raise HTTPException(status_code=403, detail="Conta expirada. Contate o administrador.")
    return user

async def get_current_superadmin(user=Depends(get_current_user)):
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Acesso restrito a superadmin")
    return user


# ─────────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────────

# ─────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    existing = await queries.get_user_by_username(req.username)
    if existing:
        raise HTTPException(400, "Nome de usuário já existe")
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user = await queries.create_user(user_id, req.username, password_hash)
    if not user:
        raise HTTPException(500, "Erro ao criar usuário")
    token = create_access_token(user_id)
    return TokenResponse(access_token=token, user=UserSchema(
        id=user["id"], username=user["username"], role=user["role"],
        created_at=user["created_at"], expires_at=user.get("expires_at")
    ))

@app.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await queries.get_user_by_username(req.username)
    if not user or not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Credenciais inválidas")
    # Check expiry
    if user.get("expires_at") and user["expires_at"] < int(time.time()):
        raise HTTPException(403, "Conta expirada. Contate o administrador.")
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=UserSchema(
        id=user["id"], username=user["username"], role=user["role"],
        created_at=user["created_at"], expires_at=user.get("expires_at")
    ))

@app.get("/auth/me", response_model=UserSchema)
async def get_me(user=Depends(get_current_user)):
    return UserSchema(
        id=user["id"], username=user["username"], role=user["role"],
        created_at=user["created_at"], expires_at=user.get("expires_at")
    )


# ─────────────────────────────────────────────────
# Superadmin Endpoints
# ─────────────────────────────────────────────────

@app.post("/auth/superadmin/login", response_model=TokenResponse)
async def superadmin_login(req: SuperadminLoginRequest):
    if req.password != SUPERADMIN_PASSWORD:
        raise HTTPException(401, "Senha de administrador inválida")
    sa = await queries.get_user_by_username("superadmin")
    if not sa:
        raise HTTPException(500, "Superadmin não encontrado")
    token = create_access_token(sa["id"])
    return TokenResponse(access_token=token, user=UserSchema(
        id=sa["id"], username=sa["username"], role=sa["role"],
        created_at=sa["created_at"], expires_at=sa.get("expires_at")
    ))

@app.get("/admin/users")
async def list_users(user=Depends(get_current_superadmin)):
    users = await queries.list_all_users()
    # Hide superadmin from list
    return [u for u in users if u["role"] != "superadmin"]

@app.post("/admin/users", response_model=UserSchema)
async def create_beta_user(req: CreateBetaUserRequest, user=Depends(get_current_superadmin)):
    existing = await queries.get_user_by_username(req.username)
    if existing:
        raise HTTPException(400, "Nome de usuário já existe")
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    new_user = await queries.create_user(user_id, req.username, password_hash, role="beta", expires_at=req.expires_at)
    if not new_user:
        raise HTTPException(500, "Erro ao criar usuário")
    return UserSchema(**new_user)

@app.put("/admin/users/{user_id}", response_model=UserSchema)
async def update_beta_user(user_id: str, req: UpdateUserRequest, user=Depends(get_current_superadmin)):
    target = await queries.get_user_by_id(user_id)
    if not target:
        raise HTTPException(404, "Usuário não encontrado")
    if target["role"] == "superadmin":
        raise HTTPException(400, "Não é possível alterar o superadmin")
    await queries.update_user(user_id, expires_at=req.expires_at, role=req.role)
    updated = await queries.get_user_by_id(user_id)
    return UserSchema(**updated)

@app.delete("/admin/users/{user_id}")
async def delete_beta_user(user_id: str, user=Depends(get_current_superadmin)):
    target = await queries.get_user_by_id(user_id)
    if not target:
        raise HTTPException(404, "Usuário não encontrado")
    if target["role"] == "superadmin":
        raise HTTPException(400, "Não é possível excluir o superadmin")
    await queries.delete_user(user_id)
    return {"status": "deleted"}


# ─────────────────────────────────────────────────
# Notification Endpoints
# ─────────────────────────────────────────────────

@app.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    return await queries.get_notifications_for_user(user["id"])

@app.post("/notifications", response_model=NotificationSchema)
async def create_notification_endpoint(req: CreateNotificationRequest, user=Depends(get_current_user)):
    notif_id = str(uuid.uuid4())
    notif = await queries.create_notification(notif_id, req.title, req.message, req.type)
    return NotificationSchema(**notif, read=False)

@app.put("/notifications/{notification_id}/read")
async def mark_notification_read_endpoint(notification_id: str, user=Depends(get_current_user)):
    await queries.mark_notification_read(user["id"], notification_id)
    return {"status": "ok"}

@app.get("/notifications/unread-count")
async def unread_count(user=Depends(get_current_user)):
    count = await queries.get_unread_count(user["id"])
    return {"count": count}


# ─────────────────────────────────────────────────
# Mailbox: Open by local path (Mode 1 — primary)
# ─────────────────────────────────────────────────

@app.post("/mailbox/open", response_model=OpenMailboxResponse)
async def open_mailbox(payload: OpenMailboxRequest, user=Depends(get_current_user)):
    """Open a mailbox by local filesystem path."""
    file_path = payload.path

    if not os.path.exists(file_path):
        raise HTTPException(404, "Arquivo não encontrado no caminho informado")

    fmt, encoding = detect_format(file_path)
    if fmt == "unknown":
        raise HTTPException(422, "Formato de arquivo não reconhecido")

    mailbox_id = generate_mailbox_id(file_path)
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)

    # Register mailbox
    await queries.create_or_update_mailbox(
        id=mailbox_id,
        name=file_name,
        file_path=file_path,
        file_size=file_size,
        file_format=fmt,
        encoding=encoding,
    )

    # Enqueue parse job
    job_id = await job_manager.enqueue_parse(file_path, mailbox_id, fmt)

    return OpenMailboxResponse(mailbox_id=mailbox_id, job_id=job_id, format=fmt)


# ─────────────────────────────────────────────────
# Mailbox: Upload (Mode 2 — secondary)
# ─────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(files: list[UploadFile] = File(...), user=Depends(get_current_user)):
    """
    Simple upload endpoint for files or folders.
    For very large files (>1GB), use the tus protocol endpoints instead.
    """
    if not files:
        raise HTTPException(400, "Nenhum arquivo enviado")

    upload_id = str(uuid.uuid4())
    dest_dir = os.path.join(UPLOAD_DIR, upload_id)
    os.makedirs(dest_dir, exist_ok=True)

    total_size = 0
    saved_files = 0
    primary_name = ""
    MAX_UPLOAD_SIZE = 20 * 1024 * 1024 * 1024  # 20GB - supports large mbox files

    for file in files:
        if not file.filename:
            continue
            
        if not primary_name:
            parts = file.filename.split("/")
            primary_name = parts[0] if len(parts) > 1 else file.filename

        dest_path = os.path.join(dest_dir, file.filename)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        with open(dest_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(413, f"O tamanho total excedeu o limite de {MAX_UPLOAD_SIZE // (1024*1024*1024)}GB.")
                f.write(chunk)
        
        saved_files += 1

    if saved_files == 0:
        raise HTTPException(400, "Nenhum arquivo válido enviado")

    if saved_files == 1:
        # Single file upload
        file_path_to_index = os.path.join(dest_dir, files[0].filename)
        fmt, encoding = detect_format(file_path_to_index)
        mailbox_name = files[0].filename
    else:
        # Directory upload
        file_path_to_index = dest_dir
        fmt = "directory"
        encoding = None
        mailbox_name = primary_name

    mailbox_id = generate_mailbox_id(file_path_to_index)

    await queries.create_or_update_mailbox(
        id=mailbox_id,
        name=mailbox_name,
        file_path=file_path_to_index,
        file_size=total_size,
        file_format=fmt,
        encoding=encoding,
    )

    # If format is unknown, return it without starting a job
    if fmt == "unknown":
        return {"mailbox_id": mailbox_id, "job_id": None, "format": fmt, "needs_format": True}

    job_id = await job_manager.enqueue_parse(file_path_to_index, mailbox_id, fmt)
    return {"mailbox_id": mailbox_id, "job_id": job_id, "format": fmt, "needs_format": False}


# ─────────────────────────────────────────────────
# Mailboxes: Management
# ─────────────────────────────────────────────────

@app.get("/mailboxes")
async def list_mailboxes(user=Depends(get_current_user)):
    """List all imported mailboxes."""
    return await queries.get_mailboxes()


@app.delete("/mailbox/{mailbox_id}")
async def delete_mailbox(mailbox_id: str, user=Depends(get_current_user)):
    """Remove a mailbox and its data from the index, plus physical file if uploaded."""
    import shutil

    # Look up file path before deleting DB records
    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)

    await queries.delete_mailbox(mailbox_id)

    # If the file was uploaded (lives inside UPLOAD_DIR), remove from disk too
    if mb and mb.get("file_path"):
        abs_upload = os.path.abspath(UPLOAD_DIR)
        abs_file = os.path.abspath(mb["file_path"])
        if abs_file.startswith(abs_upload):
            parent_dir = os.path.dirname(abs_file)
            if os.path.isdir(parent_dir) and parent_dir != abs_upload:
                shutil.rmtree(parent_dir, ignore_errors=True)
            elif os.path.isfile(abs_file):
                os.remove(abs_file)

    return {"status": "deleted"}


@app.patch("/mailbox/{mailbox_id}/format")
async def update_mailbox_format(mailbox_id: str, payload: dict, user=Depends(get_current_user)):
    """Update the format of a mailbox (for unknown format correction)."""
    new_format = payload.get("format")
    if not new_format or new_format not in ("pst", "ost", "mbox", "eml", "msg", "directory"):
        raise HTTPException(400, "Formato inválido")
    
    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)
    if not mb:
        raise HTTPException(404, "Mailbox não encontrado")
    
    await queries.create_or_update_mailbox(
        id=mailbox_id,
        name=mb["name"],
        file_path=mb["file_path"],
        file_size=mb["file_size"],
        file_format=new_format,
        encoding=mb.get("encoding"),
    )
    return {"status": "updated", "format": new_format}


@app.post("/mailbox/{mailbox_id}/open-by-id")
async def open_mailbox_by_id(mailbox_id: str, user=Depends(get_current_user)):
    """Start parsing for a mailbox by ID (after format selection)."""
    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)
    if not mb:
        raise HTTPException(404, "Mailbox não encontrado")
    
    file_path = mb["file_path"]
    file_format = mb["file_format"]
    
    if not os.path.exists(file_path):
        raise HTTPException(404, "Arquivo não encontrado no disco")
    
    if file_format == "unknown":
        raise HTTPException(422, "Formato ainda não definido")
    
    job_id = await job_manager.enqueue_parse(file_path, mailbox_id, file_format)
    return {"job_id": job_id, "format": file_format}


# ─────────────────────────────────────────────────
# Folders
# ─────────────────────────────────────────────────

@app.get("/mailbox/{mailbox_id}/folders")
async def get_folders(mailbox_id: str, user=Depends(get_current_user)):
    """Returns the folder tree for a mailbox."""
    folders = await queries.get_folders_tree(mailbox_id)
    return folders


# ─────────────────────────────────────────────────
# Emails: List with pagination and search
# ─────────────────────────────────────────────────

@app.get("/mailbox/{mailbox_id}/emails")
async def list_emails(
    mailbox_id: str,
    folder: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    after_date_ts: Optional[int] = None,
    after_id: Optional[str] = None,
    sort: str = "date",
    order: str = "desc",
    search: Optional[str] = None,
    tag_id: Optional[str] = None,
    unread: Optional[bool] = None,
    has_attach: Optional[bool] = None,
    user=Depends(get_current_user),
):
    """
    Lists emails with cursor-based pagination.
    For search: uses FTS5 full-text search with BM25 ranking.
    """
    emails, next_cursor = await queries.list_emails(
        mailbox_id=mailbox_id,
        folder_path=folder,
        limit=limit,
        after_date_ts=after_date_ts,
        after_id=after_id,
        sort=sort,
        order=order,
        search=search,
        tag_id=tag_id,
        unread=unread,
        has_attach=has_attach,
    )
    return {"emails": emails, "next_cursor": next_cursor}


# ─────────────────────────────────────────────────
# Email: Detail
# ─────────────────────────────────────────────────

@app.get("/mailbox/{mailbox_id}/email/{email_id}")
async def get_email(mailbox_id: str, email_id: str, user=Depends(get_current_user)):
    """Returns full email details including body and attachments."""
    email = await queries.get_email_detail(email_id)
    if not email:
        raise HTTPException(404, "Email não encontrado")

    # Mark as read
    await queries.mark_email_read(email_id, True)

    # For PST files: if body_html is None, load on-demand from the original file
    if not email.get("body_html") and email.get("raw_offset") is not None:
        # Check if the mailbox is PST format
        mailboxes = await queries.get_mailboxes()
        mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)
        if mb and mb.get("file_format") in ("pst", "ost"):
            try:
                from parsers.pst_parser import load_pst_message_details
                details = load_pst_message_details(
                    mb["file_path"],
                    email["folder_path"],
                    email["raw_offset"],
                )
                email["body_html"] = details.get("body_html", "")
                email["body_text"] = details.get("body_text", email.get("body_text", ""))
            except Exception as e:
                email["body_html"] = f"<p style='color:red'>Erro ao carregar corpo: {e}</p>"

    return email


# ─────────────────────────────────────────────────
# Attachments
# ─────────────────────────────────────────────────

@app.get("/attachment/{attachment_id}")
async def download_attachment(attachment_id: str, inline: bool = False, user=Depends(get_current_user)):
    """Download an attachment by its ID, with optional inline preview."""
    import aiosqlite
    async with aiosqlite.connect(queries.DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT a.*, e.mailbox_id, e.folder_path, e.raw_offset as msg_offset FROM attachments a JOIN emails e ON a.email_id = e.id WHERE a.id = ?",
            (attachment_id,),
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(404, "Anexo não encontrado")
            att = dict(row)

    # Determine source and read bytes
    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == att["mailbox_id"]), None)
    if not mb:
        raise HTTPException(404, "Mailbox não encontrado")

    data = b""
    try:
        if mb["file_format"] in ("pst", "ost"):
            from parsers.pst_parser import read_pst_attachment_bytes
            data = read_pst_attachment_bytes(
                mb["file_path"],
                att["folder_path"],
                att["msg_offset"],
                att["raw_offset"],
            )
        elif mb["file_format"] == "msg":
            from parsers.msg_parser import read_msg_attachment_bytes
            data = read_msg_attachment_bytes(mb["file_path"], att["raw_offset"])
        elif mb["file_format"] in ("eml", "mbox"):
            # For EML/MBOX, re-parse the message to extract the attachment
            import mailbox as mbox_lib
            import email

            if mb["file_format"] == "mbox":
                mbox = mbox_lib.mbox(mb["file_path"])
                msg = mbox.get(att["msg_offset"])
            else:
                with open(mb["file_path"], "rb") as f:
                    msg = email.message_from_bytes(f.read())

            att_idx = att["raw_offset"]
            current_idx = 0
            for part in msg.walk():
                content_disposition = part.get("content-disposition", "")
                if "attachment" in content_disposition or part.get_filename():
                    if current_idx == att_idx:
                        data = part.get_payload(decode=True) or b""
                        break
                    current_idx += 1
    except Exception as e:
        raise HTTPException(500, f"Erro ao ler anexo: {e}")

    disposition = "inline" if inline else "attachment"
    return Response(
        content=data,
        media_type=att.get("mime_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'{disposition}; filename="{att.get("filename", "attachment")}"',
        },
    )


# ─────────────────────────────────────────────────
# PDF Export
# ─────────────────────────────────────────────────

@app.post("/email/{email_id}/export-pdf")
async def export_email_pdf(email_id: str, user=Depends(get_current_user)):
    """Export a single email as PDF."""
    email = await queries.get_email_detail(email_id)
    if not email:
        raise HTTPException(404, "Email não encontrado")

    pdf_bytes = render_email_to_pdf(email)
    filename = f"{email.get('subject', 'email')[:50]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/mailbox/{mailbox_id}/export-pdf")
async def export_batch_pdf(mailbox_id: str, email_ids: list[str], user=Depends(get_current_user)):
    """Export multiple emails as a combined PDF with cover page and index."""
    # Buscar nome do mailbox para a capa
    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)
    mailbox_name = mb["name"] if mb else ""

    emails = []
    for eid in email_ids:
        email = await queries.get_email_detail(eid)
        if email:
            emails.append(email)

    if not emails:
        raise HTTPException(404, "Nenhum email encontrado")

    pdf_bytes = render_batch_to_pdf(emails, mailbox_name=mailbox_name)

    # Nome descritivo: "export_3_emails_2026-05-28.pdf"
    from datetime import datetime
    date_str = datetime.now().strftime("%Y-%m-%d")
    count = len(emails)
    filename = f"export_{count}_emails_{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ─────────────────────────────────────────────────
# ZIP Export (email body + all attachments)
# ─────────────────────────────────────────────────

@app.get("/mailbox/{mailbox_id}/email/{email_id}/export-zip")
async def export_email_zip(mailbox_id: str, email_id: str, user=Depends(get_current_user)):
    """
    Packages the email body (HTML + plain text) and ALL attachments into a
    single ZIP file.  The ZIP filename is derived from the sender name so
    it is easy to identify in the filesystem.
    """
    import io
    import re
    import zipfile
    import mailbox as mbox_lib
    import email as email_lib

    email = await queries.get_email_detail(email_id)
    if not email:
        raise HTTPException(404, "Email não encontrado")

    mailboxes = await queries.get_mailboxes()
    mb = next((m for m in mailboxes if m["id"] == mailbox_id), None)
    if not mb:
        raise HTTPException(404, "Mailbox não encontrado")

    # ── Build a safe filename from the sender ──────────────────────────────
    sender_raw = email.get("sender") or "sem_remetente"
    # Extract display name if present: "Name <email@x.com>" → "Name"
    name_match = re.match(r'^"?([^<"]+)"?\s*<', sender_raw)
    sender_name = name_match.group(1).strip() if name_match else sender_raw.split("@")[0]
    # Keep only safe filesystem chars
    safe_name = re.sub(r'[^\w\s\-.]', '', sender_name).strip()
    safe_name = re.sub(r'\s+', '_', safe_name) or "email"
    zip_filename = f"{safe_name}.zip"

    # ── Helper: read attachment bytes ──────────────────────────────────────
    def _read_att_bytes(att: dict) -> bytes:
        fmt = mb["file_format"]
        try:
            if fmt in ("pst", "ost"):
                from parsers.pst_parser import read_pst_attachment_bytes
                return read_pst_attachment_bytes(
                    mb["file_path"], att["folder_path"],
                    att["msg_offset"], att["raw_offset"],
                )
            elif fmt == "msg":
                from parsers.msg_parser import read_msg_attachment_bytes
                return read_msg_attachment_bytes(mb["file_path"], att["raw_offset"])
            elif fmt in ("eml", "mbox"):
                if fmt == "mbox":
                    mbox = mbox_lib.mbox(mb["file_path"])
                    msg = mbox.get(att["msg_offset"])
                else:
                    with open(mb["file_path"], "rb") as f:
                        msg = email_lib.message_from_bytes(f.read())
                att_idx = att["raw_offset"]
                current_idx = 0
                for part in msg.walk():
                    if part.get_content_disposition() == "attachment" or part.get_filename():
                        if current_idx == att_idx:
                            return part.get_payload(decode=True) or b""
                        current_idx += 1
        except Exception:
            pass
        return b""

    # ── Assemble ZIP in memory ─────────────────────────────────────────────
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Email body as HTML
        if email.get("body_html"):
            subject = (email.get("subject") or "email")[:80]
            safe_subject = re.sub(r'[^\w\s\-.]', '', subject).strip()
            safe_subject = re.sub(r'\s+', '_', safe_subject) or "email"
            zf.writestr(f"{safe_subject}.html", email["body_html"].encode("utf-8"))

        # 2. Email body as plain text (always include as fallback)
        if email.get("body_text"):
            subject = (email.get("subject") or "email")[:80]
            safe_subject = re.sub(r'[^\w\s\-.]', '', subject).strip()
            safe_subject = re.sub(r'\s+', '_', safe_subject) or "email"
            zf.writestr(f"{safe_subject}.txt", email["body_text"].encode("utf-8"))

        # 3. Metadata file with full headers
        sender    = email.get("sender") or ""
        recipients = ", ".join(email.get("recipients") or [])
        cc        = ", ".join(email.get("cc") or [])
        date_str  = ""
        if email.get("date_ts"):
            from datetime import datetime, timezone
            date_str = datetime.fromtimestamp(email["date_ts"], tz=timezone.utc).strftime(
                "%d/%m/%Y %H:%M:%S UTC"
            )
        meta_lines = [
            f"Assunto : {email.get('subject') or '(sem assunto)'}",
            f"De      : {sender}",
            f"Para    : {recipients}",
            f"CC      : {cc}",
            f"Data    : {date_str}",
        ]
        zf.writestr("_info.txt", "\n".join(meta_lines).encode("utf-8"))

        # 4. All attachments
        seen_names: dict[str, int] = {}
        for att in (email.get("attachments") or []):
            att_name = att.get("filename") or "attachment"
            # De-duplicate filenames within the ZIP
            if att_name in seen_names:
                seen_names[att_name] += 1
                base, _, ext = att_name.rpartition(".")
                att_name = f"{base}_{seen_names[att_name]}.{ext}" if ext else f"{att_name}_{seen_names[att_name]}"
            else:
                seen_names[att_name] = 0

            att_bytes = _read_att_bytes(att)
            zf.writestr(att_name, att_bytes)

    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )


# ─────────────────────────────────────────────────
# Jobs: Status & SSE Progress Stream
# ─────────────────────────────────────────────────

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str, user=Depends(get_current_user)):
    """Returns current job status."""
    job = await queries.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job não encontrado")
    return job


@app.get("/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str, request: Request, user=Depends(get_current_user)):
    """SSE endpoint for real-time job progress updates."""
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break

            job = await queries.get_job(job_id)
            if not job:
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Job not found"}),
                }
                break

            yield {
                "event": "progress",
                "data": json.dumps({
                    "status": job["status"],
                    "progress": job["progress"],
                    "indexed": job["indexed_msgs"],
                    "total": job["total_msgs"],
                    "current_folder": job.get("current_folder"),
                    "error": job.get("error_msg"),
                }),
            }

            if job["status"] in ("ready", "error", "cancelled"):
                yield {
                    "event": "done",
                    "data": json.dumps({"status": job["status"]}),
                }
                break

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@app.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user=Depends(get_current_user)):
    """Cancel a running parse job."""
    await job_manager.cancel_job(job_id)
    return {"status": "cancelled"}


# ─────────────────────────────────────────────────
# Parse Errors / Corruption Report
# ─────────────────────────────────────────────────

@app.get("/mailbox/{mailbox_id}/parse-errors")
async def get_parse_errors(mailbox_id: str, user=Depends(get_current_user)):
    """Returns the list of parse errors encountered during indexing."""
    errors = await queries.get_parse_errors(mailbox_id)
    return {"errors": errors, "total": len(errors)}


# ─────────────────────────────────────────────────
# Office Document Conversion
# ─────────────────────────────────────────────────

from services.office_converter import convert_office_to_html


@app.post("/convert/office")
async def convert_office_document(
    file: UploadFile = File(...),
    mime_type: str = Form(...),
    user=Depends(get_current_user),
):
    """Convert DOCX/PPTX/XLSX to HTML for in-app viewing."""
    try:
        file_bytes = await file.read()
        html = convert_office_to_html(file_bytes, mime_type)

        if html is None:
            raise HTTPException(status_code=400, detail="Conversion failed")

        return {"html": html}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────
# Text Highlights
# ─────────────────────────────────────────────────

@app.post("/emails/{email_id}/highlights", response_model=HighlightSchema)
async def create_highlight(email_id: str, req: CreateHighlightRequest, user=Depends(get_current_user)):
    """Create a new text highlight for an email."""
    # check if email exists
    email = await queries.get_email_detail(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    highlight_id = str(uuid.uuid4())
    await queries.create_highlight(
        id=highlight_id,
        email_id=email_id,
        start_pos=req.start_pos,
        end_pos=req.end_pos,
        color=req.color,
        note=req.note
    )
    # Re-fetch or build response
    return {
        "id": highlight_id,
        "email_id": email_id,
        "start_pos": req.start_pos,
        "end_pos": req.end_pos,
        "color": req.color,
        "note": req.note,
        "created_at": int(time.time())
    }

@app.get("/emails/{email_id}/highlights", response_model=list[HighlightSchema])
async def get_highlights(email_id: str, user=Depends(get_current_user)):
    """Get all highlights for an email."""
    return await queries.get_highlights(email_id)

@app.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: str, user=Depends(get_current_user)):
    """Delete a specific highlight."""
    await queries.delete_highlight(highlight_id)
    return {"status": "success"}

# ─────────────────────────────────────────────────
# Tags
# ─────────────────────────────────────────────────

@app.get("/tags", response_model=list[TagSchema])
async def get_all_tags(user=Depends(get_current_user)):
    """Get all available tags."""
    return await queries.get_all_tags()

@app.post("/tags", response_model=TagSchema)
async def create_tag(req: CreateTagRequest, user=Depends(get_current_user)):
    """Create a new tag."""
    tag_id = str(uuid.uuid4())
    tag = await queries.create_tag(tag_id, req.name, req.color)
    if not tag:
        raise HTTPException(status_code=400, detail="Tag with this name might already exist")
    return tag

@app.put("/tags/{tag_id}", response_model=TagSchema)
async def update_tag(tag_id: str, req: CreateTagRequest, user=Depends(get_current_user)):
    """Update an existing tag."""
    await queries.update_tag(tag_id, req.name, req.color)
    return {"id": tag_id, "name": req.name, "color": req.color}

@app.delete("/tags/{tag_id}")
async def delete_tag(tag_id: str, user=Depends(get_current_user)):
    """Delete a tag globally."""
    await queries.delete_tag(tag_id)
    return {"status": "success"}

@app.post("/emails/{email_id}/tags")
async def assign_tag_to_email(email_id: str, req: AssignTagRequest, user=Depends(get_current_user)):
    """Assign a tag to an email."""
    await queries.assign_tag(email_id, req.tag_id)
    return {"status": "success"}

@app.delete("/emails/{email_id}/tags/{tag_id}")
async def remove_tag_from_email(email_id: str, tag_id: str, user=Depends(get_current_user)):
    """Remove a tag from an email."""
    await queries.remove_tag(email_id, tag_id)
    return {"status": "success"}
