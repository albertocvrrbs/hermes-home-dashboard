import json
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit.service import BoardService
from dashboard.boardkit.fetch import Fetcher


def offline_fetcher():
    def resolver(host, port):
        raise OSError("offline")
    return Fetcher(resolver=resolver, transport=lambda *a: (_ for _ in ()).throw(OSError("offline")))


class AgentToolsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.svc = BoardService(Path(self.tmp.name), fetcher=offline_fetcher())
        self.agent = agent_mod.BoardAgent(self.svc, profile="default")

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, name, args, session="s1"):
        return json.loads(getattr(self.agent, name)(args, session_id=session))

    def test_create_then_batch_diagram_in_one_call(self):
        out = self.call("board_read", {"board": "Launch flow", "create": True})
        bid = out["board"]
        self.assertIn("created", out)
        res = self.call("board_apply", {"board": bid, "note": "Drew the flow", "ops": [
            {"op": "add", "ref": "$a", "item": {"k": "box", "x": 0, "y": 0, "num": "01", "title": "Record"}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 300, "y": 0, "num": "02", "title": "Thread"}},
            {"op": "add", "item": {"k": "line", "a": "$a", "b": "$b"}},
        ]})
        self.assertEqual(res["seq"], 1)
        self.assertEqual(set(res["ids"]), {"$a", "$b"})
        doc = self.svc.store.load(bid)
        self.assertEqual(len(doc["items"]), 3)
        self.assertTrue(all(it.get("by") == "h" for it in doc["items"].values()))
        self.assertEqual(doc["hermes"]["act"], "Drew the flow")
        self.assertEqual(doc["session"]["id"], "s1")
        entry = self.svc.store.entries(bid)[-1]
        self.assertEqual(entry["by"], "h")
        self.assertEqual(entry["note"], "Drew the flow")

    def test_tidy_and_insert_on_edge_through_board_apply(self):
        bid = self.call("board_read", {"board": "Flow", "create": True})["board"]
        res = self.call("board_apply", {"board": bid, "ops": [
            {"op": "add", "ref": "$a", "item": {"k": "box", "x": 5, "y": 5, "w": 200, "h": 62, "title": "Start"}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 260, "y": 5, "w": 200, "h": 62, "title": "End"}},
            {"op": "add", "ref": "$e", "item": {"k": "line", "a": "$a", "b": "$b"}},
        ]})
        edge = res["ids"]["$e"]
        res = self.call("board_apply", {"board": bid, "note": "Added a decision", "ops": [
            {"op": "insert_on_edge", "edge": edge, "ref": "$d", "item": {"k": "shape", "sh": "diamond", "title": "ok?"}}]})
        self.assertNotIn("error", res)
        doc = self.svc.store.load(bid)
        self.assertEqual(sum(1 for v in doc["items"].values() if v["k"] == "line"), 2)
        diamond = doc["items"][res["ids"]["$d"]]
        self.assertEqual((diamond["k"], diamond["sh"], diamond["by"]), ("shape", "diamond", "h"))
        res = self.call("board_apply", {"board": bid, "ops": [{"op": "tidy", "ids": [k for k, v in doc["items"].items() if v["k"] != "line"]}]})
        self.assertNotIn("error", res)
        doc = self.svc.store.load(bid)
        boxes = sorted((v["x"], v["y"]) for v in doc["items"].values() if v["k"] != "line")
        self.assertEqual(boxes[0][0] % 24, 0)               # the layout starts on the grid
        self.assertEqual(len({y for _, y in boxes}), 1)     # one reading row
        outline = self.call("board_read", {"board": bid, "full": True})
        self.assertIn("shape:diamond*", json.dumps(outline))

    def test_board_defaults_to_the_linked_session(self):
        bid = self.call("board_read", {"board": "Mine", "create": True})["board"]
        out = self.call("board_read", {})
        self.assertEqual(out["board"], bid)
        out = self.call("board_read", {}, session="other")
        self.assertIn("error", out)
        self.assertIn("Mine", json.dumps(out["boards"]))

    def test_read_returns_only_user_changes_since_last_seen(self):
        bid = self.call("board_read", {"board": "B", "create": True})["board"]
        self.call("board_apply", {"board": bid, "ops": [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "hermes card"}}]})
        self.svc.store.commit(bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 300, "text": "user idea"}}], by="u")
        out = self.call("board_read", {"board": bid})
        self.assertIn("user idea", out["changes"])
        self.assertNotIn("hermes card", out["changes"])
        again = self.call("board_read", {"board": bid})
        self.assertEqual(again.get("changes", ""), "")
        full = self.call("board_read", {"board": bid, "full": True})
        self.assertIn("hermes card", full["outline"])
        self.assertIn("user idea", full["outline"])

    def test_apply_errors_are_reported_not_raised(self):
        bid = self.call("board_read", {"board": "B", "create": True})["board"]
        out = self.call("board_apply", {"board": bid, "ops": [{"op": "set", "id": "zz", "p": {"x": 1}}]})
        self.assertIn("error", out)
        self.assertIn("no item zz", out["error"])

    def test_embed_html_becomes_asset_and_link_marked_waiting(self):
        bid = self.call("board_read", {"board": "B", "create": True})["board"]
        self.call("board_apply", {"board": bid, "ops": [
            {"op": "add", "item": {"k": "embed", "x": 0, "y": 0, "title": "chart", "html": "<h1>x</h1>"}},
            {"op": "add", "item": {"k": "link", "x": 0, "y": 400, "url": "https://youtu.be/dQw4w9WgXcQ"}},
            {"op": "add", "item": {"k": "link", "x": 0, "y": 800, "url": "https://ex.com/a.png"}},
        ]})
        items = self.svc.store.load(bid)["items"]
        self.assertTrue(items["0"]["asset"].endswith(".html"))
        self.assertEqual(items["1"]["video"], {"p": "youtube", "id": "dQw4w9WgXcQ"})
        self.assertIn(items["1"]["st"], ("wait", "ok", "fail"))
        self.assertEqual(items["2"]["k"], "image")

    def test_render_writes_png(self):
        try:
            import PIL  # noqa: F401
        except ImportError:
            self.skipTest("Pillow not installed")
        bid = self.call("board_read", {"board": "B", "create": True})["board"]
        self.svc.store.commit(bid, [{"op": "add", "item": {"k": "draw", "x": 10, "y": 10, "d": "0,0 50,40 90,0"}}], by="u")
        out = self.call("board_render", {"board": bid})
        self.assertTrue(Path(out["path"]).exists())


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.svc = BoardService(Path(self.tmp.name), fetcher=offline_fetcher())
        self.agent = agent_mod.BoardAgent(self.svc, profile="default")

    def tearDown(self):
        self.tmp.cleanup()

    def test_unlinked_sessions_get_nothing(self):
        self.assertIsNone(self.agent.pre_llm_call(session_id="x", user_message="hi", is_first_turn=True))

    def test_marker_links_session_and_points_to_tools(self):
        bid = self.svc.store.create("Launch")["id"]
        out = self.agent.pre_llm_call(session_id="s9", user_message=f"let's work on it [board:{bid}]", is_first_turn=True)
        self.assertIn(bid, out["context"])
        self.assertIn("board_read", out["context"])
        self.assertEqual(self.svc.store.board_for_session("s9"), bid)

    def test_reports_user_changes_once(self):
        bid = self.svc.store.create("Launch")["id"]
        self.svc.store.link_session(bid, "s1")
        self.assertIsNone(self.agent.pre_llm_call(session_id="s1", user_message="hi", is_first_turn=False))
        self.svc.store.commit(bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "pin it too"}}], by="u")
        out = self.agent.pre_llm_call(session_id="s1", user_message="what changed?", is_first_turn=False)
        self.assertIn('"pin it too"', out["context"])
        self.assertLessEqual(len(out["context"]), 1800)
        self.assertIsNone(self.agent.pre_llm_call(session_id="s1", user_message="again", is_first_turn=False))

    def test_multimodal_user_message_marker(self):
        bid = self.svc.store.create("Launch")["id"]
        msg = [{"type": "text", "text": f"[board:{bid}] go"}, {"type": "image_url", "image_url": {"url": "data:"}}]
        out = self.agent.pre_llm_call(session_id="s2", user_message=msg, is_first_turn=True)
        self.assertIsNotNone(out)

    def test_hook_never_raises(self):
        broken = agent_mod.BoardAgent(BoardService(Path("/proc/definitely/not/here")), profile="default")
        self.assertIsNone(broken.pre_llm_call(session_id="s", user_message="[board:aaaaaaaa]"))


class SchemaTest(unittest.TestCase):
    def test_schemas_are_compact_and_named(self):
        for name, schema in agent_mod.SCHEMAS.items():
            self.assertEqual(schema["name"], name)
            self.assertLess(len(json.dumps(schema)), 3200, name)


if __name__ == "__main__":
    unittest.main()
