import json
import os
import shutil
import struct
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit import assets as assets_mod
from dashboard.boardkit import engine, importer, mesh
from dashboard.boardkit.fetch import Fetcher
from dashboard.boardkit.service import BoardService


def offline_fetcher():
    def resolver(host, port):
        raise OSError("offline")
    return Fetcher(resolver=resolver, transport=lambda *a: (_ for _ in ()).throw(OSError("offline")))


def png(w=64, h=40, color=(30, 90, 160)):
    from PIL import Image
    import io
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def cube_stl(path: Path, size=10.0):
    s = size
    v = [(0, 0, 0), (s, 0, 0), (s, s, 0), (0, s, 0), (0, 0, s), (s, 0, s), (s, s, s), (0, s, s)]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5),
         (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    data = b"\0" * 80 + struct.pack("<I", len(f))
    for a, b, c in f:
        data += struct.pack("<12fH", 0, 0, 0, *v[a], *v[b], *v[c], 0)
    path.write_bytes(data)
    return v, f


class ImportBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name).resolve()
        self.home = base / "home"
        self.home.mkdir()
        self.old_home = os.environ.get("HOME")
        os.environ["HOME"] = str(self.home)
        self.svc = BoardService(base / "boards", fetcher=offline_fetcher())
        self.agent = agent_mod.BoardAgent(self.svc)
        self.bid = json.loads(self.agent.board_read({"board": "t", "create": True}, session_id="s"))["board"]
        self.proj = self.home / "proj"
        self.proj.mkdir()

    def tearDown(self):
        if self.old_home is None:
            os.environ.pop("HOME", None)
        else:
            os.environ["HOME"] = self.old_home
        self.tmp.cleanup()

    def apply(self, ops):
        return json.loads(self.agent.board_apply({"ops": ops}, session_id="s"))

    def items(self):
        return self.svc.store.load(self.bid)["items"]


