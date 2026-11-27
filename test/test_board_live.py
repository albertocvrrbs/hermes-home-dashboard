import base64
import json
import shutil
import subprocess
import tempfile
import types
import unittest
from pathlib import Path

from dashboard import plugin_api
from dashboard.boardkit import actions, engine, live, posters, summary
from dashboard.boardkit.service import BoardService


def body(**kw):
    return types.SimpleNamespace(**kw)


def blank():
    return engine.new_doc("k3x9p2qa", "Runs", now=1000)


TRAINING = {"k": "live", "x": 0, "y": 0, "w": 380, "title": "Spider", "tpl": "training", "ttl": 120,
            "actions": [{"action": "demo.stop", "label": "Stop", "args": {"run": "$run"}}],
            "data": {"name": "Spider v9", "status": "running", "run": "v9", "success": 81.4}}


class LiveSpecTest(unittest.TestCase):
    def test_training_template_expands_and_stamps_freshness(self):
        doc, _, refs = engine.apply_batch(blank(), [{"op": "add", "ref": "$l", "item": TRAINING}], by="h")
        it = doc["items"][refs["$l"]]
        kinds = [b["t"] for b in it["blocks"]]
        self.assertEqual(kinds, ["header", "progress", "metrics", "spark", "media", "text", "actions"])
        self.assertEqual(it["blocks"][-1]["items"], [{"action": "demo.stop", "label": "Stop", "args": {"run": "$run"}}])
        self.assertIsInstance(it["at"], int)
        self.assertEqual(live.status_of(it), "running")
        self.assertIn("status:running", summary.item_line(refs["$l"], it))

    def test_live_op_merges_pushes_and_deletes(self):
        doc, _, refs = engine.apply_batch(blank(), [{"op": "add", "ref": "$l", "item": TRAINING}])
        iid = refs["$l"]
        ops = [{"op": "live", "id": iid, "data": {"success": 82.0, "run": None}, "push": {"success_hist": [80, 81, 82]}}]
        doc2, inv, _, fwd = engine.apply_batch_ex(doc, ops, now=5000)
        data = doc2["items"][iid]["data"]
        self.assertEqual(data["success"], 82)
        self.assertNotIn("run", data)
        self.assertEqual(data["success_hist"], [80, 81, 82])
        self.assertEqual(doc2["items"][iid]["at"], 5000)
        # normalised to a plain set, so clients replay it with no special case
        self.assertEqual(fwd, [{"op": "set", "id": iid, "p": {"data": data, "at": 5000}}])
        back, _, _ = engine.apply_batch(doc2, inv)
        self.assertEqual(back["items"][iid]["data"], doc["items"][iid]["data"])
        # keep trims series
        doc3, _, _ = engine.apply_batch(doc2, [{"op": "live", "id": iid, "push": {"success_hist": list(range(10))}, "keep": 4}])
        self.assertEqual(doc3["items"][iid]["data"]["success_hist"], [6, 7, 8, 9])

    def test_cards_can_never_carry_commands(self):
        for bad in ({"action": "x.stop", "command": ["/bin/rm", "-rf", "/"]},
                    {"action": "x.stop", "http": {"url": "http://evil"}},
                    {"action": "rm -rf /"}, {"action": "$(reboot)"}):
            item = dict(TRAINING, actions=[bad])
            with self.assertRaises(engine.OpError):
                engine.apply_batch(blank(), [{"op": "add", "item": item}])

    def test_bad_data_and_blocks_are_refused(self):
        for item in ({"k": "live", "blocks": [{"t": "chart3d"}]},
                     {"k": "live", "blocks": []},
                     {"k": "live", "tpl": "nope"},
                     {"k": "live", "tpl": "job", "data": {"bad key": 1}},
                     {"k": "live", "tpl": "job", "data": {"x": [1, "a"]}},
                     {"k": "live", "tpl": "job", "data": {"x": {"nested": 1}}}):
            with self.assertRaises(engine.OpError, msg=item):
                engine.apply_batch(blank(), [{"op": "add", "item": item}])
        doc, _, refs = engine.apply_batch(blank(), [{"op": "add", "ref": "$c", "item": {"k": "card", "text": "x"}}])
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "live", "id": refs["$c"], "data": {"a": 1}}])

    def test_binding_rules(self):
        self.assertTrue(live.is_binding("$success"))
        self.assertFalse(live.is_binding("$$literal"))
        self.assertFalse(live.is_binding("$bad key"))
        self.assertEqual(live.bound_args({"args": {"run": "$run", "n": 2}}, {"run": "v9"}), {"run": "v9", "n": 2})


class ActionsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "live-actions").mkdir()
        self.reg = actions.Registry(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, entries):
        (self.root / "live-actions" / "test.json").write_text(json.dumps({"actions": entries}))

    def test_registry_validation(self):
        self.write([
            {"id": "ok.echo", "command": ["/bin/echo", "hi", "{who}"], "args": {"who": {"type": "string", "default": "you"}}},
            {"id": "bad.shell", "command": "rm -rf / ; echo"},
            {"id": "bad.rel", "command": ["echo", "x"]},
            {"id": "bad.ph", "command": ["/bin/echo", "{nope}"]},
            {"id": "Bad Id", "command": ["/bin/true"]},
            {"id": "bad.both", "command": ["/bin/true"], "http": {"url": "http://x"}},
        ])
        acts, problems = self.reg.load()
        self.assertEqual(list(acts), ["ok.echo"])
        self.assertEqual(len(problems), 5)
        pub = self.reg.list_public()["actions"][0]
        self.assertNotIn("command", pub)
        self.assertNotIn("pattern", pub["args"]["who"])

    def test_invoke_runs_argv_without_a_shell_and_logs(self):
        self.write([{"id": "ok.echo", "command": ["/bin/echo", "hi", "{who}"],
                     "args": {"who": {"type": "string", "default": "you"}}}])
        res = self.reg.invoke("ok.echo", {"who": "alberto"}, who="test")
        self.assertTrue(res["ok"])
        self.assertEqual(res["out"], "hi alberto")
        # shell metacharacters and option injection never reach argv
        for evil in ("x; rm -rf /", "$(id)", "-rf", "a b", "`id`"):
            with self.assertRaises(actions.ActionError) as cm:
                self.reg.invoke("ok.echo", {"who": evil})
            self.assertEqual(cm.exception.code, "bad_args")
        with self.assertRaises(actions.ActionError):
            self.reg.invoke("ok.echo", {"other": "x"})
        with self.assertRaises(actions.ActionError) as cm:
            self.reg.invoke("not.there")
        self.assertEqual(cm.exception.code, "unknown")
        hist = self.reg.history()
        self.assertEqual(hist[0]["who"], "test")
        self.assertTrue(hist[0]["ok"])
        self.assertEqual(sum(1 for h in hist if h.get("refused")), 7)

    def test_destructive_needs_confirm_and_disabled_never_runs(self):
        marker = self.root / "ran"
        self.write([
            {"id": "x.stop", "command": ["/usr/bin/touch", str(marker)], "destructive": True},
            {"id": "x.off", "command": ["/usr/bin/touch", str(marker)], "enabled": False},
        ])
        with self.assertRaises(actions.ActionError) as cm:
            self.reg.invoke("x.stop")
        self.assertEqual(cm.exception.code, "confirm")
        with self.assertRaises(actions.ActionError) as cm:
            self.reg.invoke("x.off", confirm=True)
        self.assertEqual(cm.exception.code, "disabled")
        self.assertFalse(marker.exists())
        self.assertTrue(self.reg.invoke("x.stop", confirm=True)["ok"])
        self.assertTrue(marker.exists())

    def test_timeout_and_failure(self):
        self.write([{"id": "x.slow", "command": ["/bin/sleep", "5"], "timeout": 1},
                    {"id": "x.fail", "command": ["/bin/false"]}])
        r = self.reg.invoke("x.slow")
        self.assertFalse(r["ok"])
        self.assertEqual(r["code"], "timeout")
        self.assertEqual(self.reg.invoke("x.fail")["code"], 1)

    def test_python_registration(self):
        seen = []
        actions.register({"id": "py.ping", "args": {"n": {"type": "int", "min": 1, "max": 3}}},
                         lambda args: seen.append(args) or "pong")
        try:
            self.assertEqual(self.reg.invoke("py.ping", {"n": 2})["out"], "pong")
            self.assertEqual(seen, [{"n": 2}])
            with self.assertRaises(actions.ActionError):
                self.reg.invoke("py.ping", {"n": 9})
        finally:
            actions.unregister("py.ping")


class LiveApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name) / "boards"
        # the API maps errors by the classes of the module it loads by path
        plugin_api._board_service = plugin_api._boardkit("service").BoardService(root)
        self.svc = plugin_api._board_service
        (root.parent / "live-actions").mkdir(parents=True)
        (root.parent / "live-actions" / "demo.json").write_text(json.dumps({"actions": [
            {"id": "demo.stop", "label": "Stop", "destructive": True, "command": ["/bin/echo", "stopping", "{run}"],
             "args": {"run": {"type": "string", "pattern": "^v[0-9]{1,3}$"}}}]}))
        self.bid = plugin_api.create_board(body(name="Runs", parent=None))["board"]["id"]
        res = plugin_api.post_board_ops(self.bid, body(ops=[{"op": "add", "ref": "$l", "item": TRAINING}], note=None))
        self.iid = res["entry"]["ids"]["$l"]

    def tearDown(self):
        plugin_api._board_service = None
        self.tmp.cleanup()

    def test_data_route_is_a_system_write(self):
        out = plugin_api.post_live_data(self.bid, self.iid, body(data={"success": 90}, push={"success_hist": 90}, keep=None, replace=False))
        self.assertEqual(out["seq"], 2)
        entry = self.svc.store.entries(self.bid)[-1]
        self.assertEqual(entry["by"], "s")
        # the user's change summary (what Hermes hears) ignores it
        doc = self.svc.store.load(self.bid)
        self.assertEqual(summary.changes_since(doc, self.svc.store.entries(self.bid), 1), "")

    def test_action_route_takes_args_from_the_card(self):
        req = types.SimpleNamespace(client=types.SimpleNamespace(host="127.0.0.1"))
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.post_live_action(self.bid, self.iid, body(action="demo.stop", index=0, confirm=False), req)
        self.assertEqual(cm.exception.status_code, 428)
        res = plugin_api.post_live_action(self.bid, self.iid, body(action="demo.stop", index=0, confirm=True), req)
        self.assertEqual(res["result"]["out"], "stopping v9")
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.post_live_action(self.bid, self.iid, body(action="other.id", index=None, confirm=True), req)
        self.assertEqual(cm.exception.status_code, 404)
        # a data writer can't smuggle a bad arg through a binding
        plugin_api.post_live_data(self.bid, self.iid, body(data={"run": "v9; reboot"}, push=None, keep=None, replace=False))
        with self.assertRaises(plugin_api.HTTPException) as cm:
            plugin_api.post_live_action(self.bid, self.iid, body(action="demo.stop", index=0, confirm=True), req)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertEqual(self.svc.actions.history()[-1]["who"], "dashboard 127.0.0.1")
        listed = plugin_api.list_live_actions()
        self.assertEqual([a["id"] for a in listed["actions"]], ["demo.stop"])


