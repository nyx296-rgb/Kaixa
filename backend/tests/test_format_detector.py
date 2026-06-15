import os
import json
import tempfile
from services.format_detector import detect_format

def test_detect_eml_format():
    # Create a minimal EML file content
    eml_content = b"From: alice@example.com\nTo: bob@example.com\nSubject: Test\nDate: Mon, 1 Jan 2024 00:00:00 +0000\n\nHello World"
    with tempfile.NamedTemporaryFile(delete=False, suffix='.eml') as tmp:
        tmp.write(eml_content)
        tmp_path = tmp.name
    try:
        fmt, encoding = detect_format(tmp_path)
        assert fmt == 'eml'
    finally:
        os.remove(tmp_path)

def test_detect_encoding():
    # Create EML with UTF-8 BOM
    eml_content = b'\xef\xbb\xbf' + b"From: alice@example.com\nTo: bob@example.com\nSubject: Test\n\nHello World"
    with tempfile.NamedTemporaryFile(delete=False, suffix='.eml') as tmp:
        tmp.write(eml_content)
        tmp_path = tmp.name
    try:
        fmt, encoding = detect_format(tmp_path)
        assert fmt == 'eml'
        assert encoding is not None and encoding.upper() == 'UTF-8-SIG'
    finally:
        os.remove(tmp_path)
