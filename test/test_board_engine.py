import copy
import unittest

from dashboard.boardkit import engine, ids


def blank():
    return engine.new_doc("k3x9p2qa", "Launch", now=1000)


class IdsTest(unittest.TestCase):
    def test_item_ids_are_short_base36(self):
        self.assertEqual([ids.item_id(n) for n in (0, 9, 10, 35, 36)], ["0", "9", "a", "z", "10"])

    def test_board_and_asset_id_validation(self):
        self.assertTrue(ids.valid_bid("k3x9p2qa"))
        for bad in ("../etc/pa", "K3X9P2QA", "k3x9p2q", "k3x9p2qa/", "", None, 5):
            self.assertFalse(ids.valid_bid(bad), bad)
        self.assertTrue(ids.valid_aid("0123456789abcdef.png"))
        for bad in ("../0123456789abcdef.png", "0123456789abcdef.svg", "0123456789abcde.png",
                    "0123456789abcdef.png/..", "0123456789ABCDEF.png"):
            self.assertFalse(ids.valid_aid(bad), bad)
        self.assertTrue(ids.valid_bid(ids.new_bid()))


class AddSetDelTest(unittest.TestCase):
    def test_add_assigns_compact_ids_and_resolves_refs(self):
        doc, inv, out = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$a", "item": {"k": "box", "x": 0, "y": 0, "title": "One"}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 300, "y": 0, "title": "Two"}},
            {"op": "add", "item": {"k": "line", "a": "$a", "b": "$b"}},
        ], by="h")
        self.assertEqual(out, {"$a": "0", "$b": "1"})
        self.assertEqual(doc["items"]["2"], {"k": "line", "a": "0", "b": "1", "by": "h"})
        self.assertEqual(doc["n"], 3)
        self.assertEqual(doc["items"]["0"]["by"], "h")

    def test_user_cannot_forge_hermes_authorship(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "card", "x": 1, "y": 2, "text": "hi", "by": "h"}}], by="u")
        self.assertNotIn("by", doc["items"]["0"])

    def test_unknown_fields_dropped_and_values_coerced(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "card", "x": 10.6, "y": "7", "evil": "<script>", "text": "a"}}], by="u")
        self.assertEqual(doc["items"]["0"], {"k": "card", "x": 11, "y": 7, "text": "a"})

    def test_bad_kind_rejects_whole_batch(self):
        base = blank()
        before = copy.deepcopy(base)
        with self.assertRaises(engine.OpError):
            engine.apply_batch(base, [
                {"op": "add", "item": {"k": "card", "x": 0, "y": 0}},
                {"op": "add", "item": {"k": "script"}},
            ], by="u")
        self.assertEqual(base, before)

    def test_set_patches_and_null_removes(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "a", "tags": ["x"]}}], by="u")
        doc, inv, _ = engine.apply_batch(doc, [{"op": "set", "id": "0", "p": {"x": 50, "tags": None}}], by="u")
        self.assertEqual(doc["items"]["0"], {"k": "card", "x": 50, "y": 0, "text": "a"})
        self.assertEqual(inv, [{"op": "set", "id": "0", "p": {"x": 0, "tags": ["x"]}}])

    def test_set_cannot_change_kind_or_author(self):
        doc, _, _ = engine.apply_batch(blank(), [{"op": "add", "item": {"k": "card", "x": 0, "y": 0}}], by="h")
        doc, _, _ = engine.apply_batch(doc, [{"op": "set", "id": "0", "p": {"k": "embed", "by": None}}], by="u")
        self.assertEqual(doc["items"]["0"]["k"], "card")
        self.assertEqual(doc["items"]["0"]["by"], "h")

    def test_delete_cascades_connectors(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$a", "item": {"k": "box", "x": 0, "y": 0}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 300, "y": 0}},
            {"op": "add", "item": {"k": "line", "a": "$a", "b": "$b"}},
        ], by="u")
        doc, inv, _ = engine.apply_batch(doc, [{"op": "del", "id": "0"}], by="u")
        self.assertEqual(sorted(doc["items"]), ["1"])
        restored, _, _ = engine.apply_batch(doc, inv, by="u")
        self.assertEqual(sorted(restored["items"]), ["0", "1", "2"])

    def test_unknown_id_is_an_error(self):
        with self.assertRaises(engine.OpError):
            engine.apply_batch(blank(), [{"op": "set", "id": "zz", "p": {"x": 1}}], by="u")
        with self.assertRaises(engine.OpError):
            engine.apply_batch(blank(), [{"op": "add", "item": {"k": "line", "a": "$nope", "b": [0, 0]}}], by="u")

    def test_limits(self):
        with self.assertRaises(engine.OpError):
            engine.apply_batch(blank(), [{"op": "board", "p": {"name": "x"}}] * (engine.MAX_OPS + 1), by="u")
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "y" * (engine.MAX_TEXT + 50)}}], by="u")
        self.assertEqual(len(doc["items"]["0"]["text"]), engine.MAX_TEXT)

    def test_sketch_text_uses_the_hand_size(self):
        doc, _, _ = engine.apply_batch(blank(), [{"op": "add", "item": {"k": "text", "x": 0, "y": 0, "text": "post!", "size": "s"}}], by="u")
        self.assertEqual(doc["items"]["0"]["size"], "s")

    def test_stroke_format_validated(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "draw", "x": 5, "y": 5, "d": "0,0 4,5 10,-2"}}], by="u")
        self.assertEqual(doc["items"]["0"]["d"], "0,0 4,5 10,-2")
        with self.assertRaises(engine.OpError):
            engine.apply_batch(blank(), [{"op": "add", "item": {"k": "draw", "x": 0, "y": 0, "d": "M0 0 javascript:"}}], by="u")


