# pst_parser.py
# Lazy parser for Outlook PST/OST files utilizing libpff-python / pypff

import os
import uuid
import json
import time
import pypff
import chardet
from typing import Generator, List, Dict, Any, Tuple, Optional

# MAPI Entry types for attachments
PR_ATTACH_FILENAME = 0x3704
PR_ATTACH_LONG_FILENAME = 0x3707
PR_ATTACH_MIME_TAG = 0x370e

def get_attachment_metadata(attachment, email_id: str, index: int) -> Dict[str, Any]:
    """Helper to extract filename and mime type from MAPI record sets in attachment."""
    filename = ""
    mime_type = "application/octet-stream"
    size = attachment.size if hasattr(attachment, "size") else attachment.get_size()

    # Search in record sets
    try:
        num_sets = attachment.number_of_record_sets
        for i in range(num_sets):
            record_set = attachment.get_record_set(i)
            for j in range(record_set.number_of_entries):
                entry = record_set.get_entry(j)
                entry_type = entry.entry_type
                if entry_type == PR_ATTACH_LONG_FILENAME:
                    filename = entry.get_data_as_string() or filename
                elif entry_type == PR_ATTACH_FILENAME and not filename:
                    filename = entry.get_data_as_string() or filename
                elif entry_type == PR_ATTACH_MIME_TAG:
                    mime_type = entry.get_data_as_string() or mime_type
    except Exception:
        pass

    if not filename:
        filename = f"attachment_{index + 1}"
        # Try guessing extension based on mime type or just leave it generic
        
    return {
        "id": str(uuid.uuid4()),
        "email_id": email_id,
        "filename": filename,
        "mime_type": mime_type,
        "size": size,
        "raw_offset": index  # Store index of attachment in message
    }

def safe_decode_bytes(data: bytes) -> str:
    """Decodes raw bytes using chardet fallback."""
    if not data:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            detected = chardet.detect(data)
            charset = detected.get("charset") or "windows-1252"
            return data.decode(charset, errors="replace")
        except Exception:
            return data.decode("latin1", errors="replace")

def parse_pypff_message(msg, mailbox_id: str, folder_path: str, msg_index: int) -> Dict[str, Any]:
    """Parses a single pypff message into a database schema dictionary."""
    email_id = str(uuid.uuid4())
    
    # Extract headers
    subject = msg.subject or "(No Subject)"
    sender = msg.sender_name or ""
    
    # Extract transport headers for Cc/Bcc/Recipients if available
    recipients = []
    cc = []
    bcc = []
    
    # Recipient details are usually in message record sets or we can parse transport headers
    # For simple fallback, if we parse transport headers we can get exact To/Cc/Bcc
    headers_str = msg.transport_headers or ""
    if headers_str:
        import email
        try:
            header_msg = email.message_from_string(headers_str)
            from EmlParser import extract_addresses # Wait, we can inline it
            to_val = header_msg.get("to")
            cc_val = header_msg.get("cc")
            bcc_val = header_msg.get("bcc")
            if to_val:
                recipients = [r.strip() for r in to_val.split(",") if r.strip()]
            if cc_val:
                cc = [c.strip() for c in cc_val.split(",") if c.strip()]
            if bcc_val:
                bcc = [b.strip() for b in bcc_val.split(",") if b.strip()]
        except Exception:
            pass

    # Extract date
    date_ts = int(time.time())
    try:
        # pypff returns delivery_time or client_submit_time as datetime or integer
        ts = msg.get_delivery_time_as_integer()
        if ts and ts > 0:
            date_ts = ts
        else:
            ts = msg.get_client_submit_time_as_integer()
            if ts and ts > 0:
                date_ts = ts
    except Exception:
        pass

    # Extract body previews (do not store full body in sqlite for large files)
    plain_bytes = msg.plain_text_body
    html_bytes = msg.html_body
    rtf_bytes = msg.rtf_body

    body_text = safe_decode_bytes(plain_bytes) if plain_bytes else ""
    body_html = safe_decode_bytes(html_bytes) if html_bytes else ""

    # Fallbacks: RTF can be decoded if text is empty
    if not body_text and not body_html and rtf_bytes:
        # Storing RTF bytes is not supported by standard text columns,
        # but we can try to extract raw text from RTF using regex or save it
        body_text = "[Outlook RTF Body - open to view]"
        
    # Extract attachments metadata
    attachments = []
    num_attachments = msg.number_of_attachments
    for i in range(num_attachments):
        try:
            att = msg.get_attachment(i)
            attachments.append(get_attachment_metadata(att, email_id, i))
        except Exception:
            pass

    has_attach = 1 if len(attachments) > 0 else 0

    return {
        "id": email_id,
        "mailbox_id": mailbox_id,
        "folder_path": folder_path,
        "subject": subject,
        "sender": sender,
        "recipients": json.dumps(recipients),
        "cc": json.dumps(cc),
        "bcc": json.dumps(bcc),
        "date_ts": date_ts,
        "body_text": body_text[:2000] if body_text else (body_html[:2000] if body_html else ""), # Index first 2KB for FTS search
        "body_html": None, # Do not store full body to avoid inflating DB size
        "is_read": 0,
        "importance": "normal",
        "has_attach": has_attach,
        "raw_offset": msg_index, # Store index in folder
        "raw_size": len(plain_bytes or b"") + len(html_bytes or b""),
        "parse_error": None,
        "attachments": attachments
    }

