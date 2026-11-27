import asyncio
import hashlib
import sqlite3
import sys
import tempfile
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from dashboard import plugin_api

# 2026-11-27 12:00 local time at UTC-6 (America/Mexico_City, no DST).
OFFSET = -360
NOW = datetime(2026, 11, 27, 18, 0, tzinfo=timezone.utc).timestamp()
DAY = 86400
AUTH = {"anthropic": {"oauth"}, "deepseek": {"api_key"}, "openrouter": {"api_key"},
        "mixed": {"oauth", "api_key"}}

SCHEMA = """
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, source TEXT, model TEXT, title TEXT, display_name TEXT,
  started_at REAL, billing_provider TEXT, billing_base_url TEXT, billing_mode TEXT,
  estimated_cost_usd REAL, actual_cost_usd REAL, cost_status TEXT, cost_source TEXT
);
CREATE TABLE session_model_usage (
  session_id TEXT, model TEXT, billing_provider TEXT, billing_base_url TEXT, billing_mode TEXT,
  task TEXT, estimated_cost_usd REAL, actual_cost_usd REAL, cost_status TEXT, cost_source TEXT
);
"""


def _session(conn, sid, started, provider="", cost=None, status=None, title=None, source="cli",
             mode=None, actual=None):
    conn.execute(
        "INSERT INTO sessions (id, source, model, title, started_at, billing_provider, billing_mode,"
        " estimated_cost_usd, actual_cost_usd, cost_status) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (sid, source, "m", title, started, provider, mode, cost, actual, status),
    )


def _usage(conn, sid, provider, cost, status="estimated", mode="", task="", actual=0.0):
    conn.execute(
        "INSERT INTO session_model_usage (session_id, model, billing_provider, billing_mode, task,"
        " estimated_cost_usd, actual_cost_usd, cost_status) VALUES (?,?,?,?,?,?,?,?)",
        (sid, "m", provider, mode, task, cost, actual, status),
    )


class SpendFixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "state.db"
        conn = sqlite3.connect(self.db)
        conn.executescript(SCHEMA)
        today = NOW - 3600  # 11:00 local today
        # Claude subscription (OAuth only) session today, with an aux call.
        _session(conn, "claude-today", today, "anthropic", 5.0, "estimated", title="Refactor app")
        _usage(conn, "claude-today", "anthropic", 4.0)
        _usage(conn, "claude-today", "anthropic", 1.0, task="background_review")
        # Session whose *final* provider is deepseek but most calls ran on
        # anthropic: the per-call rows must split it (the sessions row alone
        # would bill all 6.0 to deepseek).
        _session(conn, "switched", today - 600, "deepseek", 6.0, "estimated", title="Switched model")
        _usage(conn, "switched", "anthropic", 5.9)
        _usage(conn, "switched", "deepseek", 0.1)
        # Pay-per-use today, with an invoiced (actual) cost.
        _session(conn, "or-today", today - 1200, "openrouter", None, "actual", title=None, source="telegram")
        _usage(conn, "or-today", "openrouter", 0.5, status="actual", actual=0.45)
        # Hermes-marked subscription route.
        _session(conn, "codex", today - 1800, "openai-codex", 0.0, "included")
        _usage(conn, "codex", "openai-codex", 0.0, status="included", mode="subscription_included")
        _session(conn, "codex-priced", today - 1900, "acme", 2.0, "estimated")
        _usage(conn, "codex-priced", "acme", 2.0, mode="subscription_included")
        # Unknown cost status and an unclassifiable provider.
        _session(conn, "custom", today - 2400, "custom", None, "unknown")
        _usage(conn, "custom", "custom", 0.0, status="unknown")
        _session(conn, "mixed", today - 2500, "mixed", 1.5, "estimated")
        _usage(conn, "mixed", "mixed", 1.5)
        # Cron session without any cost or provider.
        _session(conn, "cron", today - 3000, None, None, None, source="cron")
        # Older data: no per-call rows, the sessions aggregate is the only source.
        _session(conn, "legacy", NOW - 3 * DAY, "deepseek", 0.75, None, title="Legacy run")
        # Earlier this month, outside the 7-day window.
        _session(conn, "early-month", NOW - 20 * DAY, "deepseek", 3.0, "estimated", title="Early")
        _usage(conn, "early-month", "deepseek", 3.0)
        # Last month: never counted.
        _session(conn, "last-month", NOW - 40 * DAY, "deepseek", 99.0, "estimated")
        _usage(conn, "last-month", "deepseek", 99.0)
        conn.commit()
        conn.close()

    def tearDown(self):
        self.tmp.cleanup()

    def spend(self, period):
        return plugin_api.compute_spend(self.db, period, OFFSET, now=NOW, auth=AUTH)