class InkFieldsTest(unittest.TestCase):
    """Draw-tool styling (1.9.2): optional fields, validated, backward compatible."""

    def add(self, **item):
        doc, inv, _ = engine.apply_batch(blank(), [{"op": "add", "item": {"k": "draw", "x": 0, "y": 0, "d": "0,0 40,30", **item}}], by="u")
        return doc, inv

    def test_plain_stroke_unchanged(self):
        doc, _ = self.add(sw=1.9)
        self.assertEqual(doc["items"]["0"], {"k": "draw", "x": 0, "y": 0, "d": "0,0 40,30", "sw": 1.9})

    def test_shapes_colors_and_flags_are_kept(self):
        doc, _ = self.add(tl="arrow", c="sage", ds=True, sw=3.5, g="ab12")
        it = doc["items"]["0"]
        self.assertEqual((it["tl"], it["c"], it["ds"], it["g"]), ("arrow", "sage", True, "ab12"))
        for tl in ("hl", "line", "rect", "ellipse"):
            self.assertEqual(self.add(tl=tl)[0]["items"]["0"]["tl"], tl)

    def test_smooth_pressure(self):
        doc, _ = self.add(sm=True, pr="39")
        self.assertEqual((doc["items"]["0"]["sm"], doc["items"]["0"]["pr"]), (True, "39"))

    def test_bad_values_reject_the_batch(self):
        for bad in ({"tl": "star"}, {"c": "#ff0000"}, {"c": "ink"}, {"ds": False}, {"ds": "yes"}, {"sm": 1},
                    {"pr": "12a"}, {"pr": "1" * 401}, {"g": "Group!"}, {"g": "x" * 13}):
            with self.assertRaises(engine.OpError, msg=str(bad)):
                self.add(**bad)

    def test_new_fields_only_on_draw_items(self):
        doc, _, _ = engine.apply_batch(blank(), [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "hi", "c": "sage", "g": "ab"}}], by="u")
        self.assertNotIn("c", doc["items"]["0"])
        self.assertNotIn("g", doc["items"]["0"])

    def test_group_set_and_clear_are_undoable(self):
        doc, _ = self.add()
        doc2, inv, _ = engine.apply_batch(doc, [{"op": "set", "id": "0", "p": {"g": "k2"}}], by="u")
        self.assertEqual(doc2["items"]["0"]["g"], "k2")
        doc3, _, _ = engine.apply_batch(doc2, inv, by="u")
        self.assertNotIn("g", doc3["items"]["0"])
        doc4, _, _ = engine.apply_batch(doc2, [{"op": "set", "id": "0", "p": {"g": None, "ds": True}}], by="u")
        self.assertNotIn("g", doc4["items"]["0"])
        self.assertTrue(doc4["items"]["0"]["ds"])

    def test_summary_names_shapes(self):
        from dashboard.boardkit import summary
        doc, _ = self.add(tl="rect", c="clay", ds=True)
        line = summary.item_line("0", doc["items"]["0"])
        self.assertIn("rectangle clay dashed", line)
        self.assertIn("sketch 2pts", summary.item_line("0", self.add()[0]["items"]["0"]))

    def test_render_draws_every_ink_kind(self):
        try:
            import PIL  # noqa: F401
        except ImportError:
            self.skipTest("Pillow not installed")
        import tempfile
        from pathlib import Path
        from dashboard.boardkit import render
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "draw", "x": 0, "y": 0, "d": "0,0 80,20", "tl": tl, "c": "slate", "sw": 3.5}}
            for tl in ("hl", "line", "arrow", "rect", "ellipse")] + [
            {"op": "add", "item": {"k": "draw", "x": 0, "y": 40, "d": "0,0 10,10 30,5", "sm": True, "pr": "159"}}], by="u")
        with tempfile.TemporaryDirectory() as tmp:
            out = render.render_png(doc, None, Path(tmp) / "x.png")
            self.assertTrue(Path(out["path"]).exists())

    def test_render_shows_subtitles_labels_and_marks(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow not installed")
        import tempfile
        from pathlib import Path
        from dashboard.boardkit import render
        base, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$a", "item": {"k": "box", "x": 0, "y": 0, "w": 300, "h": 80, "title": "Controller"}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 600, "y": 0, "w": 300, "h": 80, "title": "Battery"}},
            {"op": "add", "item": {"k": "line", "a": "$a", "b": "$b"}},
        ], by="h")
        rich, _, _ = engine.apply_batch(base, [
            {"op": "set", "id": "0", "p": {"sub": "Radxa ZERO 3W + IMU", "mark": "ok"}},
            {"op": "set", "id": "2", "p": {"label": "12 V"}},
        ], by="h")
        with tempfile.TemporaryDirectory() as tmp:
            a = render.render_png(base, None, Path(tmp) / "a.png")
            b = render.render_png(rich, None, Path(tmp) / "b.png")
            pa, pb = Image.open(a["path"]).convert("RGB"), Image.open(b["path"]).convert("RGB")
            changed = sum(1 for x, y in zip(pa.getdata(), pb.getdata()) if x != y)
            self.assertGreater(changed, 200)  # subtitle, connector label and mark all drew something


