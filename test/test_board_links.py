import base64
import json
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import assets, fetch, links, urls

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


class UrlClassificationTest(unittest.TestCase):
    CASES = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", {"kind": "video", "p": "youtube", "id": "dQw4w9WgXcQ"}),
        ("https://youtu.be/dQw4w9WgXcQ?si=abc", {"kind": "video", "p": "youtube", "id": "dQw4w9WgXcQ"}),
        ("https://youtube.com/shorts/abcdefghijk", {"kind": "video", "p": "youtube", "id": "abcdefghijk", "vert": True}),
        ("https://m.youtube.com/embed/abcdefghijk", {"kind": "video", "p": "youtube", "id": "abcdefghijk"}),
        ("https://www.youtube.com/live/abcdefghijk", {"kind": "video", "p": "youtube", "id": "abcdefghijk"}),
        ("https://vimeo.com/76979871", {"kind": "video", "p": "vimeo", "id": "76979871"}),
        ("https://player.vimeo.com/video/76979871?h=1", {"kind": "video", "p": "vimeo", "id": "76979871"}),
        ("https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184", {"kind": "video", "p": "loom", "id": "0281766fa2d04bb788eaf19e65135184"}),
        ("https://x.com/NousResearch/status/1862000000000000000", {"kind": "video", "p": "x", "id": "1862000000000000000"}),
        ("https://twitter.com/a/status/123?s=20", {"kind": "video", "p": "x", "id": "123"}),
        ("https://cdn.example.com/clips/demo.MP4?sig=1", {"kind": "file-video"}),
        ("https://example.com/a/b.webm", {"kind": "file-video"}),
        ("https://example.com/pic.JPEG", {"kind": "image"}),
        ("https://example.com/docs", {"kind": "page"}),
        ("https://www.youtube.com/watch?v=short", {"kind": "page"}),
        ("https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ", {"kind": "page"}),
        ("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", {"kind": "page"}),
    ]

    def test_table(self):
        for url, want in self.CASES:
            self.assertEqual(urls.classify(url), want, url)

    def test_rejects_non_http(self):
        for url in ("javascript:alert(1)", "file:///etc/passwd", "ftp://x/y", "", "notaurl", "data:text/html,hi"):
            self.assertIsNone(urls.classify(url), url)

    def test_table_matches_the_ts_fixture(self):
        fixture = Path(__file__).with_name("fixtures") / "url-cases.json"
        cases = json.loads(fixture.read_text())
        for url, want in cases:
            self.assertEqual(urls.classify(url), want, url)


class AddressPolicyTest(unittest.TestCase):
    def test_public_and_private_addresses(self):
        for ip in ("8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"):
            self.assertTrue(fetch.is_public_ip(ip), ip)
        for ip in ("127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1",
                   "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1",
                   "::ffff:10.0.0.1", "2002:7f00:0001::", "64:ff9b::7f00:1", "::", "198.18.0.1"):
            self.assertFalse(fetch.is_public_ip(ip), ip)


class FakeNet:
    """Resolver + transport doubles: hosts map to IPs, (ip, path) to responses."""

    def __init__(self, dns, pages):
        self.dns, self.pages, self.calls = dns, pages, []

    def resolve(self, host, port):
        if host not in self.dns:
            raise OSError("nxdomain")
        return list(self.dns[host])

    def transport(self, scheme, ip, port, host, target, headers, timeout, max_bytes):
        self.calls.append((scheme, ip, host, target))
        status, hdrs, body = self.pages[(host, target)]
        return status, {k.lower(): v for k, v in hdrs.items()}, body[: max_bytes + 1]


def make_fetcher(net):
    return fetch.Fetcher(resolver=net.resolve, transport=net.transport)


