import json
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit import engine
from dashboard.boardkit.fetch import Fetcher
from dashboard.boardkit.service import BoardService
from dashboard.boardkit import summary


def stations_doc(n=37):
    doc = engine.new_doc("abcd1234", "t", 0)
    ops = [{"op": "add", "item": {"k": "box", "num": f"{i:02d}", "title": f"Station {i}", "x": (i * 197) % 1700 - 300,
                                  "y": (i * 131) % 900 - 200}} for i in range(1, n + 1)]
    ops += [
        {"op": "add", "item": {"k": "card", "title": "Idea A", "text": "x", "tags": ["idea"], "x": -900, "y": 0}},
        {"op": "add", "item": {"k": "card", "title": "Idea B", "text": "y", "tags": ["Idea"], "x": -900, "y": 200}},
        {"op": "add", "item": {"k": "card", "title": "Spec", "text": "spec " * 40, "tags": ["design"], "x": -900, "y": 400}},
        {"op": "add", "item": {"k": "card", "title": "Loose", "x": 4000, "y": 0}},
    ]
    new, _, _ = engine.apply_batch(doc, ops, "h")
    return new


def rect(doc, iid):
    it = doc["items"][iid]
    w, h = engine.DEFAULT_SIZE[it["k"]]
    return it["x"], it["y"], it.get("w") or w, it.get("h") or h


def overlap(a, b):
    return a[0] < b[0] + b[2] and a[0] + a[2] > b[0] and a[1] < b[1] + b[3] and a[1] + a[3] > b[1]


class SetWhereTest(unittest.TestCase):
    def test_mark_many_by_number_range_and_rules_later_wins(self):
        doc = stations_doc()
        new, inv, _ = engine.apply_batch(doc, [
            {"op": "set_where", "where": {"k": "box", "num": "1-30"}, "p": {"mark": "ok"}},
            {"op": "set_where", "rules": [{"where": {"num": [7, 19]}, "p": {"mark": "fail"}},
                                          {"where": {"num": "31-37"}, "p": {"mark": "wait"}}]},
        ], "h")
        marks = {it["num"]: it.get("mark") for it in new["items"].values() if it["k"] == "box"}
        self.assertEqual(sum(1 for m in marks.values() if m == "ok"), 28)
        self.assertEqual(marks["07"], "fail")
        self.assertEqual(marks["19"], "fail")
        self.assertEqual(marks["37"], "wait")
        back, _, _ = engine.apply_batch(new, inv, "h")
        self.assertEqual(back["items"], doc["items"])

    def test_filters_tag_text_kind_ids_frame_mark(self):
        doc = stations_doc()
        ids = {v.get("title"): k for k, v in doc["items"].items()}
        new, _, _ = engine.apply_batch(doc, [
            {"op": "set_where", "where": {"tag": "#IDEA"}, "p": {"mark": "wait"}},
            {"op": "set_where", "where": {"text": ["station 5", "station 6"], "k": "box"}, "p": {"mark": "ok"}},
            {"op": "set_where", "where": {"ids": [ids["Loose"]]}, "p": {"title": "Renamed"}},
        ], "h")
        self.assertEqual(new["items"][ids["Idea A"]]["mark"], "wait")
        self.assertEqual(new["items"][ids["Idea B"]]["mark"], "wait")
        self.assertNotIn("mark", new["items"][ids["Spec"]])
        self.assertEqual(sorted(it["title"] for it in new["items"].values() if it.get("mark") == "ok"), ["Station 5", "Station 6"])
        self.assertEqual(new["items"][ids["Loose"]]["title"], "Renamed")
        again, _, _ = engine.apply_batch(new, [{"op": "set_where", "where": {"mark": "wait"}, "p": {"mark": None}}], "h")
        self.assertFalse([1 for it in again["items"].values() if it.get("mark") == "wait"])

    def test_errors_are_explicit_and_atomic(self):
        doc = stations_doc()
        for ops, text in (
            ([{"op": "set_where", "where": {"text": "nope"}, "p": {"mark": "ok"}}], "matched nothing"),
            ([{"op": "set_where", "where": {"colour": "red"}, "p": {"mark": "ok"}}], "unknown where key"),
            ([{"op": "set_where", "where": {}, "p": {"mark": "ok"}}], "where must be"),
            ([{"op": "set_where", "where": {"k": "box"}}], "needs p"),
            ([{"op": "set_where", "where": {"k": "box"}, "p": {"mark": "great"}}], "mark"),
            ([{"op": "set_where", "where": {"k": "box"}, "p": {"url": "http://x.y"}}], "none of the matched"),
            ([{"op": "set_where", "where": {"k": "box", "mark": "maybe"}, "p": {"mark": "ok"}}], "where.mark"),
        ):
            with self.assertRaises(engine.OpError, msg=text) as cm:
                engine.apply_batch(doc, [{"op": "set_where", "where": {"k": "box"}, "p": {"mark": "ok"}}] + ops, "h")
            self.assertIn(text, str(cm.exception))

    def test_noop_when_already_set(self):
        doc = stations_doc()
        once, _, _ = engine.apply_batch(doc, [{"op": "set_where", "where": {"k": "box"}, "p": {"mark": "ok"}}], "h")
        _, inv, _, fwd = engine.apply_batch_ex(once, [{"op": "set_where", "where": {"k": "box"}, "p": {"mark": "ok"}}], "h")
        self.assertEqual(fwd, [])
        self.assertEqual(inv, [])


