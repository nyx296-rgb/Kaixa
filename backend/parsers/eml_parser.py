# eml_parser.py
# Lazy parser for MBOX archives and EML files with robust encoding fallback

import os
import uuid
import json
import time
import mailbox
import chardet
from email.header import decode_header
from email.utils import parsedate_to_datetime
from typing import Generator, List, Dict, Any, Tuple, Optional

def safe_decode(raw_bytes: bytes, declared_charset=None) -> str:
    """Decodes bytes to string using declared charset, falling back to chardet and replacement."""
    if not raw_bytes:
        return ""
    
    if isinstance(declared_charset, bytes):
        declared_charset = declared_charset.decode("ascii", errors="ignore")
    
    charsets_to_try = []
    if declared_charset and isinstance(declared_charset, str):
        charsets_to_try.append(declared_charset.strip().lower())
    
    # Common standard encodings to try
    charsets_to_try.extend(["utf-8", "latin1", "windows-1252", "ascii"])
    
    for charset in charsets_to_try:
        try:
            return raw_bytes.decode(charset)
        except (UnicodeDecodeError, LookupError):
            continue
            
    # Try auto-detecting
    try:
        detected = chardet.detect(raw_bytes)
        if detected and detected.get("charset"):
            return raw_bytes.decode(detected["charset"], errors="replace")
    except Exception:
        pass
        
    return raw_bytes.decode("utf-8", errors="replace")

def clean_header(header_val: Any) -> str:
    """Decodes email headers safely from RFC-2047 encoding (e.g. =?utf-8?Q?...?=)."""
    if not header_val:
        return ""
    
    if isinstance(header_val, bytes):
        return safe_decode(header_val)
    
    # Some libraries parse headers as list of tuples
    try:
        decoded_parts = decode_header(str(header_val))
        result = []
        for text, charset in decoded_parts:
            if isinstance(text, bytes):
                result.append(safe_decode(text, charset))
            else:
                result.append(text)
        return "".join(result)
    except Exception:
        return str(header_val)

def extract_addresses(header_val: Any) -> List[str]:
    """Extracts email addresses from fields like From, To, CC, BCC."""
    if not header_val:
        return []
    cleaned = clean_header(header_val)
    # Simple comma split for multiple addresses
    return [addr.strip() for addr in cleaned.split(",") if addr.strip()]

def parse_email_message(msg: mailbox.Message | Any, mailbox_id: str, folder_path: str, msg_key: int) -> Dict[str, Any]:
    """Parses a single email message structure into our standardized dictionary format."""
    email_id = str(uuid.uuid4())
    
    # 1. Parse Headers
    subject = clean_header(msg.get("subject", "(No Subject)"))
    sender = clean_header(msg.get("from", ""))
    recipients = extract_addresses(msg.get("to", ""))
    cc = extract_addresses(msg.get("cc", ""))
    bcc = extract_addresses(msg.get("bcc", ""))
    
    # Parse Date
    date_ts = int(time.time())
    date_val = msg.get("date")
    if date_val:
        if isinstance(date_val, bytes):
            date_val = safe_decode(date_val)
        try:
            dt = parsedate_to_datetime(date_val)
            date_ts = int(dt.timestamp())
        except Exception:
            pass # Use current timestamp fallback

    # Parse Importance
    importance_raw = msg.get("importance", "normal")
    if isinstance(importance_raw, bytes):
        importance_raw = safe_decode(importance_raw)
    importance_header = str(importance_raw).lower()
    importance = "normal"
    if "high" in importance_header or "urgent" in importance_header:
        importance = "high"
    elif "low" in importance_header:
        importance = "low"

    # 2. Extract bodies and attachments
    body_text_parts = []
    body_html_parts = []
    attachments = []
    
    # Walk multipart structures
    if msg.is_multipart():
        for part in msg.walk():
            content_type = str(part.get_content_type() or "")
            content_disposition = str(part.get("content-disposition", "") or "")
            
            # Check if attachment
            is_attachment = False
            if "attachment" in content_disposition:
                is_attachment = True
            
            filename = part.get_filename()
            if filename:
                if isinstance(filename, bytes):
                    filename = safe_decode(filename)
                else:
                    filename = clean_header(filename)
                is_attachment = True
                
            if is_attachment:
                # Attachment metadata
                att_id = str(uuid.uuid4())
                payload = part.get_payload(decode=True) or b""
                attachments.append({
                    "id": att_id,
                    "filename": filename or f"attachment_{len(attachments)+1}",
                    "mime_type": content_type,
                    "size": len(payload),
                    "raw_offset": len(attachments)  # Index within message for later extraction
                })
            else:
                # Text/HTML part
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset()
                    if isinstance(charset, bytes):
                        charset = safe_decode(charset)
                    decoded_text = safe_decode(payload, charset)
                    if content_type == "text/plain":
                        body_text_parts.append(decoded_text)
                    elif content_type == "text/html":
                        body_html_parts.append(decoded_text)
    else:
        # Simple non-multipart email
        content_type = str(msg.get_content_type() or "")
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset()
            if isinstance(charset, bytes):
                charset = safe_decode(charset)
            decoded_text = safe_decode(payload, charset)
            if content_type == "text/html":
                body_html_parts.append(decoded_text)
            else:
                body_text_parts.append(decoded_text)

    body_text = "\n".join(body_text_parts) if body_text_parts else None
    body_html = "\n".join(body_html_parts) if body_html_parts else None
    
    # Auto-generate body_text from body_html if text is missing
    if not body_text and body_html:
        # Simple HTML tag strip for search fallback
        import re
        body_text = re.sub(r'<[^>]+>', '', body_html)
        
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
        "body_text": body_text,
        "body_html": body_html,
        "is_read": 0,
        "importance": importance,
        "has_attach": has_attach,
        "raw_offset": msg_key,  # Used as the message key to locate it in the MBOX
        "raw_size": len(msg.as_string()) if hasattr(msg, 'as_string') else 0,
        "parse_error": None,
        "attachments": attachments
    }

