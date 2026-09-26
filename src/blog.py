"""The back room: an unlisted blog rendered from content/backroom/*.md with giscus comments."""
from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "backroom"
GISCUS = {
    "repo": "805Drone/doesbradpittdie",
    "repo_id": "R_kgDOUsPsTQ",
    "category": "General",
    "category_id": "DIC_kwDOUsPsTc4DGa7A",
}
e = html.escape


def load_posts() -> list[dict]:
    posts = []
    for p in sorted(CONTENT.glob("*.md")):
        raw = p.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, flags=re.S)
        meta: dict = {}
        body = raw
        if m:
            for line in m.group(1).splitlines():
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
            body = m.group(2)
        posts.append(
            {
                "slug": p.stem,
                "title": meta.get("title", p.stem),
                "date": meta.get("date", date.today().isoformat()),
                "summary": meta.get("summary", ""),
                "html": markdown.markdown(body, extensions=["smarty"]),
            }
        )
    posts.sort(key=lambda x: x["date"], reverse=True)
    return posts


def giscus_html(site: str) -> str:
    return (
        '<section class="comments" aria-label="Comments">'
        '<h2 class="comments-h">Leave a note</h2>'
        '<p class="comments-fine">Comments need a GitHub account. They live in the site\'s discussions and appear here.</p>'
        f'<script src="https://giscus.app/client.js" data-repo="{GISCUS["repo"]}" data-repo-id="{GISCUS["repo_id"]}" '
        f'data-category="{GISCUS["category"]}" data-category-id="{GISCUS["category_id"]}" data-mapping="pathname" '
        f'data-strict="0" data-reactions-enabled="1" data-emit-metadata="0" data-input-position="top" '
        f'data-theme="{site}/assets/giscus.css" data-lang="en" data-loading="lazy" crossorigin="anonymous" async></script>'
        "</section>"
    )


def post_html(post: dict, site: str) -> str:
    return f"""<article class="post">
  <p class="page-kicker">The back room &middot; {e(post['date'])}</p>
  <h1 class="page-h">{e(post['title'])}</h1>
  <div class="prose">{post['html']}</div>
  {giscus_html(site)}
  <p class="film-links"><a href="../">All notes</a> <a href="../../">Front of house</a></p>
</article>
"""


def index_html(posts: list[dict], site: str) -> str:
    items = "".join(
        f"<li><a href='{p['slug']}/'><span class='dl-year'>{e(p['date'][:4])}</span><span class='dl-title'>{e(p['title'])}</span><span class='dl-how'>{e(p['summary'])}</span></a></li>"
        for p in posts
    )
    return f"""<section class="about">
  <p class="page-kicker">Unlisted</p>
  <h1 class="page-h">The back room</h1>
  <div class="prose"><p>Notes on the project, the verdicts, and what changed. Nothing here is linked from the front of the site. Each note has a comment thread; say what you like.</p></div>
  <ul class="death-list post-list">{items}</ul>
</section>
"""