class SpendClassificationTest(unittest.TestCase):
    def test_rules(self):
        c = plugin_api.classify_cost
        self.assertEqual(c("anthropic", "", "estimated", AUTH), ("subscription", "oauth"))
        self.assertEqual(c("deepseek", "", "estimated", AUTH), ("metered", "api_key"))
        self.assertEqual(c("acme", "subscription_included", "estimated", AUTH), ("subscription", "hermes"))
        self.assertEqual(c("x", "", "included", AUTH), ("subscription", "hermes"))
        self.assertEqual(c("openai-codex", "", "estimated", {}), ("subscription", "provider"))
        self.assertEqual(c("claude-subscription-directsdk-experimental", "", "estimated", {}),
                         ("subscription", "provider"))
        self.assertEqual(c("mixed", "", "estimated", AUTH), ("unclassified", "mixed_credentials"))
        self.assertEqual(c("gone", "", "estimated", AUTH), ("unclassified", "no_credentials"))
        self.assertEqual(c("", "", "estimated", AUTH), ("unclassified", "no_provider"))
        self.assertEqual(c("deepseek", "", "unknown", AUTH), ("unclassified", "unknown_cost"))
        # Anthropic with an API key pays per token: real money.
        self.assertEqual(c("anthropic", "", "estimated", {"anthropic": {"api_key"}}), ("metered", "api_key"))

    def test_credentials_come_from_read_credential_pool_auth_types_only(self):
        def read_credential_pool(provider_id=None):  # sync in Hermes, like the real one
            return {
                "anthropic": [{"auth_type": "oauth", "access_token": "secret"}],
                "deepseek": [{"auth_type": "api_key", "access_token": "secret"}, {"label": "no type"}],
                "empty": [],
                "bad": "nope",
            }

        fake = {"hermes_cli.auth": types.SimpleNamespace(read_credential_pool=read_credential_pool)}
        with patch.dict(sys.modules, fake):
            got = plugin_api.credential_auth_types()
        self.assertEqual(got, {"anthropic": {"oauth"}, "deepseek": {"api_key"}})

    def test_credentials_fail_open_to_unknown(self):
        def broken(provider_id=None):
            raise RuntimeError("auth store locked")

        with patch.dict(sys.modules, {"hermes_cli.auth": types.SimpleNamespace(read_credential_pool=broken)}):
            self.assertEqual(plugin_api.credential_auth_types(), {})


