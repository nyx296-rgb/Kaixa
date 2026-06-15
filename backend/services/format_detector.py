# format_detector.py
# File signature detection utility to avoid relying on file extensions

import re
import os
import magic
from typing import Optional

# Magic Byte signatures
SIGNATURES = {
    b"\x21\x42\x44\x4E": "pst",                  # PST/OST ("!BDN")
    b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1": "msg",  # MSG (OLE2 Compound Document File)
    b"\x4D\x53\x47\x46": "msg",                  # MSG (Alternative Outlook MSG format)
}

MBOX_PATTERN = re.compile(rb"^From \S+ \w{3} \w{3}", re.MULTILINE)


def _detect_encoding(header: bytes) -> Optional[str]:
    """Detect encoding from file header."""
    try:
        import chardet
        result = chardet.detect(header)
        if result and result.get("confidence", 0) > 0.5:
            return result.get("encoding")
    except Exception:
        pass
    
    # Check for BOM
    if header.startswith(b'\xef\xbb\xbf'):
        return 'utf-8-sig'
    elif header.startswith(b'\xff\xfe'):
        return 'utf-16-le'
    elif header.startswith(b'\xfe\xff'):
        return 'utf-16-be'
    
    return None

def detect_format(file_path: str) -> tuple[str, Optional[str]]:
    """
    Detects mailbox/file archive format based on magic bytes, file headers,
    and MIME types.
    
    Returns:
        Tuple of (format, encoding) where format is 'pst', 'msg', 'mbox', 'eml', 
        'directory', or 'unknown', and encoding is the detected encoding (if applicable).
    """
    if not os.path.exists(file_path):
        return ("unknown", None)

    if os.path.isdir(file_path):
        return ("directory", None)

    try:
        # Read the first 512 bytes for inspection
        with open(file_path, "rb") as f:
            header = f.read(512)
    except Exception:
        return ("unknown", None)

    if not header:
        return ("unknown", None)

    # 1. Match specific binary signatures
    for sig, fmt in SIGNATURES.items():
        if header.startswith(sig):
            # For PST/OST, check wMagicClient at offset 8 to distinguish
            if fmt == "pst" and len(header) >= 10:
                magic_client = header[8:10]
                if magic_client == b'\x53\x4D':  # SM = PST
                    return ("pst", None)
                elif magic_client == b'\x4F\x53':  # SO = OST
                    return ("ost", None)
                elif magic_client == b'\x41\x42':  # AB = PAB
                    return ("pst", None)  # Treat PAB as PST for now
            return (fmt, None)

    # 2. Check for MBOX format signature (From <sender> <date>)
    if MBOX_PATTERN.search(header[:128]):
        return ("mbox", None)

    # 3. Check for EML/RFC822 structure (starts with common header patterns)
    try:
        sample_text = header.decode("utf-8", errors="ignore")
        headers_found = 0
        for keyword in ["From:", "To:", "Subject:", "Date:", "MIME-Version:", "Received:", "Message-ID:"]:
            if keyword in sample_text[:256]:
                headers_found += 1
        if headers_found >= 2:
            # Try to detect encoding
            encoding = _detect_encoding(header)
            return ("eml", encoding)
    except Exception:
        pass

    # 4. Fallback using python-magic libmagic
    try:
        mime = magic.from_file(file_path, mime=True)
        MIME_MAP = {
            "application/vnd.ms-outlook": "pst",
            "application/x-outlook-pst": "pst",
            "message/rfc822": "eml",
            "application/mbox": "mbox",
            "application/octet-stream": "unknown" # generic
        }
        if mime in MIME_MAP:
            fmt = MIME_MAP[mime]
            encoding = None
            if fmt in ("eml", "mbox"):
                encoding = _detect_encoding(header)
            return (fmt, encoding)
    except Exception:
        pass

    # 5. Extension fallback as a last resort
    _, ext = os.path.splitext(file_path.lower())
    if ext == ".pst":
        return ("pst", None)
    elif ext == ".ost":
        return ("ost", None)
    elif ext == ".mbox":
        return ("mbox", None)
    elif ext == ".eml":
        encoding = _detect_encoding(header)
        return ("eml", encoding)
    elif ext == ".msg":
        return ("msg", None)

    return ("unknown", None)
