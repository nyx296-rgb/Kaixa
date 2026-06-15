#!/usr/bin/env python3
"""
Generate corrupted file fixtures for resilience testing.
Creates intentionally corrupted MBOX, PST, and EML files.
"""

import os
import struct
import tempfile
from email.message import EmailMessage
from email.utils import format_datetime
import datetime


def create_corrupted_mbox(output_path: str):
    """Create an MBOX file with corrupted separators and messages."""
    print(f'Creating corrupted MBOX: {output_path}')
    
    with open(output_path, 'wb') as f:
        # Write some valid messages first
        for i in range(5):
            msg = EmailMessage()
            msg['Subject'] = f'Valid Message #{i+1}'
            msg['From'] = 'sender@example.com'
            msg['To'] = 'recipient@example.com'
            msg['Date'] = format_datetime(datetime.datetime.now())
            msg.set_content(f'This is valid message #{i+1}')
            
            # Write From separator (correct format)
            f.write(b'From sender@example.com Mon Jan 1 00:00:00 2024\n')
            f.write(msg.as_bytes())
            f.write(b'\n\n')
        
        # Corrupted message 1: Missing From separator
        msg = EmailMessage()
        msg['Subject'] = 'Corrupted - Missing Separator'
        msg['From'] = 'sender@example.com'
        msg.set_content('This message has no From separator')
        f.write(msg.as_bytes())
        f.write(b'\n\n')
        
        # Corrupted message 2: Truncated headers
        f.write(b'From sender@example.com Mon Jan 1 00:00:00 2024\n')
        f.write(b'Subject: Truncated Header\n')
        f.write(b'From: sender@exam')  # Truncated
        f.write(b'\n\nBody content here\n\n')
        
        # Corrupted message 3: Invalid encoding
        f.write(b'From sender@example.com Mon Jan 1 00:00:00 2024\n')
        f.write(b'Subject: Invalid Encoding\n')
        f.write(b'Content-Type: text/plain; charset=utf-8\n')
        f.write(b'\n')
        f.write(b'\xff\xfe\xfd\xfc\xfb\xfa')  # Invalid UTF-8
        f.write(b'\n\n')
        
        # More valid messages
        for i in range(5, 10):
            msg = EmailMessage()
            msg['Subject'] = f'Valid Message #{i+1}'
            msg['From'] = 'sender@example.com'
            msg['To'] = 'recipient@example.com'
            msg['Date'] = format_datetime(datetime.datetime.now())
            msg.set_content(f'This is valid message #{i+1}')
            
            f.write(b'From sender@example.com Mon Jan 1 00:00:00 2024\n')
            f.write(msg.as_bytes())
            f.write(b'\n\n')
    
    print(f'  Created corrupted MBOX with 8 valid and 3 corrupted messages')


def create_corrupted_eml(output_path: str):
    """Create corrupted EML files."""
    print(f'Creating corrupted EML: {output_path}')
    
    # Corrupted EML 1: Invalid headers
    with open(os.path.join(output_path, 'corrupted_headers.eml'), 'wb') as f:
        f.write(b'Subject: Corrupted Headers\n')
        f.write(b'From: sender@exam')  # Truncated
        f.write(b'\n\nBody content')
    
    # Corrupted EML 2: Invalid encoding
    with open(os.path.join(output_path, 'corrupted_encoding.eml'), 'wb') as f:
        f.write(b'Subject: Invalid Encoding\n')
        f.write(b'From: sender@example.com\n')
        f.write(b'Content-Type: text/plain; charset=utf-8\n')
        f.write(b'\n')
        f.write(b'\xff\xfe\xfd\xfc\xfb\xfa')  # Invalid UTF-8
    
    # Corrupted EML 3: Truncated file
    with open(os.path.join(output_path, 'truncated.eml'), 'wb') as f:
        f.write(b'Subject: Truncated File\n')
        f.write(b'From: sender@example.com\n')
        f.write(b'\nBody content that gets truncated abruptly')
        # File ends abruptly
    
    # Corrupted EML 4: Binary junk
    with open(os.path.join(output_path, 'binary_junk.eml'), 'wb') as f:
        f.write(os.urandom(1024))  # Random binary data
    
    print(f'  Created 4 corrupted EML files')


def create_corrupted_pst(output_path: str):
    """Create a minimal corrupted PST-like file for testing."""
    print(f'Creating corrupted PST-like file: {output_path}')
    
    # PST signature is "!BDN" (0x2142444E)
    pst_signature = b'\x21\x42\x44\x4E'
    
    with open(output_path, 'wb') as f:
        # Write PST signature
        f.write(pst_signature)
        
        # Write garbage data (simulating corruption)
        f.write(os.urandom(1024))
        
        # Write another signature in the middle (simulating nested corruption)
        f.write(pst_signature)
        f.write(os.urandom(512))
    
    print(f'  Created corrupted PST-like file')


def main():
    """Generate all corrupted fixtures."""
    output_dir = 'test_data/corrupted'
    os.makedirs(output_dir, exist_ok=True)
    
    # Create corrupted MBOX
    mbox_path = os.path.join(output_dir, 'corrupted.mbox')
    create_corrupted_mbox(mbox_path)
    
    # Create corrupted EMLs
    eml_dir = os.path.join(output_dir, 'eml')
    os.makedirs(eml_dir, exist_ok=True)
    create_corrupted_eml(eml_dir)
    
    # Create corrupted PST-like file
    pst_path = os.path.join(output_dir, 'corrupted.pst')
    create_corrupted_pst(pst_path)
    
    print(f'\nAll corrupted fixtures created in {output_dir}/')


if __name__ == '__main__':
    main()
