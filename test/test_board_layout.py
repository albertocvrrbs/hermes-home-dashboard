import json
import unittest
from pathlib import Path

from dashboard.boardkit import engine, layout

CASES = json.loads((Path(__file__).parent / "fixtures" / "layout-cases.json").read_text())


def doc_with(*items):
    doc = engine.new_doc("k3x9p2qa", "Flow", now=1000)
    ops = [{"op": "add", "ref": f"${k}", "item": it} for k, it in items]
    doc, _, refs = engine.apply_batch(doc, ops, by="u")
    return doc, refs


class FixtureParityTest(unittest.TestCase):
    """The same file the TypeScript tests read: both layouts must agree."""

    def test_tidy(self):
        for c in CASES["tidy"]:
            self.assertEqual(layout.tidy_plan(c["blocks"]), c["expect"], c["name"])

    def test_insert(self):
        for c in CASES["insert"]:
            got = layout.insert_plan(c["a"], c["b"], c["size"], shift_b=c.get("shiftB") is not False)
            self.assertEqual(got, c["expect"], c["name"])

    def test_downstream(self):
        for c in CASES["downstream"]:
            self.assertEqual(layout.downstream([tuple(e) for e in c["edges"]], c["start"], c["stop"]), c["expect"], c["name"])


class ShapeKindTest(unittest.TestCase):
    def test_shapes_validate(self):
        doc, _ = doc_with(("a", {"k": "shape", "sh": "diamond", "title": "Ship it?", "x": 0, "y": 0}))
        self.assertEqual(doc["items"]["0"], {"k": "shape", "sh": "diamond", "title": "Ship it?", "x": 0, "y": 0})
        for bad in ("triangle", "", 5):
            with self.assertRaises(engine.OpError):
                engine.apply_batch(doc, [{"op": "add", "item": {"k": "shape", "sh": bad, "x": 0, "y": 0}}])

    def test_shape_ignores_foreign_fields(self):
        doc, _ = doc_with(("a", {"k": "shape", "sh": "pill", "text": "no", "num": "1", "x": 0, "y": 0}))
        self.assertEqual(doc["items"]["0"], {"k": "shape", "sh": "pill", "x": 0, "y": 0})

    def test_hermes_shapes_are_marked(self):
        doc, _, _ = engine.apply_batch(engine.new_doc("k3x9p2qa", "x", 1), [
            {"op": "add", "item": {"k": "shape", "sh": "circle", "x": 1, "y": 1}}], by="h")
        self.assertEqual(doc["items"]["0"]["by"], "h")


