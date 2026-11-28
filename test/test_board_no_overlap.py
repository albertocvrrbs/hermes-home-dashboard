"""Every way Hermes adds things to a board lands them clear of what is already there."""
import unittest

from dashboard.boardkit import engine
from dashboard.boardkit import place as place_mod


def solid(doc):
    """id -> the rect each top-level content item covers (the engine's own estimate)."""
    b = engine._Batch(doc, "h")
    out = {}
    for iid, it in doc["items"].items():
        if it["k"] in ("line", "draw", "frame") or it.get("in"):
            continue
        r = b.solid_rect(iid)
        if r:
            out[iid] = r
    return out


def overlapping(doc):
    rs = sorted(solid(doc).items())
    return [(a, b) for i, (a, ra) in enumerate(rs) for b, rb in rs[i + 1:] if place_mod.overlaps(ra, rb, 1)]


def board():
    doc = engine.new_doc("abcd1234", "t", 0)
    ops = [{"op": "add", "item": {"k": "card", "title": f"Nota {i}", "text": "dos renglones de texto para que tenga altura",
                                  "x": (i % 3) * 280, "y": (i // 3) * 160}} for i in range(6)]
    doc, _, _ = engine.apply_batch(doc, ops, "u")
    return doc


class HermesAddTest(unittest.TestCase):
    def test_board_starts_clean(self):
        self.assertEqual(overlapping(board()), [])

    def test_add_without_position_goes_beside_the_content(self):
        doc = board()
        new, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$a", "item": {"k": "image", "asset": "a" * 16 + ".png", "iw": 900, "ih": 1600, "w": 300}},
            {"op": "add", "ref": "$b", "item": {"k": "image", "asset": "b" * 16 + ".png", "iw": 1600, "ih": 900, "w": 372}},
            {"op": "add", "ref": "$c", "item": {"k": "link", "url": "https://example.com", "st": "wait"}},
        ], "h")
        self.assertEqual(overlapping(new), [])

    def test_add_on_top_of_a_card_steps_to_the_nearest_free_spot(self):
        doc = board()
        new, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$v", "item": {"k": "video", "asset": "c" * 16 + ".mp4", "iw": 1280, "ih": 720, "x": 20, "y": 20}},
        ], "h")
        self.assertEqual(overlapping(new), [])
        it = new["items"][refs["$v"]]
        self.assertNotEqual((it["x"], it["y"]), (20, 20))
        # near where it was asked, not at the far end of the board
        self.assertLess(abs(it["x"] - 20) + abs(it["y"] - 20), 900)

    def test_a_free_position_is_kept_exactly(self):
        doc = board()
        new, _, refs = engine.apply_batch(doc, [{"op": "add", "ref": "$n", "item": {"k": "card", "title": "x", "x": 2000, "y": 2000}}], "h")
        self.assertEqual((new["items"][refs["$n"]]["x"], new["items"][refs["$n"]]["y"]), (2000, 2000))

    def test_layout_pieces_and_exact_adds_stay_where_asked(self):
        doc = board()
        new, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$f", "item": {"k": "frame", "title": "Zona", "x": -24, "y": -72, "w": 900, "h": 500}},
            {"op": "add", "ref": "$t", "item": {"k": "text", "text": "Etiqueta", "x": 10, "y": 10}},
            {"op": "add", "ref": "$x", "item": {"k": "card", "title": "a mano", "x": 10, "y": 10}, "exact": True},
        ], "u")
        for ref in ("$f", "$t"):
            self.assertIn(new["items"][refs[ref]]["x"], (-24, 10))
        self.assertEqual((new["items"][refs["$x"]]["x"], new["items"][refs["$x"]]["y"]), (10, 10))

    def test_many_adds_in_one_batch_do_not_land_on_each_other(self):
        doc = board()
        ops = [{"op": "add", "item": {"k": "image", "asset": f"{i:016d}.png", "iw": 400 + 300 * (i % 3), "ih": 600, "x": 100, "y": 100}}
               for i in range(8)]
        new, _, _ = engine.apply_batch(doc, ops, "h")
        self.assertEqual(overlapping(new), [])

    def test_inside_a_frame_it_stays_inside_when_there_is_room(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$f", "item": {"k": "frame", "title": "Z", "x": 0, "y": 0, "w": 1200, "h": 800}},
            {"op": "add", "ref": "$a", "item": {"k": "card", "title": "a", "x": 48, "y": 72}},
        ], "u")
        new, _, r2 = engine.apply_batch(doc, [{"op": "add", "ref": "$b", "item": {"k": "card", "title": "b", "x": 60, "y": 80}}], "h")
        b = new["items"][r2["$b"]]
        self.assertTrue(0 <= b["x"] and b["x"] + 256 <= 1200 and 0 <= b["y"] <= 800, b)
        self.assertEqual(overlapping(new), [])


