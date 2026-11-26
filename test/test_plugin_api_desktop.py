import asyncio
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from dashboard import plugin_api

SERVICE_MODULES = ("status", "analytics", "cron", "sessions")


def _fake_services(system, analytics, cron, sessions):
    return {
        "hermes_cli.web_routers.status": types.SimpleNamespace(get_system_stats=system),
        "hermes_cli.web_routers.analytics": types.SimpleNamespace(get_usage_analytics=analytics),
        "hermes_cli.web_routers.cron": types.SimpleNamespace(list_cron_jobs=cron),
        "hermes_cli.web_routers.sessions": types.SimpleNamespace(get_sessions=sessions),
    }


class DesktopDataApiTest(unittest.IsolatedAsyncioTestCase):
    async def _assert_routes(self):
        self.assertEqual(await plugin_api.get_desktop_system(), {"hostname": "personal-computer"})
        self.assertEqual(
            await plugin_api.get_desktop_analytics(days=999, profile="default"),
            {"period_days": 365, "profile": "default"},
        )
        self.assertEqual(
            await plugin_api.get_desktop_cron(profile="default"),
            [{"id": "daily", "profile": "default"}],
        )
        self.assertEqual(
            await plugin_api.get_desktop_sessions(limit=9, offset=3, profile="default"),
            {"sessions": [], "limit": 9, "offset": 3, "order": "recent", "profile": "default"},
        )

    async def test_routes_match_the_real_host_signatures(self):
        # The fakes MUST mirror the real Hermes signatures (def vs async def):
        # get_system_stats and get_sessions are sync, the other two async.
        # An async fake for a sync service is a false green: that is how the
        # /system 500 ("object dict can't be used in 'await' expression")
        # shipped in 1.4.0.
        def system():
            return {"hostname": "personal-computer"}

        async def analytics(days=30, profile=None):
            return {"period_days": days, "profile": profile}

        async def cron(profile="all"):
            return [{"id": "daily", "profile": profile}]

        def sessions(**kwargs):
            return {"sessions": [], **kwargs}

        with patch.dict(sys.modules, _fake_services(system, analytics, cron, sessions)):
            await self._assert_routes()

    async def test_routes_tolerate_either_sync_or_async_services(self):
        async def system():
            return {"hostname": "personal-computer"}

        def analytics(days=30, profile=None):
            return {"period_days": days, "profile": profile}

        def cron(profile="all"):
            return [{"id": "daily", "profile": profile}]

        async def sessions(**kwargs):
            return {"sessions": [], **kwargs}

        with patch.dict(sys.modules, _fake_services(system, analytics, cron, sessions)):
            await self._assert_routes()

    async def test_pre_split_host_falls_back_to_the_web_server_facade(self):
        def system():
            return {"hostname": "personal-computer"}

        async def analytics(days=30, profile=None):
            return {"period_days": days, "profile": profile}

        async def cron(profile="all"):
            return [{"id": "daily", "profile": profile}]

        def sessions(**kwargs):
            return {"sessions": [], **kwargs}

        legacy: dict[str, object] = {
            "hermes_cli.web_server": types.SimpleNamespace(
                get_system_stats=system,
                get_usage_analytics=analytics,
                list_cron_jobs=cron,
                get_sessions=sessions,
            )
        }
        # ``None`` in sys.modules makes the import raise ModuleNotFoundError
        # for exactly that module, modelling a host without web_routers.
        for name in SERVICE_MODULES:
            legacy[f"hermes_cli.web_routers.{name}"] = None
        with patch.dict(sys.modules, legacy):
            await self._assert_routes()

    async def test_missing_dependency_is_not_mistaken_for_an_old_host(self):
        failure = ModuleNotFoundError("missing host dependency", name="host_dependency")
        with patch.object(plugin_api.importlib, "import_module", side_effect=failure) as load:
            with self.assertRaises(ModuleNotFoundError) as caught:
                await plugin_api.get_desktop_system()
        self.assertIs(caught.exception, failure)
        load.assert_called_once_with("hermes_cli.web_routers.status")


class LayoutValidationTest(unittest.TestCase):
    @staticmethod
    def _layout(*widgets):
        return {"version": 1, "widgets": list(widgets)}

    def test_accepts_a_normal_layout(self):
        self.assertTrue(
            plugin_api._valid_layout(
                self._layout(
                    {"id": "clock", "gx": 0, "gy": 0, "gw": 3, "gh": 2},
                    {"id": "tokens", "gx": 9, "gy": 40, "gw": 3, "gh": 30},
                )
            )
        )

    def test_rejects_out_of_range_geometry(self):
        for bad in (
            {"id": "x", "gx": 10**9, "gy": 0, "gw": 3, "gh": 2},  # far outside the grid
            {"id": "x", "gx": 10, "gy": 0, "gw": 3, "gh": 2},  # overflows column 12
            {"id": "x", "gx": 0, "gy": 0, "gw": 99, "gh": 2},  # wider than the grid
            {"id": "x", "gx": 0, "gy": -1, "gw": 3, "gh": 2},  # negative row
            {"id": "x", "gx": 0, "gy": 0, "gw": 0, "gh": 2},  # zero width
            {"id": "x", "gx": 0, "gy": 0, "gw": 3, "gh": 0},  # zero height
            {"id": "x", "gx": 0, "gy": 0, "gw": True, "gh": 2},  # bool is not a size
        ):
            self.assertFalse(plugin_api._valid_layout(self._layout(bad)), bad)

    def test_rejects_too_many_widgets(self):
        widgets = [
            {"id": f"w{i}", "gx": 0, "gy": i, "gw": 3, "gh": 2}
            for i in range(plugin_api._MAX_WIDGETS + 1)
        ]
        self.assertFalse(plugin_api._valid_layout(self._layout(*widgets)))

    def test_saved_layout_round_trips_through_get_layout(self):
        layout = self._layout({"id": "ascii", "gx": 0, "gy": 0, "gw": 3, "gh": 6, "props": {"artIndex": 1}})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "layout.json"
            path.write_text(json.dumps(layout), encoding="utf-8")
            with patch.object(plugin_api, "LAYOUT_FILE", path):
                self.assertEqual(asyncio.run(plugin_api.get_layout()), {"layout": layout})


class PackageRootTest(unittest.TestCase):
    def test_root_package_exposes_a_register_hook(self):
        # The Hermes agent plugin loader refuses a directory plugin without a
        # root __init__.py exposing register(ctx) (issues #5 and #6).
        root = Path(__file__).resolve().parents[1]
        namespace: dict = {}
        exec(compile((root / "__init__.py").read_text("utf-8"), "__init__.py", "exec"), namespace)
        self.assertTrue(callable(namespace.get("register")))
        self.assertIsNone(namespace["register"](object()))


if __name__ == "__main__":
    unittest.main()