class InsertOnEdgeTest(unittest.TestCase):
    def flow(self, gap=300):
        doc, refs = doc_with(
            ("a", {"k": "box", "x": 0, "y": 0, "w": 200, "h": 100, "title": "A"}),
            ("b", {"k": "box", "x": 200 + gap, "y": 0, "w": 200, "h": 100, "title": "B"}),
            ("c", {"k": "box", "x": 200 + gap + 400, "y": 0, "w": 200, "h": 100, "title": "C"}),
        )
        doc, _, r2 = engine.apply_batch(doc, [
            {"op": "add", "ref": "$ab", "item": {"k": "line", "a": refs["$a"], "b": refs["$b"], "label": "yes"}},
            {"op": "add", "ref": "$bc", "item": {"k": "line", "a": refs["$b"], "b": refs["$c"]}},
        ])
        return doc, {**refs, **r2}

    def test_splits_the_connector_in_two(self):
        doc, r = self.flow()
        out, inv, refs = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "ref": "$d", "item": {"k": "shape", "sh": "diamond", "title": "ok?"}}], by="h")
        new = refs["$d"]
        lines = [(k, v) for k, v in out["items"].items() if v["k"] == "line"]
        ends = sorted((v["a"], v["b"]) for _, v in lines)
        self.assertEqual(ends, sorted([(r["$a"], new), (new, r["$b"]), (r["$b"], r["$c"])]))
        self.assertEqual(out["items"][r["$ab"]]["b"], new)          # first half keeps the original id and label
        self.assertEqual(out["items"][r["$ab"]]["label"], "yes")
        self.assertEqual(out["items"][new]["sh"], "diamond")
        self.assertEqual(out["items"][new]["by"], "h")

    def test_roomy_gap_centres_without_shifting(self):
        doc, r = self.flow(gap=300)
        out, _, refs = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "ref": "$d", "item": {"k": "shape", "sh": "rect"}}])
        n = out["items"][refs["$d"]]
        self.assertEqual((n["x"], n["y"]), (200 + 150 - 80, 22))
        self.assertEqual(out["items"][r["$b"]]["x"], 500)
        self.assertEqual(out["items"][r["$c"]]["x"], 900)

    def test_tight_gap_pushes_b_and_everything_downstream(self):
        doc, r = self.flow(gap=60)
        out, _, refs = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "ref": "$d", "item": {"k": "shape", "sh": "rect"}}])
        # needs 160 + 2*48 = 256 between A and B, had 60: B and C move 196 right
        self.assertEqual(out["items"][r["$b"]]["x"], 260 + 196)
        self.assertEqual(out["items"][r["$c"]]["x"], 660 + 196)
        self.assertEqual(out["items"][r["$a"]]["x"], 0)
        n = out["items"][refs["$d"]]
        self.assertEqual(n["x"] - 200, 456 - (n["x"] + 160))         # equal gaps either side

    def test_single_undo_restores_everything(self):
        doc, r = self.flow(gap=60)
        out, inv, _ = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "card", "text": "hi"}}])
        back, _, _ = engine.apply_batch(out, inv)
        self.assertEqual(back["items"], doc["items"])

    def test_replay_of_normalised_ops_gives_the_same_board(self):
        doc, r = self.flow(gap=60)
        out, _, _, forward = engine.apply_batch_ex(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "shape", "sh": "pill"}}])
        self.assertTrue(all(o["op"] in ("put", "set") for o in forward))
        self.assertNotIn("insert_on_edge", json.dumps(forward))

    def test_cycle_only_moves_b(self):
        doc, r = self.flow(gap=60)
        doc, _, _ = engine.apply_batch(doc, [{"op": "add", "item": {"k": "line", "a": r["$c"], "b": r["$a"]}}])
        out, _, _ = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "shape", "sh": "rect"}}])
        self.assertEqual(out["items"][r["$b"]]["x"], 456)
        self.assertEqual(out["items"][r["$c"]]["x"], 660)

    def test_rejects_bad_input(self):
        doc, r = self.flow()
        for op in (
            {"op": "insert_on_edge", "edge": r["$a"], "item": {"k": "card"}},               # not a connector
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "line", "a": "0", "b": "1"}},
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "draw"}},
            {"op": "insert_on_edge", "edge": r["$ab"], "item": {"k": "card", "in": r["$a"]}},
            {"op": "insert_on_edge", "edge": "zz", "item": {"k": "card"}},
            {"op": "insert_on_edge", "edge": r["$ab"]},
        ):
            with self.assertRaises(engine.OpError, msg=str(op)):
                engine.apply_batch(doc, [op])

    def test_free_point_end_never_shifts(self):
        doc, r = doc_with(("a", {"k": "box", "x": 0, "y": 0, "w": 200, "h": 100}))
        doc, _, r2 = engine.apply_batch(doc, [{"op": "add", "ref": "$l", "item": {"k": "line", "a": r["$a"], "b": [260, 50]}}])
        out, _, refs = engine.apply_batch(doc, [
            {"op": "insert_on_edge", "edge": r2["$l"], "ref": "$d", "item": {"k": "shape", "sh": "pill"}}])
        self.assertEqual(out["items"][r2["$l"]]["b"], refs["$d"])
        self.assertEqual(len([v for v in out["items"].values() if v["k"] == "line"]), 2)


