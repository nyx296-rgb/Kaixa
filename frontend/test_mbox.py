#!/usr/bin/env python3
"""Generate a test mbox with 100 emails and diverse attachments."""

import email.mime.multipart
import email.mime.text
import email.mime.base
import email.utils
import mailbox
import os
import random
import string
import time
from email import encoders

MBOX_PATH = "test_mailbox.mbox"
NUM_EMAILS = 100
MIN_ATT_SIZE = 120 * 1024  # 120KB

rng = random.Random(42)

SENDERS = [
    "alice@empresa.com.br", "bob@empresa.com.br", "carlos@empresa.com.br",
    "diana@empresa.com.br", "eduardo@empresa.com.br", "fernanda@empresa.com.br",
]
SUBJECTS = [
    "Relatório mensal", "Proposta comercial", "Ata de reunião",
    "Orçamento aprovado", "Contrato revisão", "Relatório financeiro",
    "Apresentação Q4", "Nota fiscal", "Documentação técnica",
    "Feedback 360", "Plano de projetos", "Relatório de vendas",
]

TEXT_POOL = bytes(rng.getrandbits(8) for _ in range(4 * 1024 * 1024))


def chunk(size: int) -> bytes:
    result = bytearray()
    while len(result) < size:
        take = min(size - len(result), len(TEXT_POOL))
        result.extend(TEXT_POOL[:take])
    return bytes(result)


def make_pdf(size: int) -> bytes:
    header = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n"
    return header + chunk(size - len(header))


def make_jpeg(size: int) -> bytes:
    header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
    return header + chunk(size - len(header))


def make_png(size: int) -> bytes:
    header = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return header + chunk(size - len(header))


def make_docx(size: int) -> bytes:
    # Minimal ZIP/OOXML header
    header = b"PK\x03\x04\x14\x00\x00\x00\x08\x00" + b"\x00" * 400
    return header + chunk(size - len(header))


def make_xlsx(size: int) -> bytes:
    header = b"PK\x03\x04\x14\x00\x00\x00\x08\x00" + b"\x00" * 400
    return header + chunk(size - len(header))


ATT_TYPES = [
    ("pdf",  "application/pdf",                         make_pdf),
    ("jpg",  "image/jpeg",                              make_jpeg),
    ("png",  "image/png",                               make_png),
    ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", make_docx),
    ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",      make_xlsx),
]


def create_email(idx: int) -> mailbox.mboxMessage:
    msg = email.mime.multipart.MIMEMultipart()
    msg["From"] = rng.choice(SENDERS)
    msg["To"] = "user@empresa.com.br"
    msg["Subject"] = f"{rng.choice(SUBJECTS)} #{idx:04d}"
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain="empresa.com.br")

    text = chunk(rng.randint(300, 1500)).decode("latin-1", errors="replace")
    msg.attach(email.mime.text.MIMEText(text, "plain", "utf-8"))
    msg.attach(email.mime.text.MIMEText(f"<html><body><p>{text}</p></body></html>", "html", "utf-8"))

    chosen = rng.choices(ATT_TYPES, k=rng.randint(2, 3))
    for ext, mime, maker in chosen:
        size = MIN_ATT_SIZE + rng.randint(0, 80 * 1024)
        att = email.mime.base.MIMEBase(*mime.split("/"))
        att.set_payload(maker(size))
        encoders.encode_base64(att)
        att.add_header("Content-Disposition", "attachment",
                       filename=f"arquivo_{idx:04d}_{rng.randint(1000,9999)}.{ext}")
        msg.attach(att)

    return mailbox.mboxMessage(msg)


def main():
    if os.path.exists(MBOX_PATH):
        os.remove(MBOX_PATH)

    print(f"Gerando '{MBOX_PATH}' com {NUM_EMAILS} emails...")
    mbox = mailbox.mbox(MBOX_PATH)
    mbox.clear()
    start = time.time()

    for i in range(1, NUM_EMAILS + 1):
        mbox.add(create_email(i))
        if i % 20 == 0:
            print(f"  {i}/{NUM_EMAILS}")

    mbox.close()
    mb = os.path.getsize(MBOX_PATH) / (1024 * 1024)
    print(f"Pronto: {mb:.1f} MB, {NUM_EMAILS} emails, {time.time()-start:.1f}s")


if __name__ == "__main__":
    main()
