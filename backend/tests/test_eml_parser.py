import os
import tempfile
import pytest
import uuid
from parsers.eml_parser import parse_single_eml

@pytest.mark.asyncio
async def test_eml_parser():
    # Arrange: Create a temporary EML file
    eml_content = """From: "Alice Test" <alice@example.com>
To: bob@example.com, charlie@example.com
Subject: Test EML Parsing
Date: Mon, 28 May 2026 10:00:00 +0000
Content-Type: text/plain; charset="utf-8"

Hello World!
This is a test message.
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".eml", delete=False) as f:
        f.write(eml_content)
        temp_path = f.name

    mailbox_id = str(uuid.uuid4())

    try:
        # Act
        result = await parse_single_eml(temp_path, mailbox_id)

        # Assert
        assert result["mailbox_id"] == mailbox_id
        assert result["subject"] == "Test EML Parsing"
        assert result["sender"] == '"Alice Test" <alice@example.com>'
        assert "bob@example.com" in result["recipients"]
        assert "Hello World!" in result["body_text"]
        assert result["has_attach"] == 0
        assert len(result["attachments"]) == 0
    finally:
        os.remove(temp_path)
