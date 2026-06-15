# parse_worker.py
# ARQ background worker for mailbox parsing jobs

import os
import sys
import time
from urllib.parse import urlparse

from arq.connections import RedisSettings

# Ensure the backend root is on sys.path so imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import queries
from services.format_detector import detect_format
from parsers import eml_parser, pst_parser, msg_parser
from services import mailbox_cache


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


async def parse_mailbox_job(
    ctx: dict,
    file_path: str,
    mailbox_id: str,
    job_id: str,
    file_format: str,
):
    """
    Main parsing entry point executed by the ARQ worker.
    Detects format, streams messages in batches, and inserts them into SQLite.
    """
    await queries.update_job(job_id, status="parsing", progress=0)

    try:
        if file_format in ("pst", "ost"):
            await _parse_pst(file_path, mailbox_id, job_id)
        elif file_format == "mbox":
            await _parse_mbox(file_path, mailbox_id, job_id)
        elif file_format == "eml":
            await _parse_eml(file_path, mailbox_id, job_id)
        elif file_format == "msg":
            await _parse_msg(file_path, mailbox_id, job_id)
        elif file_format == "directory":
            await _parse_directory(file_path, mailbox_id, job_id)
        else:
            await queries.update_job(
                job_id, status="error", progress=0,
                error_msg=f"Unsupported format: {file_format}",
            )
            return

        await queries.update_job(job_id, status="ready", progress=100)
        await mailbox_cache.set_mailbox(mailbox_id, {"status": "ready"})

    except Exception as e:
        await queries.update_job(
            job_id, status="error", progress=0,
            error_msg=str(e)[:1000],
        )
        raise


async def _parse_pst(file_path: str, mailbox_id: str, job_id: str):
    """Parse PST/OST via lazy generator."""
    indexed = 0
    total_estimate = 0

    async for emails_batch, folders_batch, errors_batch in pst_parser.iter_pst_lazy(file_path, mailbox_id):
        # Insert folders on the first yield
        if folders_batch:
            await queries.insert_folder_batch(folders_batch)
            # Calculate total estimate from folder counts
            total_estimate = sum(f.get("total_count", 0) for f in folders_batch)

        # Insert emails
        current_folder = None
        if emails_batch:
            await queries.insert_email_batch(emails_batch)
            indexed += len(emails_batch)
            # Extract current folder from first email in batch for progress display
            current_folder = emails_batch[0].get("folder_path") if emails_batch else None

        # Log errors
        for err in errors_batch:
            await queries.log_parse_error(
                mailbox_id=err.get("mailbox_id", mailbox_id),
                folder_path=err.get("folder_path"),
                message_index=err.get("message_index"),
                error_type=err.get("error_type", "unknown"),
                error_detail=err.get("error_detail", ""),
            )

        # Update progress
        progress = min((indexed / max(total_estimate, 1)) * 100, 99)
        await queries.update_job(
            job_id, status="parsing", progress=progress,
            indexed_msgs=indexed, total_msgs=total_estimate,
            current_folder=current_folder,
        )

        # Check for cancellation
        job = await queries.get_job(job_id)
        if job and job.get("status") == "cancelled":
            return


async def _parse_mbox(file_path: str, mailbox_id: str, job_id: str):
    """Parse MBOX via lazy generator."""
    indexed = 0

    # Create a default INBOX folder
    await queries.insert_folder_batch([{
        "id": f"{mailbox_id}_inbox",
        "mailbox_id": mailbox_id,
        "name": "INBOX",
        "full_path": "INBOX",
        "parent_id": None,
        "total_count": 0,
        "unread_count": 0,
    }])

    async for emails_batch, errors_batch in eml_parser.iter_mbox_lazy(file_path, mailbox_id):
        if emails_batch:
            await queries.insert_email_batch(emails_batch)
            indexed += len(emails_batch)

        for err in errors_batch:
            await queries.log_parse_error(
                mailbox_id=err.get("mailbox_id", mailbox_id),
                folder_path=err.get("folder_path"),
                message_index=err.get("message_index"),
                error_type=err.get("error_type", "unknown"),
                error_detail=err.get("error_detail", ""),
            )

        await queries.update_job(
            job_id, status="parsing", progress=min(indexed * 0.01, 99),
            indexed_msgs=indexed,
        )

        job = await queries.get_job(job_id)
        if job and job.get("status") == "cancelled":
            return


