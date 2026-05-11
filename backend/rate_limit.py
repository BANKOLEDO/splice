import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, HTTPException, status


class InMemoryRateLimiter:
    def __init__(self, max_per_minute: int = 120):
        self.max_per_minute = max_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        now = time.time()
        window = now - 60
        self.requests[key] = [t for t in self.requests[key] if t > window]
        if len(self.requests[key]) >= self.max_per_minute:
            return False
        self.requests[key].append(now)
        return True


rate_limiter = InMemoryRateLimiter()


async def rate_limit_middleware(request: Request, call_next: Callable):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        if not rate_limiter.check(key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again in 60 seconds.",
            )
    response = await call_next(request)
    return response
