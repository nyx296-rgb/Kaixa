import pytest
from services.mailbox_cache import set_mailbox, get_mailbox

@pytest.mark.asyncio
async def test_mailbox_cache():
    await set_mailbox('test1', {'status': 'ready'})
    result = await get_mailbox('test1')
    assert result == {'status': 'ready'}
