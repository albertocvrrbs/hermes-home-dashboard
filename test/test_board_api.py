import base64
import tempfile
import types
import unittest
from pathlib import Path

from dashboard import plugin_api

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def body(**kw):
    return types.SimpleNamespace(**kw)


class BoardApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        svc_cls = plugin_api._boardkit("service").BoardService
        plugin_api._board_service = svc_cls(Path(self.tmp.name))

    def tearDown(self):
        plugin_api._board_service = None
        self.tmp.cleanup()

    def test_create_list_ops_since_undo(self):
        bid = plugin_api.create_board(body(name="Launch", parent=None))["board"]["id"]
        self.assertEqual([b["name"] for b in plugin_api.list_boards()["boards"]], ["Launch"])
        res = plugin_api.post_board_ops(bid, body(ops=[{"op": "add", "ref": "$n", "item": {"k": "card", "x": 1, "y": 2, "text": "a"}}], note=None))
        self.assertEqual(res["seq"], 1)
        self.assertEqual(res["entry"]["ids"], {"$n": "0"})
        self.assertNotIn("inv", res["entry"])
        self.assertEqual(plugin_api.get_board(bid, since=1), {"seq": 1})
        self.assertEqual(len(plugin_api.get_board(bid, since=0)["entries"]), 1)
        self.assertIn("doc", plugin_api.get_board(bid))
        undone = plugin_api.undo_board_entry(bid, body(s=1))
        self.assertEqual(undone["seq"], 2)
        self.assertEqual(plugin_api.get_board(bid)["doc"]["items"], {})

    def test_errors_map_to_http(self):
        for bad in ("../../x", "nope", "AAAAAAAA"):
            with self.assertRaises(plugin_api.HTTPException) as cm:
                plugin_api.get_board(bad)
            self.assertEqual(cm.exception.status_code, 404)
        bid = plugin_api.create_board(body(name="B", parent=None))["board"]["id"]
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.post_board_ops(bid, body(ops=[{"op": "add", "item": {"k": "evil"}}], note=None))
        self.assertEqual(cm.exception.status_code, 400)

    def test_assets_upload_and_read_back(self):
        out = plugin_api.upload_board_asset(body(data=base64.b64encode(PNG).decode(), html=None))
        self.assertEqual((out["iw"], out["ih"]), (1, 1))
        got = plugin_api.get_board_asset(out["asset"])
        self.assertEqual(base64.b64decode(got["data"]), PNG)
        html = plugin_api.upload_board_asset(body(data=None, html="<b>x</b>"))["asset"]
        self.assertEqual(plugin_api.get_board_asset(html)["text"], "<b>x</b>")
        for bad in ("../../../etc/passwd", "0123456789abcdef.svg"):
            with self.assertRaises(plugin_api.HTTPException) as cm:
                plugin_api.get_board_asset(bad)
            self.assertEqual(cm.exception.status_code, 400)
        with self.assertRaises(plugin_api.HTTPException):
            plugin_api.upload_board_asset(body(data=base64.b64encode(b"<svg onload=alert(1)>").decode(), html=None))

    def test_delete(self):
        bid = plugin_api.create_board(body(name="B", parent=None))["board"]["id"]
        self.assertEqual(plugin_api.delete_board(bid), {"ok": True})
        self.assertEqual(plugin_api.list_boards()["boards"], [])

    def test_layout_with_removed_widget_ids_still_validates(self):
        layout = {"version": 1, "widgets": [{"id": "agent", "gx": 0, "gy": 0, "gw": 4, "gh": 3},
                                            {"id": "board", "gx": 4, "gy": 0, "gw": 4, "gh": 4}]}
        self.assertTrue(plugin_api._valid_layout(layout))


if __name__ == "__main__":
    unittest.main()
