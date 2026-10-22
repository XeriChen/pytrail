"""Sliding-window limiter semantics and bounded memory."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ratelimit import InMemoryRateLimiter  # noqa: E402


class RateLimiterTests(unittest.TestCase):
    def test_limits_each_key_within_the_window(self) -> None:
        limiter = InMemoryRateLimiter(limit=2, window_seconds=60.0)
        self.assertTrue(limiter.allow("a", now=0.0))
        self.assertTrue(limiter.allow("a", now=1.0))
        self.assertFalse(limiter.allow("a", now=2.0))
        self.assertTrue(limiter.allow("b", now=2.0))
        # The oldest hit leaves the window after 60 seconds.
        self.assertTrue(limiter.allow("a", now=60.5))
        self.assertFalse(limiter.allow("a", now=60.6))

    def test_rejected_hits_do_not_extend_the_window(self) -> None:
        limiter = InMemoryRateLimiter(limit=1, window_seconds=10.0)
        self.assertTrue(limiter.allow("a", now=0.0))
        self.assertFalse(limiter.allow("a", now=5.0))
        self.assertTrue(limiter.allow("a", now=10.5))

    def test_idle_keys_are_evicted(self) -> None:
        limiter = InMemoryRateLimiter(limit=5, window_seconds=60.0)
        for index in range(100):
            self.assertTrue(limiter.allow(f"client-{index}", now=float(index) / 10))
        self.assertEqual(limiter.tracked_keys(), 100)
        self.assertTrue(limiter.allow("late", now=200.0))
        self.assertEqual(limiter.tracked_keys(), 1)

    def test_active_keys_survive_eviction(self) -> None:
        limiter = InMemoryRateLimiter(limit=2, window_seconds=60.0)
        self.assertTrue(limiter.allow("busy", now=100.0))
        self.assertTrue(limiter.allow("busy", now=150.0))
        self.assertTrue(limiter.allow("other", now=170.0))
        self.assertEqual(limiter.tracked_keys(), 2)
        # The hit at 150 survived the sweep, so only one more fits.
        self.assertTrue(limiter.allow("busy", now=171.0))
        self.assertFalse(limiter.allow("busy", now=172.0))

    def test_reset_clears_state(self) -> None:
        limiter = InMemoryRateLimiter(limit=1, window_seconds=60.0)
        self.assertTrue(limiter.allow("a", now=0.0))
        limiter.reset()
        self.assertEqual(limiter.tracked_keys(), 0)
        self.assertTrue(limiter.allow("a", now=1.0))

    def test_rejects_invalid_configuration(self) -> None:
        with self.assertRaises(ValueError):
            InMemoryRateLimiter(limit=0)
        with self.assertRaises(ValueError):
            InMemoryRateLimiter(window_seconds=0)


if __name__ == "__main__":
    unittest.main()