class TidyOpTest(unittest.TestCase):
    def messy(self):
        return doc_with(
            ("c", {"k": "card", "x": 700, "y": 40, "w": 256, "h": 120, "text": "c"}),
            ("a", {"k": "card", "x": 13, "y": 7, "w": 256, "h": 140, "text": "a"}),
            ("b", {"k": "card", "x": 330, "y": 30, "w": 304, "h": 240, "text": "b"}),
            ("d", {"k": "card", "x": 20, "y": 400, "w": 212, "h": 170, "text": "d"}),
        )

    def test_whole_board_goes_to_a_grid_in_reading_order(self):
        doc, r = self.messy()
        out, inv, _ = engine.apply_batch(doc, [{"op": "tidy"}], by="h")
        pos = {k: (v["x"], v["y"]) for k, v in out["items"].items()}
        self.assertEqual(pos[r["$a"]], (24, 0))
        self.assertEqual(pos[r["$b"]], (304, 0))
        self.assertEqual(pos[r["$c"]], (632, 0))
        self.assertEqual(pos[r["$d"]], (24, 264))
        for (x, y) in (pos[r["$a"]], pos[r["$d"]]):
            self.assertEqual(x % 24, 0)
        back, _, _ = engine.apply_batch(out, inv)
        self.assertEqual(back["items"], doc["items"])

    def test_idempotent(self):
        doc, _ = self.messy()
        once, _, _ = engine.apply_batch(doc, [{"op": "tidy"}])
        twice, _, _, fwd = engine.apply_batch_ex(once, [{"op": "tidy"}])
        self.assertEqual(once["items"], twice["items"])
        self.assertEqual(fwd, [])

    def test_ids_limit_the_selection(self):
        doc, r = self.messy()
        out, _, _ = engine.apply_batch(doc, [{"op": "tidy", "ids": [r["$a"], r["$c"]]}])
        self.assertEqual((out["items"][r["$b"]]["x"], out["items"][r["$b"]]["y"]), (330, 30))
        self.assertEqual((out["items"][r["$d"]]["x"], out["items"][r["$d"]]["y"]), (20, 400))
        self.assertNotEqual((out["items"][r["$c"]]["x"], out["items"][r["$c"]]["y"]), (700, 40))

    def test_connected_items_and_framed_items_stay_unless_asked(self):
        doc, r = doc_with(
            ("a", {"k": "box", "x": 5, "y": 5, "w": 100, "h": 50}),
            ("b", {"k": "box", "x": 405, "y": 205, "w": 100, "h": 50}),
            ("f", {"k": "frame", "x": 1000, "y": 0, "w": 400, "h": 400}),
            ("in", {"k": "card", "x": 1010, "y": 10, "w": 100, "h": 50}),
            ("free", {"k": "card", "x": 777, "y": 333, "w": 100, "h": 50}),
        )
        doc, _, r2 = engine.apply_batch(doc, [{"op": "add", "item": {"k": "line", "a": r["$a"], "b": r["$b"]}}])
        out, _, _ = engine.apply_batch(doc, [{"op": "tidy"}])
        self.assertEqual((out["items"][r["$a"]]["x"], out["items"][r["$a"]]["y"]), (5, 5))
        self.assertEqual((out["items"][r["$in"]]["x"], out["items"][r["$in"]]["y"]), (1010, 10))
        self.assertEqual(out["items"][r["$f"]]["x"], 1000)
        # explicit ids include connected items
        out2, _, _ = engine.apply_batch(doc, [{"op": "tidy", "ids": [r["$a"], r["$b"]]}])
        self.assertEqual((out2["items"][r["$a"]]["x"], out2["items"][r["$a"]]["y"]), (0, 0))

    def test_stroke_groups_move_together(self):
        doc, r = doc_with(
            ("s1", {"k": "draw", "x": 500, "y": 300, "d": "0,0 40,0", "g": "g1"}),
            ("s2", {"k": "draw", "x": 540, "y": 330, "d": "0,0 40,0", "g": "g1"}),
            ("a", {"k": "card", "x": 0, "y": 0, "w": 200, "h": 100}),
        )
        out, _, _ = engine.apply_batch(doc, [{"op": "tidy"}])
        s1, s2 = out["items"][r["$s1"]], out["items"][r["$s2"]]
        self.assertEqual((s2["x"] - s1["x"], s2["y"] - s1["y"]), (40, 30))

    def test_bad_ids_fail_whole_batch(self):
        doc, _ = self.messy()
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "tidy", "ids": ["nope"]}])
        with self.assertRaises(engine.OpError):
            engine.apply_batch(doc, [{"op": "tidy", "ids": []}])


if __name__ == "__main__":
    unittest.main()