class ImportTest(ImportBase):
    def test_images_glob_copied_never_linked_on_a_grid(self):
        (self.proj / "av").mkdir()
        for i in range(1, 8):
            (self.proj / "av" / f"r{i:02d}_heroe.png").write_bytes(png(80 + i, 50, (10 * i, 50, 90)))
        (self.proj / "av" / "other.png").write_bytes(png())
        out = self.apply([{"op": "import", "paths": ["~/proj/av/*_heroe*.png"]}])
        self.assertEqual(len(out["imported"]), 7)
        self.assertEqual([r["file"] for r in out["imported"]], [f"r{i:02d}_heroe.png" for i in range(1, 8)])
        items = self.items()
        self.assertEqual(len(items), 7)
        xs, ys = set(), set()
        for r in out["imported"]:
            it = items[r["id"]]
            self.assertEqual(it["k"], "image")
            self.assertEqual(it["by"], "h")
            self.assertTrue(it["cap"].endswith("_heroe"))
            self.assertTrue((self.svc.assets.root / it["asset"]).is_file())
            self.assertNotIn("proj", json.dumps(it))
            self.assertEqual(it["x"] % 24, 0)
            self.assertEqual(it["y"] % 24, 0)
            xs.add(it["x"]), ys.add(it["y"])
        self.assertGreater(len(xs), 1)
        self.assertGreater(len(ys), 1)
        self._assert_no_overlap(items)

    def _assert_no_overlap(self, items):
        rects = []
        for iid, it in items.items():
            w, h = engine.DEFAULT_SIZE[it["k"]]
            w = it.get("w") or w
            if it["k"] == "image" and it.get("iw"):
                h = it.get("h") or (w - 14) * it["ih"] / it["iw"] + 50
            else:
                h = it.get("h") or h
            rects.append((iid, it["x"], it["y"], w, h))
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                self.assertFalse(a[1] < b[1] + b[3] and a[1] + a[3] > b[1] and a[2] < b[2] + b[4] and a[2] + a[4] > b[2],
                                 f"{a} overlaps {b}")

    def test_only_hermes_may_import(self):
        (self.proj / "a.png").write_bytes(png())
        with self.assertRaises(engine.OpError):
            self.svc.commit(self.bid, [{"op": "import", "paths": ["~/proj/a.png"]}], by="u")

    def test_refuses_hidden_secrets_outside_home_and_symlinks(self):
        (self.home / ".ssh").mkdir()
        (self.home / ".ssh" / "pic.png").write_bytes(png())
        (self.proj / ".env").write_text("A=1")
        (self.proj / "secrets.json").write_text("{}")
        (self.proj / "credentials.md").write_text("x")
        (self.proj / "ok.png").write_bytes(png())
        outside = Path(self.tmp.name) / "outside.png"
        outside.write_bytes(png())
        (self.proj / "link.png").symlink_to(outside)
        (self.proj / "hidelink.png").symlink_to(self.home / ".ssh" / "pic.png")
        out = self.apply([{"op": "import", "paths": [
            "~/.ssh/pic.png", "~/proj/.env", "~/proj/secrets.json", "~/proj/credentials.md", str(outside),
            "~/proj/link.png", "~/proj/hidelink.png", "/etc/passwd", "~/proj/ok.png"]}])
        self.assertEqual([r["file"] for r in out["imported"]], ["ok.png"])
        reasons = {s["path"]: s["reason"] for s in out["skipped"]}
        self.assertEqual(len(out["skipped"]), 8)
        self.assertTrue(all(r for r in reasons.values()))
        self.assertEqual(len(self.items()), 1)

    def test_nothing_importable_is_an_error_with_reasons(self):
        (self.proj / ".env").write_text("A=1")
        out = self.apply([{"op": "import", "paths": ["~/proj/.env"]}])
        self.assertIn("error", out)
        self.assertIn("hidden", out["error"])
        self.assertEqual(self.items(), {})

    def test_folder_is_flat_and_capped(self):
        d = self.proj / "many"
        d.mkdir()
        for i in range(12):
            (d / f"p{i:02d}.png").write_bytes(png(40 + i, 40, (i * 9, 60, 60)))
        (d / "sub").mkdir()
        (d / "sub" / "deep.png").write_bytes(png())
        (d / "bin.dat").write_bytes(b"\0\1\2")
        out = self.apply([{"op": "import", "paths": ["~/proj/many"], "limit": 5}])
        self.assertEqual(len(out["imported"]), 5)
        self.assertTrue(any("over the 5-file limit" in s["reason"] for s in out["skipped"]))
        out2 = self.apply([{"op": "import", "paths": ["~/proj/many/**/*.png"], "limit": 100, "layout": "column"}])
        self.assertEqual(len(out2["imported"]), 13)
        ids = [r["id"] for r in out2["imported"]]
        xs = {self.items()[i]["x"] for i in ids}
        self.assertEqual(len(xs), 1)

    def test_big_image_is_downscaled(self):
        from PIL import Image
        import io
        buf = io.BytesIO()
        import random
        random.seed(1)
        im = Image.effect_noise((3200, 1800), 120).convert("RGB")
        im.save(buf, "PNG")
        (self.proj / "huge.png").write_bytes(buf.getvalue())
        out = self.apply([{"op": "import", "paths": ["~/proj/huge.png"]}])
        row = out["imported"][0]
        it = self.items()[row["id"]]
        self.assertLessEqual(max(it["iw"], it["ih"]), importer.MAX_SIDE)
        self.assertEqual(row["note"], "downscaled")
        self.assertLessEqual((self.svc.assets.root / it["asset"]).stat().st_size, assets_mod.MAX_IMAGE)

    def test_svg_rasterised_and_scripts_refused(self):
        (self.proj / "a.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">'
                                         '<rect width="120" height="60" fill="#369"/></svg>')
        (self.proj / "evil.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
        (self.proj / "ext.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xlink">'
                                           '<image x:href="file:///etc/passwd"/></svg>')
        out = self.apply([{"op": "import", "paths": ["~/proj/a.svg", "~/proj/evil.svg", "~/proj/ext.svg"]}])
        if shutil.which("ffmpeg"):
            self.assertEqual([r["file"] for r in out["imported"]], ["a.svg"])
            it = self.items()[out["imported"][0]["id"]]
            self.assertTrue(it["asset"].endswith(".png"))
        self.assertIn("evil.svg", json.dumps(out))
        self.assertNotIn("evil.svg", [r["file"] for r in out.get("imported", [])])
        self.assertNotIn("ext.svg", [r["file"] for r in out.get("imported", [])])

    @unittest.skipUnless(shutil.which("ffmpeg"), "ffmpeg missing")
    def test_video_gets_poster_and_duration(self):
        import subprocess
        mp4 = self.proj / "walk.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=2",
                        "-pix_fmt", "yuv420p", str(mp4)], check=True)
        (self.proj / "fake.mp4").write_bytes(b"not a video at all, just text")
        out = self.apply([{"op": "import", "paths": ["~/proj/walk.mp4", "~/proj/fake.mp4"]}])
        self.assertEqual([r["file"] for r in out["imported"]], ["walk.mp4"])
        it = self.items()[out["imported"][0]["id"]]
        self.assertEqual(it["k"], "video")
        self.assertTrue(it["asset"].endswith(".mp4"))
        self.assertTrue(it["img"].endswith(".jpg"))
        self.assertAlmostEqual(it["dur"], 2.0, delta=0.5)
        self.assertEqual((it["iw"], it["ih"]), (320, 180))
        self.assertTrue(any(s["path"].endswith("fake.mp4") for s in out["skipped"]))

    def test_pdf_keeps_original_with_a_thumbnail_or_a_fallback(self):
        from PIL import Image, ImageDraw
        pg = Image.new("RGB", (400, 560), (250, 250, 250))
        ImageDraw.Draw(pg).text((30, 30), "Manual de armado", fill=(0, 0, 0))
        pg.save(self.proj / "manual.pdf", "PDF")
        (self.proj / "fake.pdf").write_bytes(b"hello")
        out = self.apply([{"op": "import", "paths": ["~/proj/manual.pdf", "~/proj/fake.pdf"]}])
        self.assertEqual([r["file"] for r in out["imported"]], ["manual.pdf"])
        it = self.items()[out["imported"][0]["id"]]
        self.assertEqual((it["k"], it["fk"]), ("image", "pdf"))
        self.assertTrue(it["file"].endswith(".pdf"))
        self.assertTrue((self.svc.assets.root / it["file"]).read_bytes().startswith(b"%PDF"))
        mime, data = self.svc.assets.get(it["file"])
        self.assertEqual(mime, "application/pdf")
        if it.get("asset"):  # a renderer / text preview / embedded picture exists here
            self.assertTrue(it["asset"].endswith(".png"))
        else:
            self.assertEqual(out["imported"][0]["thumb"], "none")

    def test_stl_obj_3mf_thumbnails_are_shaded_and_transparent(self):
        v, f = cube_stl(self.proj / "cube.stl")
        (self.proj / "cube.obj").write_text("".join(f"v {a} {b} {c}\n" for a, b, c in v) +
                                            "".join(f"f {a + 1} {b + 1} {c + 1}\n" for a, b, c in f))
        verts = "".join(f'<vertex x="{a}" y="{b}" z="{c}"/>' for a, b, c in v)
        tris = "".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in f)
        import zipfile
        with zipfile.ZipFile(self.proj / "cube.3mf", "w") as z:
            z.writestr("3D/3dmodel.model",
                       '<?xml version="1.0"?><model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
                       f'<resources><object id="1"><mesh><vertices>{verts}</vertices><triangles>{tris}</triangles></mesh>'
                       '</object></resources><build><item objectid="1"/></build></model>')
        (self.proj / "bad.stl").write_bytes(b"solid x\nendsolid x\n")
        out = self.apply([{"op": "import", "paths": ["~/proj/cube.stl", "~/proj/cube.obj", "~/proj/cube.3mf", "~/proj/bad.stl"]}])
        self.assertEqual(len(out["imported"]), 4)
        from PIL import Image
        import io
        by_file = {r["file"]: r for r in out["imported"]}
        for name, fk in (("cube.stl", "stl"), ("cube.obj", "obj"), ("cube.3mf", "3mf")):
            it = self.items()[by_file[name]["id"]]
            self.assertEqual(it["fk"], fk)
            self.assertEqual(by_file[name]["tris"], 12)
            _, data = self.svc.assets.get(it["asset"])
            im = Image.open(io.BytesIO(data))
            self.assertEqual(im.mode, "RGBA")
            self.assertEqual(im.getpixel((0, 0))[3], 0)  # transparent background
            alphas = [im.getpixel((x, im.height // 2))[3] for x in range(im.width)]
            self.assertTrue(any(a == 255 for a in alphas))
            greys = {im.getpixel((x, y))[0] for x in range(0, im.width, 7) for y in range(0, im.height, 7) if im.getpixel((x, y))[3] == 255}
            self.assertGreater(len(greys), 2)  # three visible faces, three shades
        bad = self.items()[by_file["bad.stl"]["id"]]
        self.assertNotIn("asset", bad)
        self.assertIn("no thumbnail", by_file["bad.stl"]["note"])

    def test_text_and_code_become_cards_html_an_untouched_embed(self):
        (self.proj / "n.md").write_text("# Plan\n\n- a\n- b\n")
        (self.proj / "r.py").write_text("print('hi')\n")
        (self.proj / "big.txt").write_text("line\n" * 5000)
        (self.proj / "blob.json").write_bytes(b"\0\0\0binary")
        (self.proj / "p.html").write_text("<h1>hola</h1>")
        out = self.apply([{"op": "import", "paths": ["~/proj/n.md", "~/proj/r.py", "~/proj/big.txt", "~/proj/blob.json", "~/proj/p.html"],
                           "caption": "none"}])
        by = {r["file"]: self.items()[r["id"]] for r in out["imported"]}
        self.assertEqual(set(by), {"n.md", "r.py", "big.txt", "p.html"})
        self.assertEqual(by["n.md"]["text"], "# Plan\n\n- a\n- b")
        self.assertTrue(by["r.py"]["text"].startswith("```python\nprint('hi')"))
        self.assertTrue(by["big.txt"]["text"].endswith("(truncated)"))
        self.assertLessEqual(len(by["big.txt"]["text"]), 12_100)
        self.assertEqual(by["p.html"]["k"], "embed")
        self.assertNotIn("theme", by["p.html"])
        self.assertEqual(out["skipped"][0]["reason"], "binary file")

    def test_captions_none_drops_image_captions(self):
        (self.proj / "a.png").write_bytes(png())
        out = self.apply([{"op": "import", "paths": ["~/proj/a.png"], "caption": "none"}])
        self.assertNotIn("cap", self.items()[out["imported"][0]["id"]])

    def test_into_frame_grows_it_and_into_column_adds_kids(self):
        for i in range(6):
            (self.proj / f"i{i}.png").write_bytes(png(60, 40, (i * 30, 40, 80)))
        r = self.apply([{"op": "add", "ref": "$f", "item": {"k": "frame", "title": "Renders", "x": 480, "y": 240, "w": 480, "h": 200}},
                        {"op": "add", "ref": "$c", "item": {"k": "col", "title": "Col", "x": -400, "y": 0}}])
        fid, cid = r["ids"]["$f"], r["ids"]["$c"]
        self.apply([{"op": "import", "paths": ["~/proj/i0.png", "~/proj/i1.png", "~/proj/i2.png", "~/proj/i3.png"], "into": fid}])
        items = self.items()
        frame = items[fid]
        self.assertGreater(frame["h"], 200)
        for iid, it in items.items():
            if it["k"] == "image":
                self.assertGreaterEqual(it["x"], frame["x"])
                self.assertLessEqual(it["x"] + 320, frame["x"] + frame["w"])
                self.assertGreaterEqual(it["y"], frame["y"] + 48)
                self.assertLessEqual(it["y"] + 130, frame["y"] + frame["h"])
        self.apply([{"op": "import", "paths": ["~/proj/i4.png", "~/proj/i5.png"], "into": cid}])
        self.assertEqual(len(self.items()[cid]["kids"]), 2)

    def test_whole_import_is_one_undo_step_and_one_log_entry(self):
        for i in range(3):
            (self.proj / f"u{i}.png").write_bytes(png(30 + i, 30))
        before = self.svc.store.load(self.bid)
        out = self.apply([{"op": "import", "paths": ["~/proj/u*.png"]}])
        self.assertEqual(out["seq"], before["seq"] + 1)
        entry = self.svc.store.entries(self.bid)[-1]
        doc, inverse, _ = engine.apply_batch(self.svc.store.load(self.bid), [{"op": "del", "id": i["id"]} for i in out["imported"]])
        self.assertEqual(doc["items"], before["items"])
        self.assertEqual(len(entry["ops"]), 3)

    def test_outline_shows_files_and_marks(self):
        (self.proj / "a.png").write_bytes(png())
        self.apply([{"op": "import", "paths": ["~/proj/a.png"]}])
        out = json.loads(self.agent.board_read({"full": True}, session_id="s"))
        self.assertIn("a", out["outline"])


class MeshTest(unittest.TestCase):
    def test_parse_ascii_stl(self):
        txt = b"solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n"
        tri = mesh.parse_stl(txt)
        self.assertEqual(tri.shape, (1, 3, 3))
        r = mesh.render(tri)
        self.assertTrue(r["png"].startswith(b"\x89PNG"))

    def test_refuses_dtd_in_3mf_and_garbage(self):
        import io
        import zipfile
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("3D/3dmodel.model", '<?xml version="1.0"?><!DOCTYPE m [<!ENTITY a "b">]><model/>')
        with self.assertRaises(mesh.MeshError):
            mesh.parse_3mf(buf.getvalue())
        with self.assertRaises(mesh.MeshError):
            mesh.parse_3mf(b"nope")
        with self.assertRaises(mesh.MeshError):
            mesh.parse_obj(b"v 0 0 0\nf 1 2 3\n")


if __name__ == "__main__":
    unittest.main()
