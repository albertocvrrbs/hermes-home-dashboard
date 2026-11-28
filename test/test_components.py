import base64
import json
import tempfile
import types
import unittest
from pathlib import Path

from dashboard import plugin_api
from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit import components as comp_mod
from dashboard.boardkit import engine
from dashboard.boardkit.service import BoardService
from dashboard.boardkit.fetch import Fetcher

GOOD = ("<html><body><div id=c></div><script>hb.onData(function(d){render(d)});"
        "hb.onResize(function(s){render(hb.data)});function render(d){}</script></body></html>")


def offline_fetcher():
    def resolver(host, port):
        raise OSError("offline")
    return Fetcher(resolver=resolver, transport=lambda *a: (_ for _ in ()).throw(OSError("offline")))


class LibraryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.lib = comp_mod.Library(Path(self.tmp.name) / "components")

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_update_versions_and_noop(self):
        r = self.lib.save("spark", html=GOOD, title="Spark", note="first")
        self.assertEqual((r["version"], r["created"]), ("v1", True))
        r = self.lib.save("spark", html=GOOD + "<!--2-->")
        self.assertEqual(r["version"], "v2")
        again = self.lib.save("spark", html=GOOD + "<!--2-->")
        self.assertTrue(again["noop"])
        self.assertEqual(self.lib.meta("spark")["current"], "v2")
        self.assertEqual([v["v"] for v in self.lib.meta("spark")["versions"]], ["v1", "v2"])
        self.assertEqual(self.lib.files("spark", "v1")[1]["index.html"], GOOD)

    def test_edits_patch_current_and_must_match_once(self):
        self.lib.save("a", html="<p>one</p><p>two</p>")
        r = self.lib.save("a", edits=[{"find": "one", "replace": "uno"}])
        self.assertEqual(self.lib.files("a")[1]["index.html"], "<p>uno</p><p>two</p>")
        self.assertEqual(r["version"], "v2")
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", edits=[{"find": "zzz", "replace": "x"}])
        self.lib.save("a", html="<i>x</i><i>x</i>")
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", edits=[{"find": "x", "replace": "y"}])
        self.lib.save("a", edits=[{"find": "x", "replace": "y", "all": True}])
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("fresh", edits=[{"find": "x", "replace": "y"}])

    def test_rollback_copies_forward_and_diff(self):
        self.lib.save("a", html="<p>1</p>")
        self.lib.save("a", html="<p>2</p>")
        res = self.lib.rollback("a", "v1")
        self.assertEqual(res["version"], "v3")
        self.assertEqual(self.lib.files("a")[1]["index.html"], "<p>1</p>")
        d = self.lib.diff("a", "v1", "v2")
        self.assertIn("-<p>1</p>", d["diff"])
        self.assertIn("+<p>2</p>", d["diff"])
        self.assertTrue(self.lib.diff("a", "v1", "v3")["same"])

    def test_validation(self):
        for bad in ("../x", "A", "x" * 41, "", "a b"):
            with self.assertRaises(comp_mod.CompError):
                self.lib.save(bad, html="<p>")
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", files={"x.exe": "no"})
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", files={"../evil.js": "x"})
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", files={"app.js": "x"})  # no index.html
        with self.assertRaises(comp_mod.CompError):
            self.lib.save("a", html="x" * (comp_mod.MAX_FILE + 1))
        with self.assertRaises(comp_mod.CompNotFound):
            self.lib.files("nope")

    def test_assemble_inlines_local_scripts_and_styles(self):
        html = '<html><head><link rel="stylesheet" href="s.css"></head><body><script src="app.js"></script>' \
               '<script src="https://cdn.example/x.js"></script></body></html>'
        self.lib.save("a", files={"index.html": html, "app.js": "var a=1;</script>", "s.css": "p{color:red}",
                                   "sample.json": '{"v":[1,2]}'})
        out = self.lib.assemble("a")
        self.assertIn("var a=1;<\\/script>", out["html"])
        self.assertIn("<style>p{color:red}</style>", out["html"])
        self.assertIn('src="https://cdn.example/x.js"', out["html"])
        self.assertNotIn('src="app.js"', out["html"])
        self.assertEqual(out["sample"], {"v": [1, 2]})
        self.assertEqual(out["version"], "v1")

    def test_lint_flags_network_colors_and_missing_bridge(self):
        w = comp_mod.lint({"index.html": "<script>fetch('/x');var a='#ff0000#00ff00'</script>"})
        text = " ".join(w)
        self.assertIn("hb bridge", text)
        self.assertIn("network", text)
        self.assertIn("resize", text)
        self.assertEqual(comp_mod.lint({"index.html": GOOD}), [])
        raf = comp_mod.lint({"index.html": GOOD.replace("render(d)}", "render(d)};requestAnimationFrame(function(){})")})
        self.assertTrue(any("hb.clock" in x for x in raf))

    def test_cdata_limits_and_merge(self):
        self.assertEqual(comp_mod.clean_cdata({"a": {"b": [1, 2]}, "n": None}), {"a": {"b": [1, 2]}})
        with self.assertRaises(comp_mod.CompError):
            comp_mod.clean_cdata({"big": "x" * (comp_mod.MAX_CDATA + 1)})
        with self.assertRaises(comp_mod.CompError):
            comp_mod.clean_cdata({"f": float("nan")})
        out = comp_mod.merge_cdata({"s": [1, 2, 3], "k": 1}, patch={"k": None, "m": 2}, push={"s": [4, 5]}, keep=4)
        self.assertEqual(out, {"s": [2, 3, 4, 5], "m": 2})

    def test_data_files_roundtrip(self):
        n = self.lib.put_data_file("abcd1234", "0", "trace.json", b'{"a":1}')
        self.assertEqual(n, 7)
        size, data = self.lib.read_data_file("abcd1234", "0", "trace.json", 2, 3)
        self.assertEqual((size, data), (7, b'a"'[:0] + b'{"a":1}'[2:5]))
        with self.assertRaises(comp_mod.CompError):
            self.lib.put_data_file("abcd1234", "0", "../x", b"1")
        with self.assertRaises(comp_mod.CompNotFound):
            self.lib.read_data_file("abcd1234", "0", "nope.bin")