async def _parse_eml(file_path: str, mailbox_id: str, job_id: str):
    """Parse a single EML file."""
    # Create INBOX folder
    await queries.insert_folder_batch([{
        "id": f"{mailbox_id}_inbox",
        "mailbox_id": mailbox_id,
        "name": "INBOX",
        "full_path": "INBOX",
        "parent_id": None,
        "total_count": 1,
        "unread_count": 1,
    }])

    parsed = await eml_parser.parse_single_eml(file_path, mailbox_id)
    await queries.insert_email_batch([parsed])
    await queries.update_job(
        job_id, status="ready", progress=100,
        indexed_msgs=1, total_msgs=1,
    )


async def _parse_msg(file_path: str, mailbox_id: str, job_id: str):
    """Parse a single MSG file."""
    await queries.insert_folder_batch([{
        "id": f"{mailbox_id}_inbox",
        "mailbox_id": mailbox_id,
        "name": "INBOX",
        "full_path": "INBOX",
        "parent_id": None,
        "total_count": 1,
        "unread_count": 1,
    }])

    parsed = msg_parser.parse_msg_file(file_path, mailbox_id)
    await queries.insert_email_batch([parsed])
    await queries.update_job(
        job_id, status="ready", progress=100,
        indexed_msgs=1, total_msgs=1,
    )


async def _parse_directory(file_path: str, mailbox_id: str, job_id: str):
    """Parse a directory containing multiple EML or MSG files."""
    import uuid

    indexed = 0
    folders_to_insert = []
    
    # Root folder
    root_folder_id = f"{mailbox_id}_root"
    folders_to_insert.append({
        "id": root_folder_id,
        "mailbox_id": mailbox_id,
        "name": "Imported Folder",
        "full_path": "Imported Folder",
        "parent_id": None,
        "total_count": 0,
        "unread_count": 0,
    })
    
    folder_map = {file_path: root_folder_id}
    folder_path_map = {file_path: "Imported Folder"}

    # Walk the directory to create folders
    for root, dirs, files in os.walk(file_path):
        parent_id = folder_map.get(root, root_folder_id)
        parent_path = folder_path_map.get(root, "Imported Folder")
        
        for d in dirs:
            dir_path = os.path.join(root, d)
            dir_id = str(uuid.uuid4())
            full_path = f"{parent_path}/{d}"
            
            folder_map[dir_path] = dir_id
            folder_path_map[dir_path] = full_path
            
            folders_to_insert.append({
                "id": dir_id,
                "mailbox_id": mailbox_id,
                "name": d,
                "full_path": full_path,
                "parent_id": parent_id,
                "total_count": 0,
                "unread_count": 0,
            })

    if folders_to_insert:
        await queries.insert_folder_batch(folders_to_insert)

    # Now process files
    for root, dirs, files in os.walk(file_path):
        folder_path = folder_path_map.get(root, "Imported Folder")
        
        batch = []
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            full_file_path = os.path.join(root, file)
            
            try:
                if ext == ".eml":
                    parsed = await eml_parser.parse_single_eml(full_file_path, mailbox_id)
                    parsed["folder_path"] = folder_path
                    batch.append(parsed)
                elif ext == ".msg":
                    parsed = msg_parser.parse_msg_file(full_file_path, mailbox_id)
                    parsed["folder_path"] = folder_path
                    batch.append(parsed)
            except Exception as e:
                await queries.log_parse_error(
                    mailbox_id=mailbox_id,
                    folder_path=folder_path,
                    message_index=file,
                    error_type="parse_error",
                    error_detail=str(e)
                )

            if len(batch) >= 100:
                await queries.insert_email_batch(batch)
                indexed += len(batch)
                batch = []
                
                # Update progress
                await queries.update_job(
                    job_id, status="parsing", progress=min(indexed * 0.01, 99),
                    indexed_msgs=indexed,
                )
                
                # Check for cancellation
                job = await queries.get_job(job_id)
                if job and job.get("status") == "cancelled":
                    return

        if batch:
            await queries.insert_email_batch(batch)
            indexed += len(batch)

    await queries.update_job(
        job_id, status="ready", progress=100,
        indexed_msgs=indexed, total_msgs=indexed,
    )


def _get_redis_settings() -> RedisSettings:
    parsed = urlparse(REDIS_URL)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
    )


class WorkerSettings:
    """ARQ worker settings — run with: arq workers.parse_worker.WorkerSettings"""
    functions = [parse_mailbox_job]
    redis_settings = _get_redis_settings()
    max_jobs = 2  # Limit concurrent parsing (RAM-sensitive)
    job_timeout = 3600 * 6  # 6 hours max for very large PSTs
