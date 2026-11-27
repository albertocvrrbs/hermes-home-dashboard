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


class ModelsRouteTest(unittest.IsolatedAsyncioTestCase):
    async def test_models_adapts_the_host_models_analytics(self):
        def models(days=30, profile=None):  # sync in Hermes (runs on a thread)
            return {"models": [{"model": "m", "provider": "p"}], "period_days": days, "profile": profile}

        fake = {"hermes_cli.web_routers.analytics": types.SimpleNamespace(get_models_analytics=models)}
        with patch.dict(sys.modules, fake):
            got = await plugin_api.get_desktop_models(days=999, profile="default")
        self.assertEqual(got["period_days"], 365)
        self.assertEqual(got["models"][0]["provider"], "p")

    async def test_models_is_404_on_a_host_without_it(self):
        fake = {"hermes_cli.web_routers.analytics": types.SimpleNamespace()}
        with patch.dict(sys.modules, fake):
            with self.assertRaises(plugin_api.HTTPException) as caught:
                await plugin_api.get_desktop_models(days=7)
        self.assertEqual(caught.exception.status_code, 404)


class ProjectsScanTest(unittest.TestCase):
    def _write(self, root: Path, name: str, body) -> Path:
        d = root / name
        d.mkdir(parents=True, exist_ok=True)
        path = d / "status.json"
        path.write_text(body if isinstance(body, str) else json.dumps(body), encoding="utf-8")
        return path

    def test_reads_and_normalizes_status_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write(root, "wiki", {
                "project": "Wiki-Ingest", "status": "active", "lastUpdated": "2026-10-04T21:30:00+08:00",
                "stats": {"inbox": 2, "inProgress": 1, "completed": 15},
                "alerts": ["disk low", 42, None], "nextAction": "Process pending articles",
                "secret": "not echoed",
            })
            self._write(root, "Alpha", {"stats": {"inbox": "x", "completed": -3, "inProgress": True}})
            (root / "no-status").mkdir()
            got = plugin_api.scan_projects(root)
        self.assertEqual([p["id"] for p in got], ["Alpha", "wiki"])  # case-insensitive name order
        alpha, wiki = got
        self.assertEqual(alpha["project"], "Alpha")
        self.assertEqual(alpha["status"], "unknown")
        self.assertEqual(alpha["stats"], {"inbox": 0, "inProgress": 0, "completed": 0})
        self.assertEqual(wiki["stats"], {"inbox": 2, "inProgress": 1, "completed": 15})
        self.assertEqual(wiki["alerts"], ["disk low", "42"])
        self.assertNotIn("secret", wiki)

    def test_ignores_bad_json_non_objects_and_oversized_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write(root, "broken", "{not json")
            self._write(root, "list", [1, 2, 3])
            self._write(root, "huge", {"project": "x" * (plugin_api._MAX_STATUS_BYTES + 10)})
            self._write(root, "deep", "[" * 100_000 + "]" * 100_000)
            self._write(root, "ok", {"project": "fine"})
            got = plugin_api.scan_projects(root)
        self.assertEqual([p["id"] for p in got], ["ok"])

    def test_skips_symlinks_that_escape_the_projects_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            outside = Path(tmp) / "outside"
            self._write(outside, "leak", {"project": "leaked"})
            root = Path(tmp) / "projects"
            root.mkdir()
            (root / "linked-dir").symlink_to(outside / "leak", target_is_directory=True)
            (root / "linked-file").mkdir()
            (root / "linked-file" / "status.json").symlink_to(outside / "leak" / "status.json")
            got = plugin_api.scan_projects(root)
        self.assertEqual(got, [])

    def test_missing_dir_is_an_empty_board(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(plugin_api.scan_projects(Path(tmp) / "nope"), [])

    def test_scan_is_bounded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for i in range(plugin_api._MAX_PROJECTS + 5):
                self._write(root, f"p{i:03d}", {"project": f"p{i}"})
            self.assertEqual(len(plugin_api.scan_projects(root)), plugin_api._MAX_PROJECTS)

    def test_dir_is_configurable_and_defaults_to_home_projects(self):
        with patch.dict(plugin_api.os.environ, {plugin_api.PROJECTS_DIR_ENV: "~/somewhere"}):
            self.assertEqual(plugin_api.projects_dir(), Path("~/somewhere").expanduser())
        with patch.dict(plugin_api.os.environ, {plugin_api.PROJECTS_DIR_ENV: ""}):
            self.assertEqual(plugin_api.projects_dir(), Path.home() / "projects")

    def test_route_wraps_the_scan(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._write(Path(tmp), "x", {"project": "X"})
            with patch.dict(plugin_api.os.environ, {plugin_api.PROJECTS_DIR_ENV: tmp}):
                got = asyncio.run(plugin_api.get_projects())
        self.assertEqual([p["project"] for p in got["projects"]], ["X"])


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
    def test_root_package_registers_board_tools_and_hook(self):
        # The Hermes agent plugin loader imports the root __init__.py as a package
        # (issues #5 and #6) and calls register(ctx). Boards register three tools
        # in their own toolset plus the pre_llm_call hook.
        import importlib.util
        import os
        import sys
        root = Path(__file__).resolve().parents[1]
        parent = types.ModuleType("hermes_plugins_test")
        parent.__path__ = []
        sys.modules.setdefault("hermes_plugins_test", parent)
        name = "hermes_plugins_test.home_dashboard"
        spec = importlib.util.spec_from_file_location(name, root / "__init__.py",
                                                      submodule_search_locations=[str(root)])
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)

        class Ctx:
            profile_name = "default"
            def __init__(self):
                self.tools, self.hooks = {}, {}
            def register_tool(self, name, toolset, schema, handler, description=""):
                self.tools[name] = (toolset, schema, handler)
            def register_hook(self, name, fn):
                self.hooks[name] = fn

        ctx = Ctx()
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {"HERMES_HOME": tmp}):
            self.assertIsNone(module.register(ctx))
        self.assertEqual(sorted(ctx.tools), ["board_apply", "board_read", "board_render"])
        self.assertEqual({t[0] for t in ctx.tools.values()}, {"board"})
        self.assertIn("pre_llm_call", ctx.hooks)


if __name__ == "__main__":
    unittest.main()
