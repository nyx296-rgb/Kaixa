# msg_parser.py
# Parser for Outlook .msg files using extract-msg library

import os
import uuid
import json
import time
from typing import Dict, Any, List

import extract_msg


def parse_msg_file(file_path: str, mailbox_id: str) -> Dict[str, Any]:
    """
    Parses a single .msg file into our standardized email dict.
    MSG files are individual emails (not archives), so this returns one email.
    """
    msg = extract_msg.openMsg(file_path)
    email_id = str(uuid.uuid4())

    # Headers
    subject = msg.subject or "(No Subject)"
    sender = msg.sender or ""

    recipients = []
    cc_list = []
    bcc_list = []

    if msg.to:
        recipients = [r.strip() for r in msg.to.split(";") if r.strip()]
    if msg.cc:
        cc_list = [c.strip() for c in msg.cc.split(";") if c.strip()]
    if msg.bcc:
        bcc_list = [b.strip() for b in msg.bcc.split(";") if b.strip()]

    # Date
    date_ts = int(time.time())
    if msg.date:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(msg.date)
            date_ts = int(dt.timestamp())
        except Exception:
            pass

    # Body
    body_text = msg.body or ""
    body_html = msg.htmlBody
    if isinstance(body_html, bytes):
        body_html = body_html.decode("utf-8", errors="replace")

    # If no HTML, wrap plain text
    if not body_html and body_text:
        body_html = f"<html><body><pre style='white-space:pre-wrap;font-family:sans-serif;'>{body_text}</pre></body></html>"

    # RTF fallback
    if not body_text and not body_html:
        rtf = msg.rtfBody
        if rtf:
            try:
                import re
                if isinstance(rtf, bytes):
                    rtf_str = rtf.decode('windows-1252', errors='ignore')
                else:
                    rtf_str = str(rtf)
                # Simplistic RTF strip
                text = re.sub(r'\\[a-z]+[0-9]* ?', '', rtf_str)
                text = re.sub(r'[{}]', '', text)
                body_text = text.strip()
                body_html = f"<html><body><pre>{body_text}</pre></body></html>"
            except Exception:
                body_text = "[Outlook RTF Content]"
                body_html = "<div style='font-family:sans-serif;padding:12px;'><strong>[RTF Content]</strong></div>"

    # Attachments
    attachments = []
    for i, att in enumerate(msg.attachments):
        att_id = str(uuid.uuid4())
        filename = att.longFilename or att.shortFilename or f"attachment_{i + 1}"
        mime_type = att.mimetype or "application/octet-stream"
        size = len(att.data) if att.data else 0

        attachments.append({
            "id": att_id,
            "email_id": email_id,
            "filename": filename,
            "mime_type": mime_type,
            "size": size,
            "raw_offset": i,
        })

    has_attach = 1 if attachments else 0

    # Importance
    importance = "normal"
    try:
        imp_val = msg.importance
        if imp_val is not None:
            if imp_val == 2:
                importance = "high"
            elif imp_val == 0:
                importance = "low"
    except Exception:
        pass

    msg.close()

    return {
        "id": email_id,
        "mailbox_id": mailbox_id,
        "folder_path": "INBOX",
        "subject": subject,
        "sender": sender,
        "recipients": json.dumps(recipients),
        "cc": json.dumps(cc_list),
        "bcc": json.dumps(bcc_list),
        "date_ts": date_ts,
        "body_text": body_text,
        "body_html": body_html,
        "is_read": 0,
        "importance": importance,
        "has_attach": has_attach,
        "raw_offset": 0,
        "raw_size": os.path.getsize(file_path),
        "parse_error": None,
        "attachments": attachments,
    }


def read_msg_attachment_bytes(file_path: str, att_index: int) -> bytes:
    """Reads the raw bytes of a specific attachment from a .msg file."""
    msg = extract_msg.openMsg(file_path)
    att = msg.attachments[att_index]
    data = att.data or b""
    msg.close()
    return data