class ZonesTest(unittest.TestCase):
    def zones(self, **extra):
        return {"op": "zones", "layout": "row", "zones": [
            {"title": "Idea", "ref": "$z1", "where": {"tag": "idea"}},
            {"title": "Design", "ref": "$z2", "where": {"tag": "design"}},
            {"title": "Training Room", "ref": "$z4", "where": {"k": "box", "text": "Station"}},
            {"title": "Exam"}], **extra}

    def test_zones_move_items_by_rule_on_the_grid_without_overlap(self):
        doc = stations_doc()
        new, inv, refs = engine.apply_batch(doc, [self.zones()], "h")
        frames = {v["title"]: (k, v) for k, v in new["items"].items() if v["k"] == "frame"}
        self.assertEqual(list(frames), ["Idea", "Design", "Training Room", "Exam"])
        self.assertEqual(refs["$z4"], frames["Training Room"][0])
        # in order, left to right, same top, uniform height, on the grid
        xs = [frames[t][1]["x"] for t in frames]
        self.assertEqual(xs, sorted(xs))
        self.assertEqual({f[1]["y"] for f in frames.values()}, {frames["Idea"][1]["y"]})
        self.assertEqual(len({f[1]["h"] for f in frames.values()}), 1)
        for _, f in frames.values():
            self.assertEqual((f["x"] % 24, f["y"] % 24, f["w"] % 24, f["h"] % 24), (0, 0, 0, 0))
        fr = {t: rect(new, k) for t, (k, _) in frames.items()}
        titles = list(fr)
        for i, a in enumerate(titles):
            for b in titles[i + 1:]:
                self.assertFalse(overlap(fr[a], fr[b]))
        # every station inside the Training Room frame, none overlapping, ordered by number
        tr = fr["Training Room"]
        stations = [(v["num"], k) for k, v in new["items"].items() if v["k"] == "box"]
        self.assertEqual(len(stations), 37)
        rects = []
        for num, k in sorted(stations):
            r = rect(new, k)
            self.assertTrue(tr[0] <= r[0] and r[0] + r[2] <= tr[0] + tr[2] and tr[1] + 48 <= r[1] and r[1] + r[3] <= tr[1] + tr[3], num)
            self.assertEqual((r[0] % 24, r[1] % 24), (0, 0))
            rects.append(r)
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                self.assertFalse(overlap(a, b))
        order = sorted(range(37), key=lambda i: (rects[i][1], rects[i][0]))
        self.assertEqual(order, list(range(37)))  # 01..37 reading order
        # the loose card outside any rule stays where it was and is not covered
        loose = next(k for k, v in new["items"].items() if v.get("title") == "Loose")
        self.assertEqual(new["items"][loose]["x"], 4000)
        # the whole thing undoes in ONE inverse batch
        back, _, _ = engine.apply_batch(new, inv, "h")
        self.assertEqual(back["items"], doc["items"])

    def test_first_zone_wins_and_column_kids_stay_unless_asked(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$c", "item": {"k": "col", "title": "Todo", "x": 0, "y": 0}},
            {"op": "add", "ref": "$k", "item": {"k": "card", "title": "kid", "tags": ["a"], "in": "$c"}},
            {"op": "add", "ref": "$m", "item": {"k": "card", "title": "multi", "tags": ["a", "b"], "x": 700, "y": 0}},
        ], "h")
        new, _, _ = engine.apply_batch(doc, [{"op": "zones", "zones": [
            {"title": "A", "where": {"tag": "a"}}, {"title": "B", "where": {"tag": "b"}}]}], "h")
        kid, multi = refs["$k"], refs["$m"]
        self.assertEqual(new["items"][kid]["in"], refs["$c"])
        frames = {v["title"]: v for v in new["items"].values() if v["k"] == "frame"}
        mx = new["items"][multi]["x"]
        self.assertTrue(frames["A"]["x"] <= mx < frames["A"]["x"] + frames["A"]["w"])
        pulled, _, _ = engine.apply_batch(doc, [{"op": "zones", "zones": [
            {"title": "A", "where": {"tag": "a", "in": refs["$c"]}}]}], "h")
        self.assertNotIn("in", pulled["items"][kid])
        self.assertEqual(pulled["items"][refs["$c"]]["kids"], [])

    def test_existing_frame_reused_and_grown(self):
        doc = stations_doc(12)
        doc, _, refs = engine.apply_batch(doc, [{"op": "add", "ref": "$f", "item": {"k": "frame", "title": "Old", "x": 3000, "y": 3000, "w": 400, "h": 200}}], "h")
        new, _, _ = engine.apply_batch(doc, [{"op": "zones", "zones": [
            {"frame": refs["$f"], "title": "Stations", "where": {"k": "box"}}]}], "h")
        f = new["items"][refs["$f"]]
        self.assertEqual(f["title"], "Stations")
        self.assertGreater(f["h"], 200)
        for v in new["items"].values():
            if v["k"] == "box":
                self.assertTrue(f["x"] <= v["x"] and v["x"] + 196 <= f["x"] + f["w"] and f["y"] <= v["y"] and v["y"] + 62 <= f["y"] + f["h"])

    def test_new_zones_clear_of_unmoved_items(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, refs = engine.apply_batch(doc, [
            {"op": "add", "item": {"k": "card", "title": "Move me", "tags": ["m"], "x": 0, "y": 0}},
            {"op": "add", "item": {"k": "card", "title": "Wall", "x": 0, "y": -300, "w": 1200, "h": 600}},
        ], "h")
        new, _, _ = engine.apply_batch(doc, [{"op": "zones", "zones": [{"title": "M", "where": {"tag": "m"}}]}], "h")
        wall = next(k for k, v in new["items"].items() if v["title"] == "Wall")
        frame = next(k for k, v in new["items"].items() if v["k"] == "frame")
        self.assertFalse(overlap(rect(new, wall), rect(new, frame)))

    def test_bad_input(self):
        doc = stations_doc(3)
        for z in ([], [{"where": {"k": "box"}}], [{"title": "x", "where": {"k": "box"}}] * 30, ["x"]):
            with self.assertRaises(engine.OpError):
                engine.apply_batch(doc, [{"op": "zones", "zones": z}], "h")
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "zones", "layout": "diag", "zones": [{"title": "x"}]}], "h")