class ColumnsTest(unittest.TestCase):
    def setUp(self):
        self.doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$c", "item": {"k": "col", "x": 0, "y": 0, "title": "Ideas"}},
            {"op": "add", "item": {"k": "card", "in": "$c", "text": "one"}},
            {"op": "add", "item": {"k": "card", "in": "$c", "text": "two"}},
            {"op": "add", "item": {"k": "card", "x": 500, "y": 0, "text": "loose"}},
        ], by="u")

    def test_add_into_column_appends_kid_without_coordinates(self):
        self.assertEqual(self.doc["items"]["0"]["kids"], ["1", "2"])
        self.assertNotIn("x", self.doc["items"]["1"])

    def test_move_into_column_at_index_and_back_out(self):
        doc, inv, _ = engine.apply_batch(self.doc, [{"op": "set", "id": "3", "p": {"in": "0"}, "at": 0}], by="u")
        self.assertEqual(doc["items"]["0"]["kids"], ["3", "1", "2"])
        self.assertNotIn("x", doc["items"]["3"])
        back, _, _ = engine.apply_batch(doc, inv, by="u")
        self.assertEqual(back["items"]["0"]["kids"], ["1", "2"])
        self.assertEqual(back["items"]["3"]["x"], 500)

    def test_reorder_kids_must_be_a_permutation(self):
        doc, _, _ = engine.apply_batch(self.doc, [{"op": "set", "id": "0", "p": {"kids": ["2", "1"]}}], by="u")
        self.assertEqual(doc["items"]["0"]["kids"], ["2", "1"])
        with self.assertRaises(engine.OpError):
            engine.apply_batch(self.doc, [{"op": "set", "id": "0", "p": {"kids": ["1", "3"]}}], by="u")

    def test_delete_column_deletes_kids_and_inverse_restores_order(self):
        doc, inv, _ = engine.apply_batch(self.doc, [{"op": "del", "id": "0"}], by="u")
        self.assertEqual(sorted(doc["items"]), ["3"])
        back, _, _ = engine.apply_batch(doc, inv, by="u")
        self.assertEqual(back["items"], self.doc["items"])

    def test_delete_kid_inverse_restores_position(self):
        doc, inv, _ = engine.apply_batch(self.doc, [{"op": "del", "id": "1"}], by="u")
        self.assertEqual(doc["items"]["0"]["kids"], ["2"])
        back, _, _ = engine.apply_batch(doc, inv, by="u")
        self.assertEqual(back["items"]["0"]["kids"], ["1", "2"])