class SpendWindowTest(unittest.TestCase):
    def test_local_day_and_calendar_month(self):
        w = plugin_api.spend_window("today", NOW, OFFSET)
        self.assertEqual(w["start"], datetime(2026, 11, 27, 6, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(w["month_start"], datetime(2026, 11, 1, 6, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(w["month_end"], datetime(2026, 12, 1, 6, 0, tzinfo=timezone.utc).timestamp())
        self.assertEqual(w["days_in_month"], 30)
        self.assertEqual(plugin_api.spend_window("week", NOW, OFFSET)["start"], NOW - 7 * DAY)

    def test_offset_is_clamped(self):
        a = plugin_api.spend_window("today", NOW, 10_000)
        b = plugin_api.spend_window("today", NOW, 14 * 60)
        self.assertEqual(a, b)


class ComputeSpendTest(SpendFixture):
    def test_today_splits_real_and_covered_per_call(self):
        r = self.spend("today")
        self.assertTrue(r["available"] and r["has_data"])
        real = {p["provider"]: p["cost"] for p in r["real"]["by_provider"]}
        covered = {p["provider"]: p["cost"] for p in r["covered"]["by_provider"]}
        # openrouter reports an invoice: actual (0.45) wins over the estimate.
        self.assertEqual(real, {"openrouter": 0.45, "deepseek": 0.1})
        self.assertAlmostEqual(r["real"]["total"], 0.55)
        self.assertAlmostEqual(r["real"]["actual"], 0.45)
        self.assertAlmostEqual(r["real"]["estimated"], 0.1)
        self.assertEqual(covered, {"anthropic": 10.9, "acme": 2.0})
        self.assertEqual(r["unclassified"]["total"], 1.5)
        self.assertEqual(r["unclassified"]["unknown_cost_sessions"], 1)
        self.assertEqual(r["classification"]["anthropic"], "oauth")
        # 8 sessions today; 2 have no cost at all (codex at $0 included, cron);
        # custom is unpriced.
        self.assertEqual(r["sessions"], {"in_range": 8, "with_cost": 5, "without_cost": 3})

    def test_top_sessions_rank_by_cost_and_by_real_spend(self):
        r = self.spend("today")
        self.assertEqual([s["id"] for s in r["top"]], ["switched", "claude-today", "codex-priced", "mixed", "or-today"])
        first = r["top"][0]
        self.assertEqual((first["title"], first["provider"], first["class"], first["cost"]),
                         ("Switched model", "anthropic", "mixed", 6.0))
        self.assertEqual([s["id"] for s in r["top_real"]], ["or-today", "switched"])
        self.assertEqual(r["top_real"][0]["cost"], 0.45)
        self.assertTrue(r["top_real"][0]["actual"])
        self.assertIsNone(r["top_real"][0]["title"])
        self.assertEqual(r["top_real"][0]["source"], "telegram")
        self.assertEqual(r["top_real"][1]["cost"], 0.1)
        # Ranked by real spend, the row names the metered provider behind it.
        self.assertEqual(r["top_real"][1]["provider"], "deepseek")

    def test_week_adds_legacy_sessions_from_their_aggregate(self):
        r = self.spend("week")
        real = {p["provider"]: p["cost"] for p in r["real"]["by_provider"]}
        self.assertEqual(real, {"deepseek": 0.85, "openrouter": 0.45})

    def test_month_projection_and_last_month_exclusion(self):
        r = self.spend("month")
        self.assertAlmostEqual(r["real"]["total"], 0.55 + 0.75 + 3.0)
        m = r["month"]
        self.assertEqual(m["days"], 30)
        elapsed = (NOW - m["start"]) / DAY
        self.assertAlmostEqual(m["elapsed_days"], round(elapsed, 3))
        self.assertAlmostEqual(m["projection"], round(4.3 / elapsed * 30, 4))
        self.assertAlmostEqual(m["covered"], 12.9)
        # Month stats are the same whatever range is on screen.
        self.assertEqual(self.spend("today")["month"], m)

    def test_unknown_period_falls_back_to_week(self):
        self.assertEqual(self.spend("decade")["period"], "week")

    def test_store_is_opened_read_only_and_left_untouched(self):
        before = hashlib.sha256(self.db.read_bytes()).hexdigest()
        self.spend("month")
        self.assertEqual(hashlib.sha256(self.db.read_bytes()).hexdigest(), before)
        self.assertFalse(Path(f"{self.db}-wal").exists())

    def test_store_without_per_call_table_uses_session_aggregates(self):
        conn = sqlite3.connect(self.db)
        conn.execute("DROP TABLE session_model_usage")
        conn.commit()
        conn.close()
        r = self.spend("today")
        real = {p["provider"]: p["cost"] for p in r["real"]["by_provider"]}
        self.assertEqual(real, {"deepseek": 6.0})  # no split possible on such stores

    def test_missing_or_broken_store_is_unavailable(self):
        self.assertFalse(plugin_api.compute_spend(Path(self.tmp.name) / "nope.db", "week", 0, now=NOW, auth={})["available"])
        broken = Path(self.tmp.name) / "broken.db"
        broken.write_bytes(b"not a database" * 100)
        self.assertFalse(plugin_api.compute_spend(broken, "week", 0, now=NOW, auth={})["available"])

    def test_empty_range_has_no_data(self):
        r = plugin_api.compute_spend(self.db, "today", OFFSET, now=NOW + 60 * DAY, auth=AUTH)
        self.assertTrue(r["available"])
        self.assertFalse(r["has_data"])
        self.assertEqual(r["top"], [])
        self.assertEqual(r["real"]["total"], 0)


class SpendRouteTest(SpendFixture):
    def test_route_reads_the_serving_profile_store(self):
        with patch.object(plugin_api, "get_hermes_home", return_value=Path(self.tmp.name)), \
             patch.object(plugin_api, "credential_auth_types", return_value=AUTH):
            got = asyncio.run(plugin_api.get_spend(period="month", utc_offset=OFFSET))
        self.assertTrue(got["available"])
        self.assertEqual(got["period"], "month")

    def test_other_profiles_resolve_through_the_host(self):
        def resolve(profile):  # sync in Hermes (hermes_cli.web_server_sessions)
            return Path(self.tmp.name) / "state.db"

        fake = {"hermes_cli.web_server_sessions": types.SimpleNamespace(_session_db_path_for_profile=resolve)}
        with patch.dict(sys.modules, fake):
            self.assertEqual(plugin_api.spend_db_path("work"), self.db)

    def test_profile_on_a_host_without_profile_stores_is_404(self):
        with patch.dict(sys.modules, {"hermes_cli.web_server_sessions": types.SimpleNamespace()}):
            with self.assertRaises(plugin_api.HTTPException) as caught:
                plugin_api.spend_db_path("work")
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
