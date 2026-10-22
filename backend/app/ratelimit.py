"""In-process sliding-window rate limiter for auth and practice endpoints.

The state lives in this process only. Multi-worker or multi-instance
deployments must add a global limit at the reverse proxy or gateway.
"""

from __future__ import annotations

import time
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
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()
        self._last_sweep = float("-inf")

    def allow(self, key: str, now: float | None = None) -> bool:
        stamp = time.monotonic() if now is None else now
        cutoff = stamp - self.window_seconds
        with self._lock:
            self._evict_idle(stamp, cutoff)
            recent = [hit for hit in self._hits.get(key, ()) if hit > cutoff]
            if len(recent) >= self.limit:
                self._hits[key] = recent
                return False
            recent.append(stamp)
            self._hits[key] = recent
            return True

    def _evict_idle(self, stamp: float, cutoff: float) -> None:
        """Drop keys whose newest hit left the window, at most once per window.

        Without this every client IP or user ever seen keeps an entry for the
        process lifetime, so memory grows with the number of distinct clients.
        """
        if stamp - self._last_sweep < self.window_seconds:
            return
        self._last_sweep = stamp
        idle = [
            key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff
        ]
        for key in idle:
            del self._hits[key]

    def tracked_keys(self) -> int:
        with self._lock:
            return len(self._hits)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._last_sweep = float("-inf")


auth_limiter = InMemoryRateLimiter(limit=5, window_seconds=60.0)
practice_limiter = InMemoryRateLimiter(limit=20, window_seconds=60.0)
