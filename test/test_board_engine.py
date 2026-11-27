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
