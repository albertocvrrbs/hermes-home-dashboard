import json
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit import engine
from dashboard.boardkit.service import BoardService


def board():
    doc = engine.new_doc("k3x9p2qa", "Launch", now=1000)
    doc, _, ids = engine.apply_batch(doc, [
        {"op": "add", "ref": "$b", "item": {"k": "frame", "x": 800, "y": 0, "w": 400, "h": 300, "title": "Right"}},
        {"op": "add", "ref": "$a", "item": {"k": "frame", "x": 0, "y": 0, "w": 400, "h": 300, "title": "Left"}},
        {"op": "add", "ref": "$c", "item": {"k": "frame", "x": 0, "y": 600, "w": 400, "h": 300, "title": "Below"}},
        {"op": "add", "ref": "$n", "item": {"k": "card", "x": 50, "y": 50, "text": "hi"}},
        {"op": "add", "ref": "$s", "item": {"k": "board", "x": 900, "y": 700, "ref": "abcdefgh"}},
        {"op": "add", "ref": "$l", "item": {"k": "line", "a": "$a", "b": "$b"}},
    ])
    return doc, ids


class TourOpTest(unittest.TestCase):
    def test_from_frames_in_reading_order(self):
        doc, ids = board()
        doc, inv, _, fwd = engine.apply_batch_ex(doc, [{"op": "tour", "from": "frames", "dw": 3, "loop": True}])
        stops = doc["tour"]["stops"]
        self.assertEqual([s["id"] for s in stops], [ids["$a"], ids["$b"], ids["$c"]])
        self.assertTrue(all(s["k"] == "frame" for s in stops))
        self.assertEqual((doc["tour"]["dw"], doc["tour"]["loop"]), (3.0, True))
        self.assertEqual(fwd[0]["op"], "tour")

    def test_mixed_stops_with_refs_titles_and_dwell(self):
        doc, ids = board()
        doc, *_ = engine.apply_batch(doc, [
            {"op": "tour", "t": "Walkthrough", "stops": [
                ids["$a"], {"id": ids["$n"], "t": "A note", "dw": 5}, {"id": ids["$s"]},
                {"rect": {"x": 10, "y": 20, "w": 300, "h": 200}}, {"view": {"x": -5, "y": 9, "z": 0.5}}]}], by="h")
        ks = [s["k"] for s in doc["tour"]["stops"]]
        self.assertEqual(ks, ["frame", "item", "board", "view", "view"])
        self.assertEqual(doc["tour"]["stops"][1]["dw"], 5.0)
        self.assertEqual(doc["tour"]["t"], "Walkthrough")

    def test_add_remove_clear_and_undo(self):
        doc, ids = board()
        d1, inv1, *_ = engine.apply_batch(doc, [{"op": "tour", "stops": [ids["$a"], ids["$b"]]}])
        d2, inv2, *_ = engine.apply_batch(d1, [{"op": "tour", "add": [ids["$c"]], "at": 0, "remove": [ids["$b"]]}])
        self.assertEqual([s["id"] for s in d2["tour"]["stops"]], [ids["$c"], ids["$a"]])
        back, *_ = engine.apply_batch(d2, inv2)
        self.assertEqual(back["tour"], d1["tour"])
        gone, *_ = engine.apply_batch(d1, [{"op": "tour", "clear": True}])
        self.assertNotIn("tour", gone)
        restored, *_ = engine.apply_batch(gone, [{"op": "tour", "tour": d1["tour"]}])
        self.assertEqual(restored["tour"], d1["tour"])
        undone, *_ = engine.apply_batch(d1, inv1)
        self.assertNotIn("tour", undone)

    def test_rejects_bad_stops(self):
        doc, ids = board()
        for bad in ([ids["$l"]], ["zzzz"], [{}], [{"rect": {"x": "a"}}], [{"id": ids["$a"], "dw": "x"}], "no"):
            with self.assertRaises(engine.OpError, msg=bad):
                engine.apply_batch(doc, [{"op": "tour", "stops": bad}])
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "tour", "stops": [ids["$a"]] * 101}])

    def test_user_replay_is_sanitised_and_drops_dead_stops(self):
        doc, ids = board()
        out, *_ = engine.apply_batch(doc, [{"op": "tour", "tour": {
            "stops": [{"id": ids["$a"], "t": "x" * 500, "evil": 1}, {"id": "dead"}], "junk": 1}}], by="u")
        self.assertEqual(out["tour"], {"stops": [{"k": "frame", "id": ids["$a"], "t": "x" * 120}]})

    def test_deleting_an_item_keeps_the_tour_and_undo_restores_it(self):
        doc, ids = board()
        d1, *_ = engine.apply_batch(doc, [{"op": "tour", "stops": [ids["$a"], ids["$b"]]}])
        d2, inv, *_ = engine.apply_batch(d1, [{"op": "del", "id": ids["$b"]}])
        self.assertEqual(len(d2["tour"]["stops"]), 2)  # the player skips what is gone
        d3, *_ = engine.apply_batch(d2, inv)
        self.assertIn(ids["$b"], d3["items"])


class AgentTourTest(unittest.TestCase):
    def test_outline_lists_the_tour_and_the_hook_teaches_it(self):
        from dashboard.boardkit import agent, summary
        doc, ids = board()
        doc, *_ = engine.apply_batch(doc, [{"op": "tour", "from": "frames", "dw": 4}])
        line = [x for x in summary.outline(doc).splitlines() if x.startswith("tour")][0]
        self.assertIn(f"1:{ids['$a']}", line)
        self.assertIn("dwell=4s", line)
        self.assertIn("from:'frames'", agent.TOUR_HOOK)
        self.assertIn("tour", agent.SCHEMAS["board_apply"]["description"])


class HermesOneCallTest(unittest.TestCase):
    """'Build me a tour through the zones': frames + tour in a single board_apply, via the real tool."""

    def test_zones_and_tour_in_one_board_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            svc = BoardService(Path(tmp))
            ag = agent_mod.BoardAgent(svc, profile="default")
            bid = json.loads(ag.board_read({"board": "Zones", "create": True}, session_id="s1"))["board"]
            res = json.loads(ag.board_apply({"board": bid, "note": "Zones and a tour", "ops": [
                {"op": "add", "ref": "$b", "item": {"k": "frame", "x": 700, "y": 0, "w": 500, "h": 300, "title": "Brain"}},
                {"op": "add", "ref": "$a", "item": {"k": "frame", "x": 0, "y": 0, "w": 500, "h": 300, "title": "Idea"}},
                {"op": "tour", "from": "frames", "dw": 3, "loop": True}]}, session_id="s1"))
            self.assertNotIn("error", res)
            doc = svc.store.load(bid)
            self.assertEqual([s["id"] for s in doc["tour"]["stops"]], [res["ids"]["$a"], res["ids"]["$b"]])
            read = json.loads(ag.board_read({"board": bid, "full": True}, session_id="s1"))
            self.assertIn("tour loop dwell=3s: 1:", read["outline"])
            # it survives a reload
            self.assertEqual(svc.store.load(bid)["tour"], doc["tour"])
            # a bad stop is a clear error and changes nothing
            bad = json.loads(ag.board_apply({"board": bid, "ops": [{"op": "tour", "stops": ["nope"]}]}, session_id="s1"))
            self.assertIn("error", bad)
            self.assertEqual(svc.store.load(bid)["tour"], doc["tour"])


if __name__ == "__main__":
    unittest.main()
