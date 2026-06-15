# job_manager.py
# Manages enqueueing parse jobs and tracking status via SQLite + ARQ (Redis)

import os
import uuid
import time
from typing import Optional

from arq import create_pool
from arq.connections import RedisSettings

from db import queries


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def _parse_redis_url(url: str) -> RedisSettings:
    """Converts a redis:// URL into ARQ RedisSettings."""
    # redis://host:port or redis://user:pass@host:port
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
    )


async def enqueue_parse(file_path: str, mailbox_id: str, file_format: str) -> str:
    """
    Creates a job record in SQLite. For small files (< 10MB), processes directly
    in the background. For large files, enqueues a task on Redis/ARQ.
    Returns the job_id.
    """
    job_id = str(uuid.uuid4())

    # Persist job in SQLite for tracking even if the worker restarts
    await queries.create_job(job_id, mailbox_id, status="pending")

    # Fast path: bypass Redis for small files (< 10MB)
    try:
        file_size = os.path.getsize(file_path)
        if file_size < 10 * 1024 * 1024:
            import asyncio
            from workers.parse_worker import parse_mailbox_job
            # Run in the event loop background without blocking the request
            asyncio.create_task(parse_mailbox_job({}, file_path, mailbox_id, job_id, file_format))
            return job_id
    except OSError:
        pass

    # Enqueue in ARQ for large files
    try:
        redis_settings = _parse_redis_url(REDIS_URL)
        redis_pool = await create_pool(redis_settings)
        await redis_pool.enqueue_job(
            "parse_mailbox_job",
            file_path=file_path,
            mailbox_id=mailbox_id,
            job_id=job_id,
            file_format=file_format,
            _job_id=job_id,  # ARQ deduplication key
        )
        await redis_pool.close()
    except Exception as e:
        # Fallback if Redis is not available even for large files (though not recommended for 50GB files)
        import asyncio
        from workers.parse_worker import parse_mailbox_job
        asyncio.create_task(parse_mailbox_job({}, file_path, mailbox_id, job_id, file_format))

    return job_id


async def cancel_job(job_id: str):
    """Marks job as cancelled in the database. Worker checks this to abort."""
    await queries.update_job(job_id, status="cancelled", progress=0)


async def get_job_status(job_id: str):
    """Returns the current job status from SQLite."""
    return await queries.get_job(job_id)