class BulkDeleteTest(unittest.TestCase):
    """Delete-all lists every id; cascaded ids must be no-ops, and one undo restores everything."""

    def doc(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$c1", "item": {"k": "col", "x": 0, "y": 0, "title": "A"}},
            {"op": "add", "ref": "$c2", "item": {"k": "col", "x": 400, "y": 0, "title": "B"}},
            {"op": "add", "ref": "$k1", "item": {"k": "card", "text": "one", "in": "$c1"}},
            {"op": "add", "ref": "$k2", "item": {"k": "card", "text": "two", "in": "$c1"}},
            {"op": "add", "ref": "$k3", "item": {"k": "card", "text": "three", "in": "$c2"}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "x": 0, "y": 500, "title": "free"}},
            {"op": "add", "ref": "$s1", "item": {"k": "draw", "x": 10, "y": 10, "w": 20, "h": 20, "d": "0,0 10,10", "g": "g1"}},
            {"op": "add", "ref": "$s2", "item": {"k": "draw", "x": 50, "y": 10, "w": 20, "h": 20, "d": "0,0 10,10", "g": "g1"}},
            {"op": "add", "item": {"k": "line", "a": "$c1", "b": "$b"}},
            {"op": "add", "item": {"k": "line", "a": "$k3", "b": "$b"}},
            {"op": "add", "item": {"k": "line", "a": "$k1", "b": "$k3"}},
        ], by="u")
        return doc

    def test_delete_all_in_any_order_and_one_undo_restores(self):
        import random
        base = self.doc()
        all_ids = list(base["items"])
        orders = [all_ids, list(reversed(all_ids))]
        rng = random.Random(7)
        for _ in range(20):
            o = all_ids[:]
            rng.shuffle(o)
            orders.append(o)
        for order in orders:
            doc, inv, _, fwd = engine.apply_batch_ex(copy.deepcopy(base), [{"op": "del", "id": i} for i in order])
            self.assertEqual(doc["items"], {})
            back, _, _ = engine.apply_batch(doc, inv)
            self.assertEqual(back["items"], base["items"], order)
            puts = [o["id"] for o in inv if o["op"] == "put"]
            self.assertEqual(len(puts), len(set(puts)), "no duplicate puts")
            replay, _, _ = engine.apply_batch(copy.deepcopy(base), fwd)
            self.assertEqual(replay["items"], {})

    def test_duplicate_and_cascaded_ids_are_noops_but_unknown_still_fails(self):
        base = self.doc()
        doc, _, _ = engine.apply_batch(copy.deepcopy(base), [
            {"op": "del", "id": "0"}, {"op": "del", "id": "2"}, {"op": "del", "id": "0"}])
        self.assertNotIn("0", doc["items"])
        self.assertNotIn("2", doc["items"])
        with self.assertRaises(engine.OpError):
            engine.apply_batch(copy.deepcopy(base), [{"op": "del", "id": "0"}, {"op": "del", "id": "zz"}])


