# tus_upload.py
# Minimal TUS protocol server for resumable uploads (no external deps).
# Supports: creation, patch, head, delete.
# Stores chunks in a temp dir, merges on completion, then registers mailbox.

import os
import json
import uuid
import hashlib
import shutil
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Request, Response, HTTPException, Depends

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))
TUS_MAX_SIZE = 50 * 1024 * 1024 * 1024  # 50 GB

router = APIRouter()

# In-memory store for active uploads: upload_id -> metadata dict
_active_uploads: dict = {}


def _upload_dir(upload_id: str) -> str:
    return os.path.join(UPLOAD_DIR, "tus", upload_id)


def _meta_path(upload_id: str) -> str:
    return os.path.join(_upload_dir(upload_id), ".tus_meta.json")


def _data_path(upload_id: str) -> str:
    return os.path.join(_upload_dir(upload_id), "data")


def _save_meta(upload_id: str, meta: dict):
    d = _upload_dir(upload_id)
    os.makedirs(d, exist_ok=True)
    with open(_meta_path(upload_id), "w") as f:
        json.dump(meta, f)


def _load_meta(upload_id: str) -> Optional[dict]:
    path = _meta_path(upload_id)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def _current_offset(upload_id: str) -> int:
    data = _data_path(upload_id)
    if os.path.exists(data):
        return os.path.getsize(data)
    return 0


@router.post("")
async def tus_create(request: Request):
    """POST /upload-tus  — Create a new resumable upload."""
    upload_length = request.headers.get("Upload-Length")
    if not upload_length:
        raise HTTPException(400, "Missing Upload-Length header")

    try:
        total = int(upload_length)
    except ValueError:
        raise HTTPException(400, "Invalid Upload-Length")

    if total > TUS_MAX_SIZE:
        raise HTTPException(413, f"File too large. Max: {TUS_MAX_SIZE // (1024**3)}GB")

    upload_id = str(uuid.uuid4())
    metadata_raw = request.headers.get("Upload-Metadata", "")
    metadata = {}
    if metadata_raw:
        for pair in metadata_raw.split(","):
            parts = pair.strip().split(" ")
            if len(parts) == 2:
                import base64
                try:
                    decoded = base64.b64decode(parts[1]).decode("utf-8")
                except Exception:
                    decoded = parts[1]
                metadata[parts[0]] = decoded

    meta = {
        "id": upload_id,
        "upload_length": total,
        "upload_offset": 0,
        "metadata": metadata,
        "created_at": datetime.utcnow().isoformat(),
        "status": "in_progress",
    }

    _save_meta(upload_id, meta)
    _active_uploads[upload_id] = meta

    # Create empty data file
    data_file = _data_path(upload_id)
    os.makedirs(os.path.dirname(data_file), exist_ok=True)
    with open(data_file, "wb") as f:
        pass

    base_url = str(request.base_url).rstrip("/")
    location = f"{base_url}/upload-tus/{upload_id}"

    resp = Response(status_code=201)
    resp.headers["Location"] = location
    resp.headers["Tus-Resumable"] = "1.0.0"
    resp.headers["Upload-Offset"] = "0"
    resp.headers["Upload-Length"] = str(total)
    resp.headers["Tus-Version"] = "1.0.0"
    return resp


@router.options("/{upload_id}")
async def tus_options(upload_id: str):
    """OPTIONS /upload-tus/{id} — CORS preflight + capabilities."""
    resp = Response(status_code=204)
    resp.headers["Tus-Resumable"] = "1.0.0"
    resp.headers["Tus-Version"] = "1.0.0"
    resp.headers["Tus-Extension"] = "creation,expiration,termination"
    resp.headers["Tus-Max-Size"] = str(TUS_MAX_SIZE)
    return resp


@router.head("/{upload_id}")
async def tus_head(upload_id: str):
    """HEAD /upload-tus/{id} — Get current offset for resume."""
    meta = _load_meta(upload_id)
    if not meta:
        raise HTTPException(404, "Upload not found")

    offset = _current_offset(upload_id)
    resp = Response(status_code=204)
    resp.headers["Upload-Offset"] = str(offset)
    resp.headers["Upload-Length"] = str(meta["upload_length"])
    resp.headers["Tus-Resumable"] = "1.0.0"
    return resp


