"""Intrinsic media size: what the server stamps on a card so it is the right shape on first paint."""
import struct
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import assets, posters
from dashboard.boardkit.service import BoardService
import base64

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


def jpeg(w, h, orientation=None):
    """A minimal JPEG header: optional EXIF orientation, then a baseline SOF0 of w x h."""
    out = b"\xff\xd8"
    if orientation is not None:
        tiff = b"MM\x00\x2a\x00\x00\x00\x08" + struct.pack(">H", 1) + struct.pack(">HHIHH", 0x0112, 3, 1, orientation, 0) + b"\x00\x00\x00\x00"
        body = b"Exif\x00\x00" + tiff
        out += b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body
    out += b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return out + b"\xff\xd9"


def jpeg_le(w, h, orientation):
    tiff = b"II\x2a\x00\x08\x00\x00\x00" + struct.pack("<H", 1) + struct.pack("<HHIHH", 0x0112, 3, 1, orientation, 0) + b"\x00\x00\x00\x00"
    body = b"Exif\x00\x00" + tiff
    return b"\xff\xd8" + b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body + b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00\xff\xd9"


class ImageSizeTest(unittest.TestCase):
    def test_png(self):
        self.assertEqual(assets.image_size(PNG_1x1), (1, 1))

    def test_jpeg_plain(self):
        self.assertEqual(assets.image_size(jpeg(900, 500)), (900, 500))
        self.assertEqual(assets.image_size(jpeg(900, 500, 1)), (900, 500))

    def test_jpeg_exif_quarter_turn_swaps(self):
        for o in (5, 6, 7, 8):
            self.assertEqual(assets.image_size(jpeg(900, 500, o)), (500, 900), o)
        for o in (2, 3, 4):
            self.assertEqual(assets.image_size(jpeg(900, 500, o)), (900, 500), o)

    def test_jpeg_exif_little_endian(self):
        self.assertEqual(assets.image_size(jpeg_le(900, 500, 6)), (500, 900))
        self.assertEqual(assets.jpeg_orientation(jpeg_le(900, 500, 3)), 3)

    def test_orientation_of_garbage_is_one(self):
        self.assertEqual(assets.jpeg_orientation(b"\xff\xd8\xff\xe1\x00\x08Exif"), 1)
        self.assertEqual(assets.jpeg_orientation(b""), 1)


class VideoSizeTest(unittest.TestCase):
    def info(self, w, h, **extra):
        return {"streams": [{"width": w, "height": h, **extra}]}

    def test_plain(self):
        self.assertEqual(posters.displayed_size(self.info(1920, 1080)), (1920, 1080))

    def test_rotate_tag_swaps(self):
        self.assertEqual(posters.displayed_size(self.info(1920, 1080, tags={"rotate": "90"})), (1080, 1920))
        self.assertEqual(posters.displayed_size(self.info(1920, 1080, tags={"rotate": "180"})), (1920, 1080))

    def test_display_matrix_swaps(self):
        self.assertEqual(posters.displayed_size(self.info(1920, 1080, side_data_list=[{"rotation": -90}])), (1080, 1920))

    def test_unusable(self):
        self.assertIsNone(posters.displayed_size({}))
        self.assertIsNone(posters.displayed_size({"streams": [{"width": 0, "height": 5}]}))


class FillDimsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.svc = BoardService(Path(self.tmp.name))

    def tearDown(self):
        self.tmp.cleanup()

    def test_image_asset_gets_dims_on_add(self):
        aid = self.svc.assets.put_bytes(jpeg(640, 360, 6) + b"\x00" * 8)
        ops, _ = self.svc.prepare([{"op": "add", "item": {"k": "image", "asset": aid}}])
        self.assertEqual((ops[0]["item"]["iw"], ops[0]["item"]["ih"]), (360, 640))

    def test_stated_dims_are_kept(self):
        aid = self.svc.assets.put_bytes(PNG_1x1)
        ops, _ = self.svc.prepare([{"op": "add", "item": {"k": "image", "asset": aid, "iw": 40, "ih": 30}}])
        self.assertEqual((ops[0]["item"]["iw"], ops[0]["item"]["ih"]), (40, 30))

    def test_link_thumbnail_dims(self):
        aid = self.svc.assets.put_bytes(PNG_1x1)
        ops, _ = self.svc.prepare([{"op": "add", "item": {"k": "link", "title": "t", "img": aid}}])
        self.assertEqual((ops[0]["item"]["iw"], ops[0]["item"]["ih"]), (1, 1))

    def test_swapping_the_picture_restamps(self):
        aid = self.svc.assets.put_bytes(PNG_1x1)
        ops, _ = self.svc.prepare([{"op": "set", "id": "a", "p": {"asset": aid}}])
        self.assertEqual((ops[0]["p"]["iw"], ops[0]["p"]["ih"]), (1, 1))

    def test_other_patches_are_left_alone(self):
        ops, _ = self.svc.prepare([{"op": "set", "id": "a", "p": {"cap": "x"}}])
        self.assertEqual(ops[0]["p"], {"cap": "x"})

    def test_link_dims_survive_the_engine(self):
        bid = self.svc.store.create("t")["id"] if hasattr(self.svc.store, "create") else None
        self.assertIsNotNone(bid)
        aid = self.svc.assets.put_bytes(PNG_1x1)
        doc, _ = self.svc.commit(bid, [{"op": "add", "item": {"k": "link", "title": "t", "img": aid, "x": 0, "y": 0}}])
        item = next(iter(doc["items"].values()))
        self.assertEqual((item["iw"], item["ih"]), (1, 1))


if __name__ == "__main__":
    unittest.main()
