"""In-process sliding-window rate limiter for auth endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock


class InMemoryRateLimiter:
    """Allow at most `limit` hits per `window_seconds` for each key."""

    def __init__(self, limit: int = 5, window_seconds: float = 60.0) -> None:
        if limit < 1:
            raise ValueError("limit must be at least 1")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        stamp = time.monotonic() if now is None else now
        cutoff = stamp - self.window_seconds
        with self._lock:
            recent = [hit for hit in self._hits[key] if hit > cutoff]
            if len(recent) >= self.limit:
                self._hits[key] = recent
                return False
            recent.append(stamp)
            self._hits[key] = recent
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = InMemoryRateLimiter(limit=5, window_seconds=60.0)