class ArrangeAndPlaceTest(unittest.TestCase):
    def _three_zones(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        ops = []
        for n in range(3):
            y = n * 900
            ops += [
                {"op": "add", "ref": f"$f{n}", "item": {"k": "frame", "title": f"Z{n}", "x": 0, "y": y, "w": 800, "h": 600}},
                {"op": "add", "ref": f"$a{n}", "item": {"k": "box", "title": "A", "x": 60, "y": y + 100}},
                {"op": "add", "ref": f"$b{n}", "item": {"k": "box", "title": "B", "x": 500, "y": y + 300}},
                {"op": "add", "item": {"k": "line", "a": f"$a{n}", "b": f"$b{n}"}},
                {"op": "add", "item": {"k": "line", "a": [100, y + 500], "b": [300, y + 500]}},
                {"op": "add", "item": {"k": "draw", "x": 600, "y": y + 450, "d": "0,0 40,30 80,0"}},
            ]
        doc, _, refs = engine.apply_batch(doc, ops, "h")
        return doc, refs

    @staticmethod
    def _offsets(doc, fid, members):
        f = doc["items"][fid]
        out = []
        for i in sorted(members):
            it = doc["items"][i]
            if it["k"] == "line":
                out += [(i, e, it[e][0] - f["x"], it[e][1] - f["y"]) for e in ("a", "b") if isinstance(it.get(e), list)]
            else:
                out.append((i, it["x"] - f["x"], it["y"] - f["y"]))
        return out

    @staticmethod
    def _members(doc, fid):
        from dashboard.boardkit import bulk
        return bulk.frame_members(engine._Batch(doc, "h"), fid)

    def test_arrange_frames_moves_them_with_their_contents(self):
        doc, refs = self._three_zones()
        frames = [refs[f"$f{n}"] for n in range(3)]
        mem = {f: self._members(doc, f) for f in frames}
        self.assertTrue(all(len(m) == 4 for m in mem.values()))  # 2 boxes, the free line, the stroke
        before = {f: self._offsets(doc, f, mem[f]) for f in frames}
        new, inv, _ = engine.apply_batch(doc, [{"op": "arrange", "ids": frames, "cols": 3, "gap": 96}], "h")
        ys = {new["items"][f]["y"] for f in frames}
        self.assertEqual(len(ys), 1)  # one row now
        self.assertEqual(len({new["items"][f]["x"] for f in frames}), 3)
        for f in frames:
            self.assertEqual(self._offsets(new, f, mem[f]), before[f])  # the diagram inside did not change shape
        back, _, _ = engine.apply_batch(new, inv, "h")
        self.assertEqual(back["items"], doc["items"])

    def test_zones_take_existing_frames_and_sketches_as_blocks(self):
        doc, refs = self._three_zones()
        f0 = refs["$f0"]
        mem = self._members(doc, f0)
        before = self._offsets(doc, f0, mem)
        new, _, out = engine.apply_batch(doc, [{"op": "zones", "layout": "row", "zones": [
            {"title": "Idea", "ids": [f0]}, {"title": "Rest", "ids": [refs["$f1"], refs["$f2"]]}]}], "h")
        self.assertEqual(self._offsets(new, f0, mem), before)
        zones = [i for i, v in new["items"].items() if v["k"] == "frame" and v["title"] in ("Idea", "Rest")]
        self.assertEqual(len(zones), 2)
        idea = new["items"][[i for i in zones if new["items"][i]["title"] == "Idea"][0]]
        inner = new["items"][f0]
        self.assertTrue(idea["x"] <= inner["x"] and inner["x"] + inner["w"] <= idea["x"] + idea["w"])

    def test_picture_height_follows_aspect_even_with_h(self):
        # the board ignores h on image/video cards; layout must too or text lands on the video
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, _ = engine.apply_batch(doc, [
            {"op": "add", "item": {"k": "video", "x": 0, "y": 0, "w": 680, "h": 383, "iw": 960, "ih": 540, "src": "https://ex.com/a.mp4"}},
        ], "h")
        from dashboard.boardkit import bulk
        tall = bulk._media_h("video", 680, 960, 540)
        self.assertGreater(tall, 383)
        self.assertEqual(engine._Batch(doc, "h").rect_of("0")["h"], tall)
        new, _, _ = engine.apply_batch(doc, [{"op": "add", "item": {"k": "card", "x": 0, "y": 400, "text": "below"}},
                                             {"op": "tidy"}], "h")
        v, c = new["items"]["0"], new["items"]["1"]
        self.assertTrue(c["y"] >= v["y"] + tall or c["x"] >= v["x"] + 680 or c["x"] + 256 <= v["x"])

    def test_arrange_frame_is_a_uniform_grid(self):
        doc = stations_doc(12)
        doc, _, refs = engine.apply_batch(doc, [{"op": "add", "ref": "$f", "item": {"k": "frame", "title": "F", "x": -400, "y": -300, "w": 1300, "h": 1300}}], "h")
        new, inv, _ = engine.apply_batch(doc, [{"op": "arrange", "frame": refs["$f"], "gap": 24}], "h")
        pos = sorted((v["y"], v["x"]) for v in new["items"].values() if v["k"] == "box")
        self.assertEqual(len({y for y, _ in pos}) * len({x for _, x in pos}) >= 12, True)
        gaps = sorted({b[1] - a[1] for a, b in zip(pos, pos[1:]) if a[0] == b[0]})
        self.assertEqual(len(gaps), 1)  # one horizontal pitch
        back, _, _ = engine.apply_batch(new, inv, "h")
        self.assertEqual(back["items"], doc["items"])

    def test_arrange_by_ids_and_where(self):
        doc = stations_doc(6)
        ids = [k for k, v in doc["items"].items() if v["k"] == "box"][:4]
        a, _, _ = engine.apply_batch(doc, [{"op": "arrange", "ids": ids, "cols": 2}], "h")
        xs = {a["items"][i]["x"] for i in ids}
        self.assertEqual(len(xs), 2)
        b, _, _ = engine.apply_batch(doc, [{"op": "arrange", "where": {"k": "box"}, "cols": 3}], "h")
        self.assertEqual(len({v["x"] for v in b["items"].values() if v["k"] == "box"}), 3)
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "arrange"}], "h")

    def test_place_grid_row_column_at(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        items = [{"item": {"k": "box", "title": str(i)}} for i in range(6)]
        for layout, xs, ys in (("row", 6, 1), ("column", 1, 6)):
            new, _, _ = engine.apply_batch(doc, [{"op": "place", "items": items, "layout": layout, "at": [240, 120]}], "h")
            self.assertEqual(len({v["x"] for v in new["items"].values()}), xs)
            self.assertEqual(len({v["y"] for v in new["items"].values()}), ys)
            self.assertEqual(min(v["x"] for v in new["items"].values()), 240)
            self.assertEqual(min(v["y"] for v in new["items"].values()), 120)
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "place", "items": [{"item": {"k": "line"}}]}], "h")


class AgentBulkTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

        def resolver(host, port):
            raise OSError("offline")
        self.svc = BoardService(Path(self.tmp.name), fetcher=Fetcher(resolver=resolver, transport=lambda *a: (_ for _ in ()).throw(OSError())))
        self.agent = agent_mod.BoardAgent(self.svc)

    def tearDown(self):
        self.tmp.cleanup()

    def test_a_whole_reorganisation_in_one_board_apply(self):
        bid = json.loads(self.agent.board_read({"board": "b", "create": True}, session_id="s"))["board"]
        doc = stations_doc()
        ops = [{"op": "add", "item": {k: v for k, v in it.items() if k not in ("by",)}} for it in doc["items"].values()]
        json.loads(self.agent.board_apply({"ops": ops}, session_id="s"))
        res = json.loads(self.agent.board_apply({"note": "Zones and marks", "ops": [
            {"op": "zones", "zones": [{"title": "Training Room", "ref": "$tr", "where": {"k": "box"}},
                                      {"title": "Idea", "where": {"tag": "idea"}}]},
            {"op": "set_where", "where": {"k": "box", "num": "1-10"}, "p": {"mark": "ok"}},
            {"op": "arrange", "frame": "$tr"},
        ]}, session_id="s"))
        self.assertNotIn("error", res)
        self.assertEqual(self.svc.store.load(bid)["seq"], 2)  # two commits: the seed and ONE for the order
        outline = json.loads(self.agent.board_read({"full": True}, session_id="s"))["outline"]
        self.assertIn("mark=ok", outline)
        self.assertIn("Training Room", outline)

    def test_tool_text_teaches_the_bulk_ops(self):
        text = agent_mod.SCHEMAS["board_apply"]["description"]
        for needle in ("import", "set_where", "zones", "arrange", "mark", "ONE CALL", "help:'bulk'"):
            self.assertIn(needle, text)
        helped = json.loads(self.agent.board_read({"help": "bulk"}, session_id="s"))["help"]
        for needle in ("import", "set_where", "zones", "arrange", "place", "rules"):
            self.assertIn(needle, helped)

    def test_mark_is_in_the_outline_and_other_kinds_ignore_it(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, refs = engine.apply_batch(doc, [{"op": "add", "ref": "$b", "item": {"k": "box", "title": "S", "mark": "fail"}},
                                                {"op": "add", "ref": "$t", "item": {"k": "text", "text": "x", "mark": "ok"}}], "h")
        self.assertIn("mark=fail", summary.outline(doc))
        self.assertNotIn("mark", doc["items"][refs["$t"]])


if __name__ == "__main__":
    unittest.main()
