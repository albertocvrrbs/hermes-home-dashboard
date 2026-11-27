import json
import os
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import engine, store as store_mod, summary


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "boards"
        self.store = store_mod.BoardStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_list_load(self):
        doc = self.store.create("Launch")
        self.assertTrue((self.root / f"{doc['id']}.json").exists())
        listed = self.store.list()
        self.assertEqual([b["name"] for b in listed], ["Launch"])
        self.assertEqual(listed[0]["count"], 0)
        self.assertEqual(self.store.load(doc["id"])["name"], "Launch")

    def test_find_by_name_or_id(self):
        doc = self.store.create("Launch Flow")
        self.assertEqual(self.store.find("launch flow")["id"], doc["id"])
        self.assertEqual(self.store.find(doc["id"])["id"], doc["id"])
        self.assertIsNone(self.store.find("nope"))

    def test_invalid_ids_never_touch_the_filesystem(self):
        for bad in ("../../etc/passwd", "..", "a/b", "AAAAAAAA", "k3x9p2q"):
            with self.assertRaises(store_mod.NotFound):
                self.store.load(bad)
            with self.assertRaises(store_mod.NotFound):
                self.store.commit(bad, [], by="u")

    def test_commit_appends_log_and_bumps_seq(self):
        bid = self.store.create("B")["id"]
        doc, entry = self.store.commit(bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "a"}}], by="u")
        self.assertEqual(doc["seq"], 1)
        self.assertEqual(entry["s"], 1)
        self.assertEqual(entry["by"], "u")
        lines = (self.root / f"{bid}.log.jsonl").read_text().splitlines()
        self.assertEqual(json.loads(lines[0])["inv"], [{"op": "del", "id": "0"}])

    def test_failed_batch_changes_nothing(self):
        bid = self.store.create("B")["id"]
        with self.assertRaises(engine.OpError):
            self.store.commit(bid, [{"op": "add", "item": {"k": "nope"}}], by="u")
        self.assertEqual(self.store.load(bid)["seq"], 0)
        self.assertFalse((self.root / f"{bid}.log.jsonl").read_text().strip())

    def test_since_returns_nothing_entries_or_full(self):
        bid = self.store.create("B")["id"]
        self.assertEqual(self.store.since(bid, 0), {"seq": 0})
        for i in range(3):
            self.store.commit(bid, [{"op": "add", "item": {"k": "card", "x": i, "y": 0}}], by="u")
        out = self.store.since(bid, 1)
        self.assertEqual(out["seq"], 3)
        self.assertEqual([e["s"] for e in out["entries"]], [2, 3])
        self.assertNotIn("inv", out["entries"][0])
        self.assertEqual(self.store.since(bid, 3), {"seq": 3})
        self.assertIn("doc", self.store.since(bid, -1))

    def test_log_compaction_falls_back_to_full_doc(self):
        bid = self.store.create("B")["id"]
        old = store_mod.LOG_KEEP
        store_mod.LOG_KEEP = 3
        try:
            for i in range(8):
                self.store.commit(bid, [{"op": "board", "p": {"name": f"n{i}"}}], by="u")
        finally:
            store_mod.LOG_KEEP = old
        lines = (self.root / f"{bid}.log.jsonl").read_text().splitlines()
        self.assertLessEqual(len(lines), 3 + 3)
        self.assertIn("doc", self.store.since(bid, 1))

    def test_undo_applies_the_inverse_as_new_entry(self):
        bid = self.store.create("B")["id"]
        self.store.commit(bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 0}}], by="h", note="added")
        doc, entry = self.store.undo(bid, 1, by="u")
        self.assertEqual(doc["items"], {})
        self.assertEqual(entry["s"], 2)
        self.assertEqual(entry.get("undo"), 1)

    def test_presence_and_session_link(self):
        bid = self.store.create("B")["id"]
        self.store.set_presence(bid, "adding card", on="0", now=50)
        self.assertEqual(self.store.load(bid)["hermes"], {"at": 50, "act": "adding card", "on": "0"})
        self.assertTrue(self.store.link_session(bid, "sess-1", "default"))
        self.assertFalse(self.store.link_session(bid, "sess-2", "default"))
        self.assertEqual(self.store.board_for_session("sess-1"), bid)
        self.assertIsNone(self.store.board_for_session("sess-2"))

    def test_delete_moves_to_trash(self):
        bid = self.store.create("B")["id"]
        self.store.delete(bid)
        self.assertEqual(self.store.list(), [])
        self.assertTrue(any((self.root / ".trash").iterdir()))

    def test_atomic_write_leaves_no_temp_files(self):
        bid = self.store.create("B")["id"]
        self.store.commit(bid, [{"op": "board", "p": {"name": "x"}}], by="u")
        self.assertFalse([p for p in os.listdir(self.root) if p.endswith(".tmp")])


class SummaryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = store_mod.BoardStore(Path(self.tmp.name))
        self.bid = self.store.create("Launch")["id"]

    def tearDown(self):
        self.tmp.cleanup()

    def test_outline_is_one_compact_line_per_item(self):
        doc, _ = self.store.commit(self.bid, [
            {"op": "add", "ref": "$c", "item": {"k": "col", "x": 40, "y": 118, "title": "Ideas"}},
            {"op": "add", "item": {"k": "card", "in": "$c", "title": "Loop", "text": "8-second loop", "tags": ["video"]}},
            {"op": "add", "ref": "$t", "item": {"k": "todo", "x": 0, "y": 600, "title": "Launch", "items": [{"t": "a", "done": True}, {"t": "b"}]}},
            {"op": "add", "item": {"k": "line", "a": "$c", "b": "$t"}},
        ], by="h")
        text = summary.outline(doc)
        self.assertIn('board ' + self.bid + ' "Launch"', text)
        self.assertIn('0 col* @40,118 "Ideas" kids=1', text)
        self.assertIn('1 card* in=0 "Loop" 8-second loop #video', text)
        self.assertIn("2 todo* @0,600", text)
        self.assertIn("1/2", text)
        self.assertIn("3 line* 0->2", text)

    def test_changes_since_reports_only_user_changes_and_collapses(self):
        self.store.commit(self.bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "mine"}}], by="h")
        seen = self.store.load(self.bid)["seq"]
        self.store.commit(self.bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 200, "text": "pin it too"}}], by="u")
        self.store.commit(self.bid, [{"op": "set", "id": "0", "p": {"x": 30}}], by="u")
        self.store.commit(self.bid, [{"op": "set", "id": "0", "p": {"x": 60, "y": 9}}], by="u")
        self.store.commit(self.bid, [{"op": "add", "item": {"k": "card", "x": 0, "y": 0, "text": "hermes again"}}], by="h")
        doc = self.store.load(self.bid)
        text = summary.changes_since(doc, self.store.entries(self.bid), seen)
        self.assertIn('+ card 1 "pin it too"', text)
        self.assertIn("~ 0 moved", text)
        self.assertEqual(text.count("~ 0"), 1)
        self.assertNotIn("hermes again", text)

    def test_changes_since_is_capped(self):
        for i in range(120):
            self.store.commit(self.bid, [{"op": "add", "item": {"k": "card", "x": i, "y": 0, "text": "note number %d with words" % i}}], by="u")
        doc = self.store.load(self.bid)
        text = summary.changes_since(doc, self.store.entries(self.bid), 0, limit=600)
        self.assertLessEqual(len(text), 640)
        self.assertIn("more", text)

    def test_no_changes_gives_empty_string(self):
        doc = self.store.load(self.bid)
        self.assertEqual(summary.changes_since(doc, self.store.entries(self.bid), 0), "")


if __name__ == "__main__":
    unittest.main()