class FetcherTest(unittest.TestCase):
    def test_fetches_public_html_pinned_to_resolved_ip(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]},
                      {("ex.com", "/a"): (200, {"Content-Type": "text/html; charset=utf-8"}, b"<title>Hi</title>")})
        res = make_fetcher(net).get("https://ex.com/a", "html")
        self.assertEqual(res.body, b"<title>Hi</title>")
        self.assertEqual(net.calls, [("https", "93.184.216.34", "ex.com", "/a")])

    def test_blocks_private_resolution_even_if_one_address_is_public(self):
        net = FakeNet({"rebind.ex": ["93.184.216.34", "127.0.0.1"]}, {})
        with self.assertRaises(fetch.FetchError) as cm:
            make_fetcher(net).get("http://rebind.ex/", "html")
        self.assertEqual(cm.exception.code, "blocked")
        self.assertEqual(net.calls, [])

    def test_blocks_ip_literals_and_bad_schemes_ports_credentials(self):
        f = make_fetcher(FakeNet({}, {}))
        for url in ("http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data",
                    "file:///etc/passwd", "gopher://ex.com/", "http://user:pw@ex.com/", "http://ex.com:22/",
                    "http://2130706433/", "http://0x7f.1/"):
            with self.assertRaises(fetch.FetchError, msg=url):
                f.get(url, "html")

    def test_redirect_to_private_is_blocked(self):
        net = FakeNet({"ex.com": ["93.184.216.34"], "internal.ex": ["10.1.2.3"]},
                      {("ex.com", "/r"): (302, {"Location": "http://internal.ex/admin"}, b"")})
        with self.assertRaises(fetch.FetchError) as cm:
            make_fetcher(net).get("https://ex.com/r", "html")
        self.assertEqual(cm.exception.code, "blocked")

    def test_redirects_are_capped_at_three(self):
        pages = {("ex.com", f"/{i}"): (301, {"Location": f"/{i + 1}"}, b"") for i in range(5)}
        net = FakeNet({"ex.com": ["93.184.216.34"]}, pages)
        with self.assertRaises(fetch.FetchError) as cm:
            make_fetcher(net).get("https://ex.com/0", "html")
        self.assertEqual(cm.exception.code, "redirects")
        self.assertEqual(len(net.calls), 4)

    def test_relative_redirect_followed(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {
            ("ex.com", "/old"): (301, {"Location": "/new?q=1"}, b""),
            ("ex.com", "/new?q=1"): (200, {"Content-Type": "text/html"}, b"ok")})
        res = make_fetcher(net).get("https://ex.com/old", "html")
        self.assertEqual(res.url, "https://ex.com/new?q=1")

    def test_content_type_gate(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {
            ("ex.com", "/bin"): (200, {"Content-Type": "application/octet-stream"}, b"\x00" * 10)})
        with self.assertRaises(fetch.FetchError) as cm:
            make_fetcher(net).get("https://ex.com/bin", "html")
        self.assertEqual(cm.exception.code, "type")

    def test_image_over_cap_fails_html_over_cap_truncates(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {
            ("ex.com", "/big.png"): (200, {"Content-Type": "image/png"}, b"\x89PNG" + b"0" * 100),
            ("ex.com", "/big"): (200, {"Content-Type": "text/html"}, b"<p>" + b"x" * 100)})
        f = make_fetcher(net)
        with self.assertRaises(fetch.FetchError) as cm:
            f.get("https://ex.com/big.png", "image", max_bytes=50)
        self.assertEqual(cm.exception.code, "size")
        self.assertEqual(len(f.get("https://ex.com/big", "html", max_bytes=50).body), 50)

    def test_http_errors(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {("ex.com", "/x"): (404, {"Content-Type": "text/html"}, b"")})
        with self.assertRaises(fetch.FetchError) as cm:
            make_fetcher(net).get("https://ex.com/x", "html")
        self.assertEqual(cm.exception.code, "http")


class MetaParseTest(unittest.TestCase):
    HTML = b"""<html><head>
      <title> Fallback  title </title>
      <meta property="og:title" content="Build a dashboard plugin">
      <meta name="twitter:description" content="tw desc">
      <meta property="og:description" content="Widgets, settings and the SDK.">
      <meta property="og:site_name" content="Hermes Docs">
      <meta property="og:image" content="/img/card.png">
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel="alternate" type="application/json+oembed" href="https://ex.com/oembed?u=1">
    </head><body>ignored</body></html>"""

    def test_open_graph_wins_and_urls_resolve(self):
        meta = links.parse_meta(self.HTML, "https://ex.com/docs/page")
        self.assertEqual(meta["title"], "Build a dashboard plugin")
        self.assertEqual(meta["desc"], "Widgets, settings and the SDK.")
        self.assertEqual(meta["site"], "Hermes Docs")
        self.assertEqual(meta["image"], "https://ex.com/img/card.png")
        self.assertEqual(meta["icon"], "https://ex.com/favicon-32.png")
        self.assertEqual(meta["oembed"], "https://ex.com/oembed?u=1")

    def test_fallbacks(self):
        meta = links.parse_meta(b"<title>Only &amp; title</title><meta name=description content='d'>", "https://ex.com/")
        self.assertEqual(meta["title"], "Only & title")
        self.assertEqual(meta["desc"], "d")
        self.assertNotIn("image", meta)

    def test_rejects_non_http_meta_urls(self):
        meta = links.parse_meta(b'<meta property="og:image" content="javascript:alert(1)">', "https://ex.com/")
        self.assertNotIn("image", meta)

    def test_oembed_parsing(self):
        data = json.dumps({"type": "video", "title": "Demo", "author_name": "Nous", "provider_name": "YouTube",
                           "thumbnail_url": "https://i.ytimg.com/vi/x/hqdefault.jpg", "html": "<iframe>"}).encode()
        self.assertEqual(links.parse_oembed(data), {"title": "Demo", "author": "Nous", "site": "YouTube",
                                                    "image": "https://i.ytimg.com/vi/x/hqdefault.jpg"})
        tweet = json.dumps({"author_name": "Nous Research", "provider_name": "Twitter",
                            "html": '<blockquote><p lang="en">Hermes 1.8 &amp; boards <a href="x">pic</a></p>&mdash; Nous</blockquote>'}).encode()
        self.assertEqual(links.parse_oembed(tweet)["text"], "Hermes 1.8 & boards pic")
        self.assertEqual(links.parse_oembed(b"not json"), {})
        self.assertEqual(links.parse_oembed(b'{"thumbnail_url":"file:///x"}'), {})


class AssetsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = assets.AssetStore(Path(self.tmp.name) / "assets")

    def tearDown(self):
        self.tmp.cleanup()

    def test_png_roundtrip_content_addressed(self):
        aid = self.store.put_bytes(PNG_1x1)
        self.assertRegex(aid, r"^[a-f0-9]{16}\.png$")
        self.assertEqual(self.store.put_bytes(PNG_1x1), aid)
        mime, data = self.store.get(aid)
        self.assertEqual((mime, data), ("image/png", PNG_1x1))
        self.assertEqual(assets.image_size(PNG_1x1), (1, 1))

    def test_rejects_svg_html_and_garbage_as_images(self):
        for data in (b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
                     b"<html><script>x</script>", b"GIF8", b""):
            with self.assertRaises(assets.AssetError):
                self.store.put_bytes(data)

    def test_base64_upload_caps(self):
        b64 = base64.b64encode(PNG_1x1).decode()
        self.assertTrue(self.store.put_b64(b64).endswith(".png"))
        with self.assertRaises(assets.AssetError):
            self.store.put_b64("A" * (assets.MAX_IMAGE * 2))
        with self.assertRaises(assets.AssetError):
            self.store.put_b64("not base64 !!!")

    def test_html_assets(self):
        aid = self.store.put_html("<h1>hi</h1><script>1</script>")
        self.assertTrue(aid.endswith(".html"))
        self.assertEqual(self.store.get(aid)[0], "text/html")
        with self.assertRaises(assets.AssetError):
            self.store.put_html("x" * (assets.MAX_HTML + 1))

    def test_get_validates_ids(self):
        for bad in ("../../etc/passwd", "0123456789abcdef.svg", "x"):
            with self.assertRaises(assets.AssetError):
                self.store.get(bad)


class PreviewTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.assets = assets.AssetStore(root / "assets")
        self.cache = root / "links"

    def tearDown(self):
        self.tmp.cleanup()

    def test_page_preview_stores_image_and_icon_as_assets(self):
        html = MetaParseTest.HTML
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {
            ("ex.com", "/docs/page"): (200, {"Content-Type": "text/html"}, html),
            ("ex.com", "/img/card.png"): (200, {"Content-Type": "image/png"}, PNG_1x1),
            ("ex.com", "/favicon-32.png"): (200, {"Content-Type": "image/png"}, PNG_1x1),
            ("ex.com", "/oembed?u=1"): (200, {"Content-Type": "application/json"}, b'{"title":"ignored, og wins"}'),
        })
        out = links.preview("https://ex.com/docs/page", make_fetcher(net), self.assets, self.cache, now=100)
        self.assertEqual(out["st"], "ok")
        self.assertEqual(out["title"], "Build a dashboard plugin")
        self.assertRegex(out["img"], r"\.png$")
        self.assertRegex(out["icon"], r"\.png$")
        cached = links.preview("https://ex.com/docs/page", make_fetcher(FakeNet({}, {})), self.assets, self.cache, now=200)
        self.assertEqual(cached["title"], out["title"])

    def test_youtube_uses_provider_oembed_and_thumbnail(self):
        oembed = json.dumps({"title": "Demo", "author_name": "Nous", "provider_name": "YouTube",
                             "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}).encode()
        net = FakeNet({"www.youtube.com": ["142.250.1.1"], "i.ytimg.com": ["142.250.1.2"]}, {
            ("www.youtube.com", "/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ"):
                (200, {"Content-Type": "application/json"}, oembed),
            ("i.ytimg.com", "/vi/dQw4w9WgXcQ/hqdefault.jpg"): (200, {"Content-Type": "image/png"}, PNG_1x1),
        })
        out = links.preview("https://youtu.be/dQw4w9WgXcQ", make_fetcher(net), self.assets, self.cache, now=1)
        self.assertEqual(out["video"], {"p": "youtube", "id": "dQw4w9WgXcQ"})
        self.assertEqual(out["title"], "Demo")
        self.assertEqual(out["site"], "YouTube")
        self.assertTrue(out["img"].endswith(".png"))

    def test_failure_is_clean_and_cached_briefly(self):
        out = links.preview("https://nowhere.example/x", make_fetcher(FakeNet({}, {})), self.assets, self.cache, now=1)
        self.assertEqual(out["st"], "fail")
        self.assertEqual(out["site"], "nowhere.example")
        self.assertNotIn("title", out)

    def test_image_url_becomes_asset(self):
        net = FakeNet({"ex.com": ["93.184.216.34"]}, {("ex.com", "/p.png"): (200, {"Content-Type": "image/png"}, PNG_1x1)})
        out = links.preview("https://ex.com/p.png", make_fetcher(net), self.assets, self.cache, now=1)
        self.assertEqual(out["kind"], "image")
        self.assertEqual((out["iw"], out["ih"]), (1, 1))


if __name__ == "__main__":
    unittest.main()
