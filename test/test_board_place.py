import json
import random
import unittest
from pathlib import Path

from dashboard.boardkit import engine, place

CASES = json.loads((Path(__file__).parent / "fixtures" / "place-cases.json").read_text())


class SharedFixturesTest(unittest.TestCase):
    def test_estimates(self):
        for c in CASES["estimate"]:
            self.assertEqual(place.estimate_size(c["item"]), c["expect"], c["name"])

    def test_free_spots(self):
        for c in CASES["free"]:
            got = place.free_place(c["want"], c["size"], c["obstacles"], c.get("gap", place.PLACE_GAP), c.get("within"))
            self.assertEqual(got, c["expect"], c["name"])

    def test_batches(self):
        for c in CASES["batch"]:
            self.assertEqual(place.place_batch(c["sizes"], c["want"], c["obstacles"]), c["expect"], c["name"])

    def test_resolve(self):
        for c in CASES["resolve"]:
            self.assertEqual(place.resolve_plan(c["entries"]), c["expect"], c["name"])

    def test_push(self):
        for c in CASES["push"]:
            self.assertEqual(place.push_plan(c["entries"], c["grown"]), c["expect"], c["name"])

    def test_default_sizes_are_the_engines(self):
        self.assertEqual(place.SIZES, engine.DEFAULT_SIZE)
        self.assertEqual(place.SHAPES, engine.SHAPE_SIZE)


def boxes(r, n, span):
    return [{"x": round(r.random() * span), "y": round(r.random() * span),
             "w": 60 + round(r.random() * 300), "h": 40 + round(r.random() * 300)} for _ in range(n)]


class PropertiesTest(unittest.TestCase):
    def test_a_placed_item_never_collides(self):
        r = random.Random(7)
        for i in range(60):
            obs = boxes(r, 1 + round(r.random() * 40), 1500)
            size = {"w": 60 + round(r.random() * 400), "h": 40 + round(r.random() * 500)}
            p = place.free_place({"x": round(r.random() * 1500), "y": round(r.random() * 1500)}, size, obs)
            for o in obs:
                self.assertFalse(place.collides({**p, **size}, o, 24), i)

    def test_resolve_leaves_nothing_overlapping_and_is_stable(self):
        r = random.Random(3)
        for i in range(40):
            entries = [{"id": "i%02d" % k, "rect": b, "anchored": k % 7 == 0} for k, b in enumerate(boxes(r, 25, 900))]
            moves = {m["id"]: m for m in place.resolve_plan(entries)}
            after = [{**e, "rect": {**e["rect"], "x": moves[e["id"]]["x"], "y": moves[e["id"]]["y"]} if e["id"] in moves else e["rect"]}
                     for e in entries]
            for a in range(len(after)):
                for b in range(a + 1, len(after)):
                    if after[a]["anchored"] and after[b]["anchored"]:
                        continue
                    self.assertFalse(place.overlaps(after[a]["rect"], after[b]["rect"]), (i, after[a]["id"], after[b]["id"]))
            self.assertEqual(place.resolve_plan(after), [], i)


class MediaShapeTest(unittest.TestCase):
    def test_image_card_height(self):
        self.assertEqual(place.estimate_size({"k": "image", "w": 372, "iw": 1600, "ih": 900})["h"], 230)
        self.assertEqual(place.estimate_size({"k": "image", "w": 372, "iw": 1600, "ih": 900, "cap": "x"})["h"], 246)

    def test_stage_ratio_clamps(self):
        self.assertEqual(place.stage_ratio({"iw": 5000, "ih": 100}), 2.4)
        self.assertEqual(place.stage_ratio({"iw": 100, "ih": 5000}), 0.5)
        self.assertEqual(place.stage_ratio({"video": {"p": "youtube", "id": "x", "vert": True}}), 9 / 16)


if __name__ == "__main__":
    unittest.main()