class EngineTest(unittest.TestCase):
    def doc(self):
        return engine.new_doc("abcd1234", "T", 0)

    def test_comp_item_data_op_and_sync(self):
        doc, _, refs = engine.apply_batch(self.doc(), [
            {"op": "add", "ref": "$c", "item": {"k": "comp", "comp": "spark", "cdata": {"a": [1]}, "at": 99, "x": 0, "y": 0}},
            {"op": "add", "ref": "$v", "item": {"k": "video", "src": "https://example.com/a.mp4", "x": 0, "y": 400}},
            {"op": "add", "ref": "$n", "item": {"k": "card", "text": "n", "x": 0, "y": 900}},
        ], "h")
        c, v, n = refs["$c"], refs["$v"], refs["$n"]
        self.assertNotEqual(doc["items"][c]["at"], 99)
        doc, _, _ = engine.apply_batch(doc, [{"op": "comp", "id": c, "push": {"a": [2, 3]}, "data": {"z": "q"}}], "s")
        self.assertEqual(doc["items"][c]["cdata"], {"a": [1, 2, 3], "z": "q"})
        doc, _, _, fwd = engine.apply_batch_ex(doc, [{"op": "sync", "ids": [c, v]}], "h")
        self.assertEqual(doc["items"][c]["sync"], "s1")
        self.assertEqual(doc["items"][v]["sync"], "s1")
        self.assertTrue(all(o["op"] == "set" for o in fwd))
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "sync", "ids": [n]}])
        doc, _, _ = engine.apply_batch(doc, [{"op": "sync", "ids": [c], "group": "run7"}])
        self.assertEqual(doc["items"][c]["sync"], "run7")
        doc, _, _ = engine.apply_batch(doc, [{"op": "unsync", "group": "s1"}])
        self.assertNotIn("sync", doc["items"][v])
        doc, inv, _ = engine.apply_batch(doc, [{"op": "unsync", "ids": [c]}])
        self.assertNotIn("sync", doc["items"][c])
        again, _, _ = engine.apply_batch(doc, inv)
        self.assertEqual(again["items"][c]["sync"], "run7")

    def test_comp_validation(self):
        for bad in ({"k": "comp"}, {"k": "comp", "comp": "Bad Name"}, {"k": "comp", "comp": "ok", "ver": "3"},
                    {"k": "comp", "comp": "ok", "files": {"../x": {"n": 1}}}, {"k": "comp", "comp": "ok", "actions": ["A b"]}):
            with self.assertRaises(engine.OpError):
                engine.apply_batch(self.doc(), [{"op": "add", "item": bad}])
        with self.assertRaises(engine.OpError):
            doc, _, refs = engine.apply_batch(self.doc(), [{"op": "add", "ref": "$c", "item": {"k": "card"}}])
            engine.apply_batch(doc, [{"op": "comp", "id": refs["$c"], "data": {"a": 1}}])


class ServiceAgentTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.svc = BoardService(Path(self.tmp.name) / "boards", fetcher=offline_fetcher())
        self.agent = agent_mod.BoardAgent(self.svc)

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, name, args, session="s1"):
        return json.loads(getattr(self.agent, name)(args, session_id=session))

    def test_tool_create_place_attach_and_update_touches_instances(self):
        r = self.call("board_component", {"action": "create", "name": "spark", "html": GOOD, "title": "Spark"})
        self.assertEqual(r["version"], "v1")
        self.assertEqual(r["warnings"], [])
        bid = self.call("board_read", {"board": "T", "create": True})["board"]
        warn = self.call("board_apply", {"board": bid, "ops": [{"op": "add", "item": {"k": "comp", "comp": "ghost"}}]})
        self.assertTrue(any("ghost" in w for w in warn["warnings"]))
        placed = self.call("board_component", {"action": "place", "name": "spark", "cdata": {"v": [1, 2]}})
        iid = placed["id"]
        item = self.svc.store.load(bid)["items"][iid]
        self.assertEqual(item["comp"], "spark")
        self.assertIsNone(placed["warnings"])
        res = self.call("board_component", {"action": "attach", "id": iid, "name": "trace.json", "json": {"w": [0.5] * 1000}})
        self.assertEqual(res["rev"], 1)
        self.assertEqual(self.svc.store.load(bid)["items"][iid]["files"]["trace.json"]["r"], 1)
        size, data = self.svc.comp_file(bid, iid, "trace.json")
        self.assertEqual(json.loads(data)["w"][0], 0.5)
        before = self.svc.store.load(bid)["items"][iid]["at"]
        up = self.call("board_component", {"action": "update", "name": "spark", "edits": [{"find": "render(d)}", "replace": "render(d||{})}"}]})
        self.assertEqual(up["version"], "v2")
        self.assertGreater(self.svc.store.load(bid)["items"][iid]["at"], before)
        rb = self.call("board_component", {"action": "rollback", "name": "spark", "to": "v1"})
        self.assertEqual(rb["version"], "v3")
        listing = self.call("board_component", {"action": "list"})
        self.assertEqual(listing["components"][0]["current"], "v3")
        self.assertIn("window.hb", self.call("board_component", {"action": "guide"})["guide"])
        self.assertIn("error", self.call("board_component", {"action": "delete", "name": "spark"}))
        self.assertEqual(self.call("board_component", {"action": "delete", "name": "spark", "confirm": True}), {"deleted": True})
        self.assertIn("error", self.call("board_component", {"action": "get", "name": "spark"}))

    def test_pinned_instances_are_not_touched(self):
        self.svc.comp_save("p", html=GOOD)
        bid = self.svc.store.create("B")["id"]
        doc, entry = self.svc.commit(bid, [{"op": "add", "item": {"k": "comp", "comp": "p", "ver": "v1"}}], "u")
        self.svc.comp_save("p", html=GOOD + "<!--x-->")
        item = next(iter(self.svc.store.load(bid)["items"].values()))
        self.assertNotIn("at", item)

    def test_comp_action_needs_card_listing_and_registry(self):
        from dashboard.boardkit import actions
        bid = self.svc.store.create("B")["id"]
        doc, entry = self.svc.commit(bid, [{"op": "add", "item": {"k": "comp", "comp": "p", "actions": ["ping"]}}], "u")
        iid = next(iter(doc["items"]))
        with self.assertRaises(actions.ActionError) as cm:
            self.svc.comp_action(bid, iid, "other")
        self.assertEqual(cm.exception.code, "not_on_card")
        with self.assertRaises(actions.ActionError) as cm:
            self.svc.comp_action(bid, iid, "ping")
        self.assertEqual(cm.exception.code, "unknown")  # on the card but never registered by the owner


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        svc_cls = plugin_api._boardkit("service").BoardService
        plugin_api._board_service = svc_cls(Path(self.tmp.name) / "boards")

    def tearDown(self):
        plugin_api._board_service = None
        self.tmp.cleanup()

    def test_routes(self):
        saved = plugin_api.save_component(plugin_api.CompSaveBody(name="spark", html=GOOD, title="S"))["result"]
        self.assertEqual(saved["version"], "v1")
        self.assertEqual(plugin_api.list_components()["components"][0]["name"], "spark")
        got = plugin_api.get_component("spark")
        self.assertEqual(got["version"], "v1")
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.get_component("nope")
        self.assertEqual(cm.exception.status_code, 404)
        bid = plugin_api.create_board(types.SimpleNamespace(name="B", parent=None))["board"]["id"]
        res = plugin_api.post_board_ops(bid, types.SimpleNamespace(ops=[{"op": "add", "item": {"k": "comp", "comp": "spark"}}], note=None))
        iid = next(iter(plugin_api.get_board(bid)["doc"]["items"]))
        r = plugin_api.post_comp_data(bid, iid, types.SimpleNamespace(data={"a": 1}, push={"s": [1]}, keep=None, replace=False))
        self.assertFalse(r["noop"])
        b64 = base64.b64encode(b"hello world").decode()
        plugin_api.put_comp_file(bid, iid, "w.bin", types.SimpleNamespace(data=b64, text=None, json_value=None))
        part = plugin_api.get_comp_file(bid, iid, "w.bin", 6, 5)
        self.assertEqual(base64.b64decode(part["data"]), b"world")
        self.assertEqual(part["size"], 11)
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.get_comp_file(bid, iid, "missing.bin")
        self.assertEqual(cm.exception.status_code, 404)
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.post_comp_action(bid, iid, types.SimpleNamespace(action="nope", args=None, confirm=False),
                                        types.SimpleNamespace(client=None))
        self.assertEqual(cm.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
