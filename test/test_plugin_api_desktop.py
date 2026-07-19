import sys
import types
import unittest
from unittest.mock import patch

from dashboard import plugin_api


class DesktopDataApiTest(unittest.IsolatedAsyncioTestCase):
    async def test_desktop_data_routes_delegate_to_current_hermes_services(self):
        async def system():
            return {"hostname": "personal-computer"}

        async def analytics(days=30, profile=None):
            return {"period_days": days, "profile": profile}

        async def cron(profile="all"):
            return [{"id": "daily", "profile": profile}]

        def sessions(**kwargs):
            return {"sessions": [], **kwargs}

        fake = types.SimpleNamespace(
            get_system_stats=system,
            get_usage_analytics=analytics,
            list_cron_jobs=cron,
            get_sessions=sessions,
        )

        with patch.dict(sys.modules, {"hermes_cli.web_server": fake}):
            self.assertEqual(await plugin_api.get_desktop_system(), {"hostname": "personal-computer"})
            self.assertEqual(
                await plugin_api.get_desktop_analytics(days=7, profile="default"),
                {"period_days": 7, "profile": "default"},
            )
            self.assertEqual(
                await plugin_api.get_desktop_cron(profile="default"),
                [{"id": "daily", "profile": "default"}],
            )
            self.assertEqual(
                await plugin_api.get_desktop_sessions(limit=9, offset=3, profile="default"),
                {
                    "sessions": [],
                    "limit": 9,
                    "offset": 3,
                    "order": "recent",
                    "profile": "default",
                },
            )


if __name__ == "__main__":
    unittest.main()
