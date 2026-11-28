import json
import tempfile
import unittest
from pathlib import Path

from dashboard.boardkit import agent as agent_mod
from dashboard.boardkit.embedlint import lint_embed
from dashboard.boardkit.service import BoardService
from test_board_agent import offline_fetcher

GOOD = """<!doctype html><html><head><style>
html,body{margin:0;width:100%;height:100%}
.bars{display:flex;gap:4px}
</style></head><body><svg viewBox="0 0 100 40" style="width:100%"><rect width="10" height="5"/></svg></body></html>"""


class LintTest(unittest.TestCase):
    def test_fluid_embed_is_clean(self):
        self.assertEqual(lint_embed(GOOD), [])

    def test_fixed_body_width(self):
        w = lint_embed("<style>body{width:800px}</style><p>x</p>")
        self.assertEqual(len(w), 1)
        self.assertIn("fixed width", w[0])
        self.assertIn("body", w[0])

    def test_small_fixed_width_and_inner_elements_are_fine(self):
        self.assertEqual(lint_embed("<style>body{width:360px}.card{width:900px}</style>"), [])

    def test_html_attr_and_inline_style_widths(self):
        self.assertTrue(lint_embed('<body style="width: 1024px">hi</body>'))
        self.assertTrue(lint_embed('<body width="900">hi</body>'))

    def test_body_background(self):
        self.assertIn("opaque background", lint_embed("<style>html, body { background: #fff }</style>")[0])
        self.assertIn("opaque background", lint_embed("<style>body{background-color:rgb(0,0,0)}</style>")[0])
        self.assertEqual(lint_embed("<style>body{background:transparent}</style>"), [])
        self.assertEqual(lint_embed("<style>body{background:rgba(0,0,0,0)}.k{background:#fff}</style>"), [])

    def test_root_svg_needs_viewbox(self):
        self.assertIn("viewBox", lint_embed('<svg width="500" height="200"><rect/></svg>')[0])
        self.assertEqual(lint_embed('<svg viewBox="0 0 5 5"><svg width="3"><rect/></svg></svg>'), [])
        self.assertEqual(len(lint_embed('<svg><rect/></svg><svg width="4"></svg>')), 1)

    def test_external_fonts(self):
        self.assertTrue(lint_embed('<link rel="stylesheet" href="https://fonts.googleapis.com/css?x">'))

    def test_non_string(self):
        self.assertEqual(lint_embed(None), [])


class AgentEmbedTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.svc = BoardService(Path(self.tmp.name), fetcher=offline_fetcher())
        self.agent = agent_mod.BoardAgent(self.svc, profile="default")
        self.bid = self.svc.store.create("T")["id"]

    def tearDown(self):
        self.tmp.cleanup()

    def apply(self, ops):
        return json.loads(self.agent.board_apply({"board": self.bid, "ops": ops}, session_id="s"))

    def test_themed_bad_html_warns_but_is_written(self):
        res = self.apply([{"op": "add", "item": {"k": "embed", "theme": True,
                                                  "html": "<style>body{width:900px;background:#fff}</style><svg></svg>"}}])
        self.assertNotIn("error", res)
        self.assertEqual(len(res["warnings"]), 3)
        doc = self.svc.store.load(self.bid)
        item = next(iter(doc["items"].values()))
        self.assertIs(item["theme"], True)

    def test_themed_clean_html_has_no_warnings(self):
        res = self.apply([{"op": "add", "item": {"k": "embed", "theme": True, "html": GOOD}}])
        self.assertNotIn("warnings", res)

    def test_unthemed_html_gets_one_nudge_not_lint(self):
        res = self.apply([{"op": "add", "item": {"k": "embed", "html": "<style>body{width:900px}</style>"}}])
        self.assertEqual(len(res["warnings"]), 1)
        self.assertIn("theme:true", res["warnings"][0])

    def test_set_html_on_themed_item_is_linted(self):
        res = self.apply([{"op": "add", "ref": "$e", "item": {"k": "embed", "theme": True, "html": GOOD}}])
        iid = res["ids"]["$e"]
        res = self.apply([{"op": "set", "id": iid, "p": {"html": "<style>body{width:900px}</style>"}}])
        self.assertIn("fixed width", res["warnings"][0])

    def test_schema_and_hook_carry_the_rules(self):
        desc = agent_mod.SCHEMAS["board_apply"]["description"]
        self.assertIn("theme:true", desc)
        self.assertIn("--chart-1..5", desc)
        self.assertIn("theme:true", agent_mod.EMBED_HOOK)
        out = self.agent.pre_llm_call(session_id="s9", user_message=f"hi [board:{self.bid}]", is_first_turn=True)
        self.assertIn("theme:true", out["context"])

    def test_theme_flag_clears_with_null(self):
        res = self.apply([{"op": "add", "ref": "$e", "item": {"k": "embed", "theme": True, "html": GOOD}}])
        iid = res["ids"]["$e"]
        self.apply([{"op": "set", "id": iid, "p": {"theme": None}}])
        self.assertNotIn("theme", self.svc.store.load(self.bid)["items"][iid])


if __name__ == "__main__":
    unittest.main()
