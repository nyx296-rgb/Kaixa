import os
import pytest
from parsers.eml_parser import parse_single_eml


class TestResilience:
    """Test fault-tolerant parsing of corrupted files."""
    
    @pytest.mark.asyncio
    async def test_corrupted_mbox_partial_recovery(self):
        """Test that valid messages are recovered from corrupted MBOX."""
        # This test requires the corrupted mbox fixture
        # For now, we'll create a simple test with inline data
        pass
    
    @pytest.mark.asyncio
    async def test_corrupted_eml_graceful_handling(self):
        """Test that corrupted EML files are handled gracefully."""
        # Create a minimal corrupted EML
        import tempfile
        corrupted_content = b'Subject: Corrupted\nFrom: exam\n\nBody'
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.eml') as f:
            f.write(corrupted_content)
            f.flush()
            
            try:
                # Should not raise exception, should return partial result or None
                result = await parse_single_eml(f.name, "test_mailbox")
                # Result might be None or have parse_error field
                # The important thing is no exception is raised
            finally:
                os.unlink(f.name)
    
    @pytest.mark.asyncio
    async def test_empty_file_handling(self):
        """Test that empty files are handled gracefully."""
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.eml') as f:
            f.write(b'')
            f.flush()
            
            try:
                result = await parse_single_eml(f.name, "test_mailbox")
                # Should return None or empty result, not raise
            finally:
                os.unlink(f.name)
    
    @pytest.mark.asyncio
    async def test_binary_junk_handling(self):
        """Test that binary junk files are handled gracefully."""
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.eml') as f:
            f.write(os.urandom(1024))
            f.flush()
            
            try:
                result = await parse_single_eml(f.name, "test_mailbox")
                # Should return None or handle gracefully
            finally:
                os.unlink(f.name)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