async def iter_pst_lazy(
    file_path: str, 
    mailbox_id: str, 
    batch_size: int = 200
) -> Generator[Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]], None, None]:
    """
    Lazy folder and email generator for PST/OST.
    Yields (emails_batch, folders_batch, errors_batch).
    """
    pst = pypff.file()
    try:
        pst.open(file_path)
    except Exception as e:
        yield [], [], [{"mailbox_id": mailbox_id, "error_type": "open_failed", "error_detail": str(e)}]
        return

    root = pst.get_root_folder()
    
    # Traverse folder structure recursively
    folders_to_insert = []
    
    # We define a helper generator to walk the tree recursively
    def walk_folders(folder, parent_id: Optional[str] = None, current_path: str = "") -> Generator[Tuple[pypff.folder, str, str, Optional[str]], None, None]:
        name = folder.name or "Root"
        folder_id = str(uuid.uuid4())
        path = f"{current_path}/{name}" if current_path else name
        
        yield folder, folder_id, path, parent_id
        
        for i in range(folder.number_of_sub_folders):
            try:
                subfolder = folder.get_sub_folder(i)
                yield from walk_folders(subfolder, folder_id, path)
            except Exception:
                pass

    # First, list all folders
    all_folders = list(walk_folders(root))
    
    # Map paths to folder details for DB insertion
    db_folders = []
    for f, fid, path, pid in all_folders:
        db_folders.append({
            "id": fid,
            "mailbox_id": mailbox_id,
            "name": f.name or "Root",
            "full_path": path,
            "parent_id": pid,
            "total_count": f.number_of_sub_messages,
            "unread_count": f.number_of_sub_messages # default to all unread
        })
    
    # Yield folders list first
    yield [], db_folders, []

    # Now iterate through emails folder by folder
    emails_batch = []
    errors_batch = []
    
    for folder, _, path, _ in all_folders:
        num_msgs = folder.number_of_sub_messages
        if num_msgs == 0:
            continue
            
        for i in range(num_msgs):
            try:
                msg = folder.get_sub_message(i)
                parsed = parse_pypff_message(msg, mailbox_id, path, i)
                emails_batch.append(parsed)
            except Exception as e:
                errors_batch.append({
                    "mailbox_id": mailbox_id,
                    "folder_path": path,
                    "message_index": i,
                    "error_type": "message_parse_failed",
                    "error_detail": str(e)
                })
                
            if len(emails_batch) >= batch_size:
                yield emails_batch, [], errors_batch
                emails_batch = []
                errors_batch = []
                
    if emails_batch or errors_batch:
        yield emails_batch, [], errors_batch

    pst.close()

def load_pst_message_details(file_path: str, folder_path: str, msg_index: int) -> Dict[str, Any]:
    """Navigates to the exact folder and loads the full plain text and HTML bodies of a message."""
    pst = pypff.file()
    pst.open(file_path)
    
    # Navigate
    parts = [p for p in folder_path.split("/") if p]
    current = pst.get_root_folder()
    
    for part in parts:
        found = False
        for i in range(current.number_of_sub_folders):
            sub = current.get_sub_folder(i)
            if sub.name == part:
                current = sub
                found = True
                break
        if not found:
            raise ValueError(f"Folder '{part}' not found in path '{folder_path}'")
            
    if msg_index >= current.number_of_sub_messages:
        raise IndexError(f"Message index {msg_index} out of range for folder '{folder_path}'")
        
    msg = current.get_sub_message(msg_index)
    
    plain_bytes = msg.plain_text_body
    html_bytes = msg.html_body
    rtf_bytes = msg.rtf_body
    
    body_text = safe_decode_bytes(plain_bytes) if plain_bytes else ""
    body_html = safe_decode_bytes(html_bytes) if html_bytes else ""
    
    # Fallback RTF
    if not body_html and rtf_bytes:
        # A simple RTF message signpost
        body_html = f"<div style='font-family:sans-serif;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;'><strong>[RTF Content]</strong><p>Este email está no formato Outlook RTF.</p></div>"
        if not body_text:
            body_text = "[Outlook RTF Content]"

    # If HTML is empty, build a simple HTML wrapped body from plaintext
    if not body_html and body_text:
        body_html = f"<html><body><pre style='white-space:pre-wrap;font-family:sans-serif;'>{body_text}</pre></body></html>"

    pst.close()
    return {
        "body_text": body_text,
        "body_html": body_html
    }

def read_pst_attachment_bytes(file_path: str, folder_path: str, msg_index: int, att_index: int) -> bytes:
    """Navigates and reads raw bytes of the attachment from the PST."""
    pst = pypff.file()
    pst.open(file_path)
    
    # Navigate
    parts = [p for p in folder_path.split("/") if p]
    current = pst.get_root_folder()
    for part in parts:
        for i in range(current.number_of_sub_folders):
            sub = current.get_sub_folder(i)
            if sub.name == part:
                current = sub
                break
                
    msg = current.get_sub_message(msg_index)
    att = msg.get_attachment(att_index)
    
    size = att.size if hasattr(att, "size") else att.get_size()
    data = att.read_buffer(size)
    pst.close()
    return data