class BulkPlaceTest(unittest.TestCase):
    def test_place_block_at_an_occupied_spot_moves_as_a_whole(self):
        doc = board()
        items = [{"item": {"k": "image", "asset": f"{i:016d}.png", "iw": 1600, "ih": 900 + 200 * i, "w": 300}} for i in range(5)]
        new, _, _ = engine.apply_batch(doc, [{"op": "place", "items": items, "at": [0, 0]}], "h")
        self.assertEqual(overlapping(new), [])
        placed = [it for it in new["items"].values() if it["k"] == "image"]
        self.assertTrue(all(it["x"] % 24 == 0 and it["y"] % 24 == 0 for it in placed))

    def test_place_without_at_is_unchanged_and_clean(self):
        doc = board()
        items = [{"item": {"k": "card", "title": f"c{i}", "text": "t"}} for i in range(4)]
        new, _, _ = engine.apply_batch(doc, [{"op": "place", "items": items}], "h")
        self.assertEqual(overlapping(new), [])

    def test_zones_never_cover_unmoved_cards(self):
        doc = board()
        new, _, _ = engine.apply_batch(doc, [{"op": "zones", "zones": [{"title": "A", "where": {"text": "Nota 1"}}],
                                              "at": [0, 0]}], "h")
        frames = [engine._Batch(new, "h").rect_of(i) for i, it in new["items"].items() if it["k"] == "frame"]
        unmoved = [r for i, r in solid(new).items() if new["items"][i].get("title") != "Nota 1"]
        for f in frames:
            for r in unmoved:
                self.assertFalse(place_mod.overlaps(f, r, 1))


class InsertOnEdgeTest(unittest.TestCase):
    def test_loose_cards_make_room_for_the_new_step_and_the_flow_stays(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        doc, _, refs = engine.apply_batch(doc, [
            {"op": "add", "ref": "$a", "item": {"k": "box", "title": "A", "x": 0, "y": 0}},
            {"op": "add", "ref": "$b", "item": {"k": "box", "title": "B", "x": 600, "y": 0}},
            {"op": "add", "ref": "$l", "item": {"k": "line", "a": "$a", "b": "$b"}},
            {"op": "add", "ref": "$c", "item": {"k": "card", "title": "suelta", "x": 240, "y": -30}},
        ], "u")
        before = {k: (v.get("x"), v.get("y")) for k, v in doc["items"].items()}
        self.assertEqual(before[refs["$c"]], (240, -30))
        new, _, r2 = engine.apply_batch(doc, [{"op": "insert_on_edge", "edge": refs["$l"], "item": {"k": "box", "title": "N"}}], "h")
        loose = new["items"][refs["$c"]]
        self.assertNotEqual((loose["x"], loose["y"]), before[refs["$c"]])
        self.assertEqual(overlapping(new), [])
        self.assertEqual((new["items"][refs["$a"]]["x"], new["items"][refs["$a"]]["y"]), before[refs["$a"]])


class ResolveOverlapsTest(unittest.TestCase):
    def messy(self):
        doc = engine.new_doc("abcd1234", "t", 0)
        ops = [{"op": "add", "ref": "$f", "item": {"k": "frame", "title": "Z", "x": -48, "y": -96, "w": 1400, "h": 1000}},
               {"op": "add", "ref": "$a", "item": {"k": "box", "title": "A", "x": 0, "y": 0}},
               {"op": "add", "ref": "$b", "item": {"k": "box", "title": "B", "x": 300, "y": 0}},
               {"op": "add", "ref": "$l", "item": {"k": "line", "a": "$a", "b": "$b"}}]
        ops += [{"op": "add", "ref": f"$i{i}", "item": {"k": "image", "asset": f"{i:016d}.png", "iw": 1600, "ih": 900 + 300 * i,
                                                        "w": 300, "x": 40 + 30 * i, "y": 20 + 40 * i}, "exact": True} for i in range(5)]
        ops += [{"op": "add", "ref": f"$c{i}", "item": {"k": "card", "title": f"n{i}", "text": "texto", "x": 100 + 20 * i, "y": 60}, "exact": True}
                for i in range(3)]
        doc, _, refs = engine.apply_batch(doc, ops, "u")
        return doc, refs

    def test_messy_board_comes_out_clean_in_one_batch_and_the_flow_stays(self):
        doc, refs = self.messy()
        self.assertTrue(overlapping(doc))
        new, inv, _ = engine.apply_batch(doc, [{"op": "resolve_overlaps"}], "h")
        bad = [p for p in overlapping(new) if not {new["items"][p[0]]["k"], new["items"][p[1]]["k"]} <= {"box"}]
        self.assertEqual(bad, [])
        for ref in ("$a", "$b"):
            self.assertEqual(new["items"][refs[ref]]["x"], doc["items"][refs[ref]]["x"])
        # one batch: its inverse restores the mess
        back, _, _ = engine.apply_batch(new, inv, "u")
        self.assertEqual(back["items"], doc["items"])

    def test_a_clean_board_is_left_alone(self):
        doc = board()
        new, inv, _ = engine.apply_batch(doc, [{"op": "resolve_overlaps"}], "h")
        self.assertEqual(new["items"], doc["items"])


if __name__ == "__main__":
    unittest.main()