class InverseRoundTripTest(unittest.TestCase):
    def test_every_batch_inverse_restores_items(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$a", "item": {"k": "todo", "x": 0, "y": 0, "title": "T",
                                                "items": [{"t": "a"}, {"t": "b", "done": True}]}},
            {"op": "add", "item": {"k": "frame", "x": -100, "y": -100, "w": 600, "h": 400, "title": "F"}},
        ], by="h")
        before = copy.deepcopy(doc)
        doc2, inv, _ = engine.apply_batch(doc, [
            {"op": "set", "id": "0", "p": {"items": [{"t": "a", "done": True}], "title": "T2"}},
            {"op": "del", "id": "1"},
            {"op": "add", "item": {"k": "text", "x": 1, "y": 1, "text": "hello", "size": "h"}},
            {"op": "board", "p": {"name": "Renamed"}},
        ], by="u")
        self.assertEqual(doc2["name"], "Renamed")
        back, _, _ = engine.apply_batch(doc2, inv, by="u")
        self.assertEqual(back["items"], before["items"])
        self.assertEqual(back["name"], "Launch")


class ForwardReplayTest(unittest.TestCase):
    def test_forward_ops_replay_to_the_same_document(self):
        base, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "ref": "$c", "item": {"k": "col", "x": 0, "y": 0, "title": "C"}},
            {"op": "add", "item": {"k": "card", "x": 400, "y": 0, "text": "loose"}},
        ], by="u")
        batch = [
            {"op": "add", "ref": "$a", "item": {"k": "card", "in": "0", "text": "kid"}},
            {"op": "add", "item": {"k": "card", "text": "auto placed"}},
            {"op": "set", "id": "1", "p": {"in": "0"}, "at": 0},
            {"op": "add", "item": {"k": "line", "a": "$a", "b": [10, 20]}},
            {"op": "set", "id": "$a", "p": {"text": "kid!", "tags": ["x"]}},
            {"op": "del", "id": "1"},
            {"op": "board", "p": {"name": "Next"}},
        ]
        after, _, _, fwd = engine.apply_batch_ex(base, batch, by="h")
        self.assertTrue(all(op["op"] in ("put", "set", "del", "board") for op in fwd))
        self.assertFalse(any(isinstance(v, str) and v.startswith("$") for op in fwd for v in op.values()))
        replayed, _, _ = engine.apply_batch(base, fwd, by="h")
        self.assertEqual(replayed["items"], after["items"])
        self.assertEqual(replayed["name"], "Next")


class AutoPlaceTest(unittest.TestCase):
    def test_items_without_position_go_right_of_existing_content(self):
        doc, _, _ = engine.apply_batch(blank(), [
            {"op": "add", "item": {"k": "card", "x": 0, "y": 0, "w": 200, "text": "a"}},
            {"op": "add", "item": {"k": "card", "text": "b"}},
            {"op": "add", "item": {"k": "card", "text": "c"}},
        ], by="h")
        b, c = doc["items"]["1"], doc["items"]["2"]
        self.assertGreaterEqual(b["x"], 200)
        self.assertEqual(b["x"], c["x"])
        self.assertGreater(c["y"], b["y"])


if __name__ == "__main__":
    unittest.main()
