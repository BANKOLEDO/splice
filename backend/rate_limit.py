import time
from typing import Callable
from fastapi import Request, HTTPException, status
from database import get_db
class DatabaseRateLimiter:
    def __init__(self, max_per_minute: int = 120):
        self.max_per_minute = max_per_minute
    def check(self, conn, key: str) -> bool:
        now = int(time.time())
        window_start = now - (now % 60)  # round down to minute
        # Try to insert or increment atomically
        conn.execute(
            """INSERT INTO rate_limits (key, window_start, count)
               VALUES (?, ?, 1)
               ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1""",
            (key, window_start),
        )
        conn.commit()
        row = conn.execute(
            "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
            (key, window_start),
        ).fetchone()
        return row["count"] <= self.max_per_minute
rate_limiter = DatabaseRateLimiter()


async def rate_limit_middleware(request: Request, call_next: Callable):
    if request.url.path.startswith("/api/"):
        conn = get_db()
        # Use user_id if authenticated, fall back to IP
        auth_header = request.headers.get("Authorization", "")
        key = auth_header if auth_header.startswith("Bearer ") else (request.client.host if request.client else "unknown")
        if not rate_limiter.check(conn, key):
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
    response = await call_next(request)
    return response