@router.patch("/{upload_id}")
async def tus_patch(upload_id: str, request: Request):
    """PATCH /upload-tus/{id} — Append chunk data."""
    meta = _load_meta(upload_id)
    if not meta:
        raise HTTPException(404, "Upload not found")

    if meta.get("status") == "completed":
        raise HTTPException(409, "Upload already completed")

    content_type = request.headers.get("Content-Type", "")
    if "application/offset+octet-stream" not in content_type:
        raise HTTPException(400, "Content-Type must be application/offset+octet-stream")

    try:
        expected_offset = int(request.headers.get("Upload-Offset", "-1"))
    except ValueError:
        raise HTTPException(400, "Invalid Upload-Offset")

    current = _current_offset(upload_id)
    if expected_offset != current:
        raise HTTPException(409, f"Offset mismatch: expected {current}, got {expected_offset}")

    # Read the entire body
    body = await request.body()
    if not body:
        raise HTTPException(400, "Empty patch body")

    # Append to data file
    data_file = _data_path(upload_id)
    with open(data_file, "ab") as f:
        f.write(body)

    new_offset = current + len(body)
    meta["upload_offset"] = new_offset
    _save_meta(upload_id, meta)

    resp = Response(status_code=204)
    resp.headers["Upload-Offset"] = str(new_offset)
    resp.headers["Tus-Resumable"] = "1.0.0"

    # Check if upload is complete
    if new_offset >= meta["upload_length"]:
        meta["status"] = "completed"
        meta["completed_at"] = datetime.utcnow().isoformat()
        _save_meta(upload_id, meta)

        # Trigger background processing
        asyncio.create_task(_process_completed_upload(upload_id))

    return resp


@router.delete("/{upload_id}")
async def tus_delete(upload_id: str):
    """DELETE /upload-tus/{id} — Abort/cancel upload."""
    meta = _load_meta(upload_id)
    if not meta:
        raise HTTPException(404, "Upload not found")

    # Clean up files
    upload_path = _upload_dir(upload_id)
    if os.path.exists(upload_path):
        shutil.rmtree(upload_path, ignore_errors=True)

    _active_uploads.pop(upload_id, None)

    return Response(status_code=204)


async def _process_completed_upload(upload_id: str):
    """After upload completes, move file to final location and register mailbox."""
    try:
        from db import queries
        from services.format_detector import detect_format
        from services import job_manager

        meta = _load_meta(upload_id)
        if not meta:
            return

        data_file = _data_path(upload_id)
        if not os.path.exists(data_file):
            return

        # Determine filename from metadata
        filename = meta.get("metadata", {}).get("filename", f"{upload_id}.mbox")

        # Move to permanent location
        perm_dir = os.path.join(UPLOAD_DIR, upload_id)
        os.makedirs(perm_dir, exist_ok=True)
        perm_file = os.path.join(perm_dir, filename)
        shutil.move(data_file, perm_file)

        # Clean up TUS temp dir
        tus_dir = _upload_dir(upload_id)
        if os.path.exists(tus_dir):
            shutil.rmtree(tus_dir, ignore_errors=True)

        file_size = os.path.getsize(perm_file)
        fmt, encoding = detect_format(perm_file)

        mailbox_id = hashlib.sha256(perm_file.encode()).hexdigest()[:16]

        await queries.create_or_update_mailbox(
            id=mailbox_id,
            name=filename,
            file_path=perm_file,
            file_size=file_size,
            file_format=fmt,
            encoding=encoding,
        )

        if fmt != "unknown":
            await job_manager.enqueue_parse(perm_file, mailbox_id, fmt)

        # Store result for polling
        meta["status"] = "processed"
        meta["mailbox_id"] = mailbox_id
        meta["job_id"] = None
        _save_meta(upload_id, meta)

    except Exception as e:
        meta = _load_meta(upload_id)
        if meta:
            meta["status"] = "error"
            meta["error"] = str(e)
            _save_meta(upload_id, meta)
        print(f"TUS processing error: {e}")


@router.get("/{upload_id}/status")
async def tus_status(upload_id: str):
    """GET /upload-tus/{id}/status — Poll processing status."""
    meta = _load_meta(upload_id)
    if not meta:
        raise HTTPException(404, "Upload not found")

    return {
        "upload_id": upload_id,
        "status": meta.get("status", "unknown"),
        "upload_offset": _current_offset(upload_id),
        "upload_length": meta.get("upload_length", 0),
        "mailbox_id": meta.get("mailbox_id"),
        "error": meta.get("error"),
    }


def setup_tus(app):
    """Mount TUS router on the FastAPI app."""
    app.include_router(router, prefix="/upload-tus", tags=["tus-upload"])