class LiveAgentTest(unittest.TestCase):
    def setUp(self):
        from dashboard.boardkit.agent import BoardAgent
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name) / "boards"
        self.agent = BoardAgent(BoardService(root))
        (root.parent / "live-actions").mkdir(parents=True)
        (root.parent / "live-actions" / "a.json").write_text(json.dumps({"actions": [
            {"id": "job.stop", "label": "Stop", "destructive": True, "command": ["/bin/true"]}]}))

    def tearDown(self):
        self.tmp.cleanup()

    def test_agent_creates_and_updates_a_live_card(self):
        listed = json.loads(self.agent.board_read({"actions": True}))
        self.assertEqual(listed["live_actions"]["actions"][0]["id"], "job.stop")
        self.assertNotIn("command", json.dumps(listed))
        out = json.loads(self.agent.board_apply({"board": "Jobs", "create": True, "ops": [
            {"op": "add", "ref": "$l", "item": {"k": "live", "tpl": "job", "actions": ["job.stop"],
                                                 "data": {"name": "Export", "status": "running", "progress": 0.1}}}]}))
        iid = out["ids"]["$l"]
        out2 = json.loads(self.agent.board_apply({"board": "Jobs", "ops": [
            {"op": "live", "id": iid, "data": {"progress": 0.5, "status": "done"}}]}))
        self.assertNotIn("error", out2)
        read = json.loads(self.agent.board_read({"board": "Jobs", "full": True}))
        self.assertIn("status:done", read["outline"])
        self.assertIn("actions:job.stop", read["outline"])


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "needs ffmpeg")
class PosterTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.clip = self.root / "clip.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=3",
                        "-pix_fmt", "yuv420p", str(self.clip)], check=True)
        self.svc = BoardService(self.root / "boards")

    def tearDown(self):
        self.tmp.cleanup()

    def test_chunked_upload_makes_a_poster(self):
        data = self.clip.read_bytes()
        half = len(data) // 2
        parts = [data[:half], data[half:]]
        up = "0123456789abcdef"
        r0 = self.svc.upload_video_chunk(up, 0, 2, base64.b64encode(parts[0]).decode())
        self.assertEqual(r0, {"next": 1})
        r1 = self.svc.upload_video_chunk(up, 1, 2, base64.b64encode(parts[1]).decode())
        self.assertTrue(r1["asset"].endswith(".mp4"))
        self.assertEqual(r1["st"], "ok")
        self.assertAlmostEqual(r1["dur"], 3.0, delta=0.2)
        self.assertEqual((r1["iw"], r1["ih"]), (320, 180))
        mime, img = self.svc.assets.get(r1["img"])
        self.assertEqual(mime, "image/jpeg")
        # range reads stitch back to the file
        mime, total, chunk = self.svc.assets.read_range(r1["asset"], 0, 10**9)
        self.assertEqual((mime, total), ("video/mp4", len(data)))
        self.assertEqual(chunk, data)

    def test_url_poster_is_cached_beside_the_assets_without_touching_boards(self):
        clip = self.clip.read_bytes()

        class FakeFetcher:
            calls = 0

            def get(self, url, want="html", max_bytes=None):
                FakeFetcher.calls += 1
                return types.SimpleNamespace(body=clip, ctype="video/mp4", url=url, status=200)

        self.svc.posters.fetcher_factory = FakeFetcher
        url = "https://example.com/run.mp4"
        p1 = self.svc.poster(src=url)
        p2 = self.svc.poster(src=url)
        self.assertEqual(p1["st"], "ok")
        self.assertEqual(p1, p2)
        self.assertEqual(FakeFetcher.calls, 1)
        self.assertTrue((self.root / "boards" / "posters").is_dir())
        self.assertEqual(self.svc.store.list(), [])

    def test_rejects_non_video_and_client_fallback(self):
        with self.assertRaises(Exception):
            self.svc.upload_video_chunk("0123456789abcdef", 0, 1, base64.b64encode(b"not a video at all").decode())
        p = posters.Posters(self.root / "b2", self.svc.assets, ffmpeg="")
        self.assertEqual(p.get(src="https://example.com/x.mp4")["reason"], "no-ffmpeg")
        jpg = subprocess.run(["ffmpeg", "-v", "error", "-i", str(self.clip), "-frames:v", "1", "-f", "image2pipe",
                              "-vcodec", "mjpeg", "pipe:1"], capture_output=True).stdout
        out = p.put_client("https://example.com/x.mp4", None, base64.b64encode(jpg).decode(), dur=3)
        self.assertEqual((out["st"], out["by"], out["dur"]), ("ok", "client", 3.0))

    def test_pick_time(self):
        self.assertEqual(posters.pick_time(None), 1.0)
        self.assertEqual(posters.pick_time(3), 0.3)
        self.assertEqual(posters.pick_time(120), 1.0)


if __name__ == "__main__":
    unittest.main()
