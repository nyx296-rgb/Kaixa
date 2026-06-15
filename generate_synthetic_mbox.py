#!/usr/bin/env python3
"""
Synthetic MBOX Generator for Load Testing
Generates large .mbox files with configurable number of emails.
"""

import os
import sys
import email
import mailbox
import datetime
import random
import string
import argparse
from email.message import EmailMessage
from email.utils import format_datetime


def random_string(length: int) -> str:
    """Generate random string of given length."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


def generate_email(index: int, base_date: datetime.datetime) -> EmailMessage:
    """Generate a single email with realistic headers and body."""
    msg = EmailMessage()
    
    # Randomize date within last 30 days
    days_offset = random.randint(0, 30)
    hours_offset = random.randint(0, 23)
    minutes_offset = random.randint(0, 59)
    email_date = base_date - datetime.timedelta(days=days_offset, hours=hours_offset, minutes=minutes_offset)
    
    msg['Subject'] = f'Test Email #{index} - {random_string(20)}'
    msg['From'] = f'user{random.randint(1, 1000)}@example.com'
    msg['To'] = f'recipient{random.randint(1, 500)}@example.com'
    msg['Date'] = format_datetime(email_date)
    msg['Message-ID'] = f'<{random_string(32)}@example.com>'
    msg['X-Priority'] = str(random.randint(1, 5))
    
    # Generate body with variable size
    body_size = random.randint(100, 5000)
    body_text = f'Email body content #{index}:\n\n'
    body_text += random_string(body_size)
    body_text += '\n\n-- End of message --'
    
    msg.set_content(body_text)
    
    # Add HTML alternative (50% chance)
    if random.random() > 0.5:
        html_content = f'''
<html>
<body>
<h1>Email #{index}</h1>
<p>{random_string(body_size // 2)}</p>
</body>
</html>
'''
        msg.add_alternative(html_content, subtype='html')
    
    # Add attachment (30% chance)
    if random.random() > 0.7:
        attachment_size = random.randint(100, 10000)
        attachment_content = random_string(attachment_size).encode()
        msg.add_attachment(
            attachment_content,
            maintype='application',
            subtype='octet-stream',
            filename=f'attachment_{index}.bin'
        )
    
    return msg


def generate_mbox(output_path: str, num_emails: int, verbose: bool = True):
    """Generate an MBOX file with specified number of emails."""
    if verbose:
        print(f'Generating {num_emails:,} emails to {output_path}...')
    
    # Remove existing file
    if os.path.exists(output_path):
        os.remove(output_path)
    
    mbox = mailbox.mbox(output_path)
    base_date = datetime.datetime.now()
    
    for i in range(1, num_emails + 1):
        msg = generate_email(i, base_date)
        mbox.add(msg)
        
        if verbose and i % 10000 == 0:
            print(f'  Generated {i:,} / {num_emails:,} emails...')
    
    mbox.flush()
    mbox.close()
    
    file_size = os.path.getsize(output_path)
    if verbose:
        print(f'Done! File size: {file_size / (1024*1024):.2f} MB')
    
    return file_size


def main():
    parser = argparse.ArgumentParser(description='Generate synthetic MBOX files for load testing')
    parser.add_argument('-n', '--num-emails', type=int, default=100000,
                        help='Number of emails to generate (default: 100000)')
    parser.add_argument('-o', '--output', type=str, default=None,
                        help='Output file path (default: synthetic_{n}.mbox)')
    parser.add_argument('-q', '--quiet', action='store_true',
                        help='Suppress output')
    
    args = parser.parse_args()
    
    output_path = args.output or f'synthetic_{args.num_emails}.mbox'
    verbose = not args.quiet
    
    generate_mbox(output_path, args.num_emails, verbose)


if __name__ == '__main__':
    main()