async def iter_mbox_lazy(file_path: str, mailbox_id: str, batch_size: int = 500) -> Generator[Tuple[List[Dict[str, Any]], List[Dict[str, Any]]], None, None]:
    """
    Lazy generator reading MBOX. Yields (emails_batch, errors_batch).
    Keeps memory footprint low by reading messages by key index.
    """
    import email
    
    mbox = mailbox.mbox(file_path, factory=email.message_from_binary_file)
    keys = mbox.keys()
    total = len(keys)
    
    batch = []
    errors = []
    
    for idx, key in enumerate(keys):
        try:
            msg = mbox.get(key)
            parsed = parse_email_message(msg, mailbox_id, "INBOX", key)
            batch.append(parsed)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            # Capture error details
            errors.append({
                "mailbox_id": mailbox_id,
                "folder_path": "INBOX",
                "message_index": key,
                "error_type": "malformed_message",
                "error_detail": f"{e}\n{tb}",
                "raw_preview": None # We could read bytes from file, but keep it simple
            })
            
            # Yield partial ghost email
            ghost_id = str(uuid.uuid4())
            batch.append({
                "id": ghost_id,
                "mailbox_id": mailbox_id,
                "folder_path": "INBOX",
                "subject": f"[Parse Error] Message #{key}",
                "sender": "System",
                "recipients": json.dumps([]),
                "cc": json.dumps([]),
                "bcc": json.dumps([]),
                "date_ts": int(time.time()),
                "body_text": f"Error parsing this message: {str(e)}",
                "body_html": f"<p style='color:red'>Error parsing this message: {str(e)}</p>",
                "is_read": 0,
                "importance": "normal",
                "has_attach": 0,
                "raw_offset": key,
                "raw_size": 0,
                "parse_error": str(e),
                "attachments": []
            })
            
        if len(batch) >= batch_size:
            yield batch, errors
            batch = []
            errors = []
            
    if batch:
        yield batch, errors

async def parse_single_eml(file_path: str, mailbox_id: str) -> Dict[str, Any]:
    """Parses a single EML file into our database model."""
    import email
    import email.policy
    with open(file_path, "rb") as f:
        msg_bytes = f.read()
        
    msg = email.message_from_bytes(msg_bytes, policy=email.policy.compat32)
    parsed = parse_email_message(msg, mailbox_id, "INBOX", 0)
    parsed["raw_size"] = len(msg_bytes)
    return parsed
