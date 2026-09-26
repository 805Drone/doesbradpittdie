"""Static site generator for doesbradpittdie.com.

    python src/build.py          # builds into dist/

Reads data/films.json, writes dist/. No dependencies beyond Pillow (OG image).
"""
from __future__ import annotations

import html
import json
import re
import shutil
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SRC = ROOT / "src"
DIST = ROOT / "dist"
SITE = "https://doesbradpittdie.com"
SITE_NAME = "Does Brad Pitt Die?"
BUILD_DATE = date.today().isoformat()


def _hash(name: str) -> str:
    import hashlib

    return hashlib.md5((SRC / "static" / name).read_bytes()).hexdigest()[:8]


CSS_V = _hash("site.css")
JS_V = _hash("site.js")

e = html.escape


# ---------------------------------------------------------------- data
def load_films() -> list[dict]:
    films = json.loads((DATA / "films.json").read_text(encoding="utf-8"))
    films.sort(key=lambda f: (f["year"], f["title"]))
    for i, f in enumerate(films):
        f["prev"] = films[i - 1] if i > 0 else None
        f["next"] = films[i + 1] if i < len(films) - 1 else None
        f["poster"] = f"posters/{f['slug']}.webp" if (DATA / "posters" / f"{f['slug']}.webp").exists() else None
        bd = DATA / "backdrops" / f"{f['slug']}.webp"
        f["backdrop"] = f"backdrops/{f['slug']}.webp" if bd.exists() else None
        f["lqip"] = f"backdrops/{f['slug']}.lqip.webp" if bd.exists() else None
        st = DATA / "stills" / f"{f['slug']}.webp"
        f["still"] = f"stills/{f['slug']}.webp" if st.exists() else None
        f["still_lqip"] = f"stills/{f['slug']}.lqip.webp" if st.exists() else None
    return films


def verdict_key(f: dict) -> str:
    d = f["dies"]
    return "dies" if d is True else "survives" if d is False else "ambiguous"


VERDICT_WORD = {"dies": "Dies", "survives": "Survives", "ambiguous": "It's complicated"}
VERDICT_ANSWER = {"dies": "Yes", "survives": "No", "ambiguous": "Sort of"}
TEASE = {
    "dies": "He does not make it to the credits.",
    "survives": "He is alive when the credits roll.",
    "ambiguous": "It's complicated.",
}
WHEN_TEASE = {
    "early": "It happens early.",
    "midpoint": "It happens around the midpoint.",
    "climax": "It happens at the climax.",
    "ending": "It happens at the very end.",
    "off-screen": "It happens off screen.",
}


def split_verdict(f: dict) -> tuple[str, str]:
    """'Yes. Shot by Ford.' -> ('Yes.', 'Shot by Ford.')"""
    vs = (f.get("verdict_short") or "").strip()
    m = re.match(r"^(.+?[.!?])\s+(.*)$", vs, flags=re.S)
    if m:
        return m.group(1), m.group(2)
    return vs or (VERDICT_ANSWER[verdict_key(f)] + "."), ""


# ---------------------------------------------------------------- layout
def head(title: str, desc: str, path: str, extra: str = "", depth: int = 0, noindex: bool = False) -> str:
    base = "../" * depth
    url = SITE + path
    robots = '<meta name="robots" content="noindex,nofollow">\n' if noindex else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{robots}<meta name="view-transition" content="same-origin">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta property="og:image" content="{SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1a0b10">
<link rel="icon" href="{base}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{base}apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400;1,6..96,500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{base}assets/site.css?v={CSS_V}">
{extra}
</head>
<body data-base="{base}">
<a class="skip" href="#main">Skip to content</a>
<div class="grain" aria-hidden="true"></div>
"""


def header(depth: int = 0) -> str:
    base = "../" * depth
    return f"""<header class="top">
  <a class="wordmark" href="{base}" aria-label="{SITE_NAME} home"><span class="wm-q">Does</span> Brad Pitt <span class="wm-q">die?</span></a>
  <nav class="topnav" aria-label="Primary">
    <a href="{base}#films">Films</a>
    <a href="{base}stats/">The ledger</a>
    <a href="{base}about/">About</a>
    <button class="seal-toggle" type="button" data-seal-toggle aria-pressed="false">
      <span class="when-sealed">Reveal all</span><span class="when-revealed">Seal all</span>
    </button>
  </nav>
</header>
<main id="main">
"""


def footer(depth: int = 0) -> str:
    base = "../" * depth
    return f"""</main>
<footer class="foot">
  <p class="foot-line">A fan reference. Not affiliated with Brad Pitt, Plan B, or any studio. Titles and artwork belong to their owners and appear here for identification and commentary.</p>
  <p class="foot-links"><a href="{base}">Home</a> <a href="{base}stats/">The ledger</a> <a href="{base}about/">About</a> <a href="{base}about/#corrections">Send a correction</a></p>
  <p class="foot-line">Spoilers stay sealed until you ask. Updated {BUILD_DATE}.</p>
</footer>
<script src="{base}assets/site.js?v={JS_V}" defer></script>
</body>
</html>
"""


# ---------------------------------------------------------------- pieces
def poster_html(f: dict, base: str, sizes: str = "(max-width: 600px) 45vw, 220px", eager: bool = False) -> str:
    if f["poster"]:
        load = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
        return f'<img class="poster-img" src="{base}{f["poster"]}" alt="{e(f["title"])} ({f["year"]}) poster" width="600" height="900" {load}>'
    return f'<div class="poster-fallback" aria-hidden="true"><span>{e(f["title"])}</span><small>{f["year"]}</small></div>'


FEATURED = [
    "once-upon-a-time-in-hollywood", "fight-club", "fury", "seven", "troy", "inglourious-basterds",
    "bullet-train", "f1", "legends-of-the-fall", "the-curious-case-of-benjamin-button", "oceans-eleven",
    "moneyball", "world-war-z", "babylon", "snatch", "meet-joe-black", "ad-astra", "thelma-and-louise",
    "interview-with-the-vampire", "12-monkeys", "mr-and-mrs-smith", "the-assassination-of-jesse-james-by-the-coward-robert-ford",
    "heart-of-the-beast", "burn-after-reading", "kalifornia", "a-river-runs-through-it",
]
SPOTLIGHT = ["once-upon-a-time-in-hollywood", "fight-club", "fury", "seven", "troy", "f1"]


def card(f: dict) -> str:
    vk = verdict_key(f)
    kind = "Series" if f["type"] == "tv" else "Film"
    feat = FEATURED.index(f["slug"]) if f["slug"] in FEATURED else 99
    return f"""<li class="card{' is-unreleased' if f.get('unreleased') else ''}" data-slug="{f['slug']}" data-verdict="{vk}" data-year="{f['year']}" data-type="{f['type']}" data-feat="{feat}" data-title="{e(f['title'].lower())}" data-character="{e((f.get('character') or '').lower())}">
  <a class="card-link" href="film/{f['slug']}/">
    <div class="poster">{poster_html(f, "")}
      <div class="curtain" aria-hidden="true"><span class="curtain-l"></span><span class="curtain-r"></span></div>
      <div class="stamp" aria-hidden="true"><span class="stamp-word">{VERDICT_WORD[vk]}</span></div>
    </div>
    <h3 class="card-title">{e(f['title'])}</h3>
    <p class="card-meta">{f['year']} <span class="sep">&middot;</span> {kind}{(' <span class="sep">&middot;</span> ' + e(f['episode'])) if f.get('episode') else ''}</p>
    <p class="card-meta">as {e(f.get('character') or '—')}</p>
  </a>
  {card_button(f, vk)}
</li>"""


def card_button(f: dict, vk: str) -> str:
    if f.get("unreleased"):
        return f'<p class="card-unreleased">Not released yet. {e(f["unreleased"])}</p>'
    vword, _ = split_verdict(f)
    return (
        f'<div class="card-guess" data-guess-box>'
        f'<p class="cg-q">Does he make it?</p>'
        f'<div class="cg-btns" role="group" aria-label="Your guess for {e(f["title"])}">'
        f'<button type="button" class="cg-btn" data-cguess="dies">He dies</button>'
        f'<button type="button" class="cg-btn" data-cguess="survives">He survives</button></div>'
        f'<button type="button" class="cg-reveal" data-reveal="{f["slug"]}">Just reveal it</button>'
        f'</div>'
        f'<div class="card-result" data-result-box hidden>'
        f'<p class="cr-call" data-call></p>'
        f'<p class="cr-verdict"><b>{e(vword)}</b> {TEASE[vk]}</p>'
        f'<div class="cr-links"><a class="spoil-link" href="film/{f["slug"]}/?spoil=1">How it happens</a>'
        f'<button type="button" class="cr-seal" data-cseal>Seal</button></div>'
        f'</div>'
    )


def spotlight(films: list[dict]) -> str:
    by = {f["slug"]: f for f in films}
    slides = []
    for i, slug in enumerate(SPOTLIGHT):
        f = by.get(slug)
        if not f:
            continue
        art = f.get("still") or f.get("backdrop")
        if not art:
            continue
        lq = f.get("still_lqip") or ""
        meta = " &middot; ".join(x for x in [str(f["year"]), e(f.get("director") or ""), e(f.get("character") or "")] if x)
        slides.append(
            f"""<li class="slide{' is-on' if i == 0 else ''}" data-i="{i}">
      <img class="slide-art" src="{art}" alt="{e(f['title'])} publicity still" width="1600" height="900" {'fetchpriority="high"' if i == 0 else 'loading="lazy"'} decoding="async"{(' style="background-image:url(' + lq + ')"') if lq else ''}>
      <div class="slide-body">
        <p class="slide-kicker">In the spotlight <span class="slide-n">{i + 1:02d} / {len(SPOTLIGHT):02d}</span></p>
        <p class="slide-meta">{meta}</p>
        <h2 class="slide-title">{e(f['title'])}</h2>
        <div class="slide-cta">
          <a class="btn-primary" href="film/{slug}/">Open the case</a>
          <button type="button" class="btn-ghost" data-spot-guess="{slug}">Guess now</button>
        </div>
        <p class="slide-fine">The answer stays hidden until you ask.</p>
      </div>
    </li>"""
        )
    dots = "".join(f'<button type="button" class="dot{" is-on" if i == 0 else ""}" data-dot="{i}" aria-label="Slide {i + 1}">{i + 1:02d}</button>' for i in range(len(slides)))
    return f"""<section class="spot-wrap" aria-label="In the spotlight">
  <ul class="spotlight" data-spotlight>
{chr(10).join(slides)}
  </ul>
  <div class="dots">{dots}</div>
</section>"""


# ---------------------------------------------------------------- pages
def build_index(films: list[dict]) -> str:
    counts = Counter(verdict_key(f) for f in films)
    desc = (
        f"Every Brad Pitt movie and TV appearance, {films[0]['year']} to {films[-1]['year']}, with the one "
        "answer that matters kept sealed until you choose to reveal it."
    )
    body = f"""<section class="hero">
  <div class="hero-row">
    <div>
      <p class="hero-kicker">The Brad Pitt film archive <span class="sep">&middot;</span> {films[0]['year']} to {films[-1]['year']}</p>
      <h1 class="hero-q">Does Brad Pitt <em>die?</em></h1>
    </div>
    <p class="hero-tag">One actor. {len(films)} stories.<br>The ending is yours to uncover.</p>
  </div>
  <form class="search" role="search" onsubmit="return false">
    <label class="visually-hidden" for="q">Search titles, characters or years</label>
    <div class="search-box">
      <svg class="search-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="q" class="search-input" type="search" placeholder="Find a film, character, or year" autocomplete="off" spellcheck="false">
      <kbd class="search-kbd" aria-hidden="true">/</kbd>
    </div>
    <p class="search-note">Spoilers sealed. Always your call.</p>
  </form>
</section>

{spotlight(films)}

<section class="archive" id="films">
  <div class="archive-head">
    <h2 class="archive-h">The filmography <small>{len(films)} titles</small></h2>
    <button type="button" class="surprise" data-surprise>Surprise me</button>
  </div>
  <div class="controls">
    <div class="chips" role="group" aria-label="Filter">
      <button type="button" class="chip is-on" data-filter="all" aria-pressed="true">All titles</button>
      <button type="button" class="chip" data-filter="film" aria-pressed="false">Films</button>
      <button type="button" class="chip" data-filter="tv" aria-pressed="false">Television</button>
      <button type="button" class="chip chip-spoiler" data-filter="revealed" aria-pressed="false">Revealed by me</button>
    </div>
    <div class="selects">
      <label class="sel"><span class="visually-hidden">Decade</span><select id="decade"><option value="">Every decade</option><option value="1980">1980s</option><option value="1990">1990s</option><option value="2000">2000s</option><option value="2010">2010s</option><option value="2020">2020s</option></select></label>
      <label class="sel"><span class="visually-hidden">Sort</span><select id="sort"><option value="featured">Featured first</option><option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">Title A to Z</option></select></label>
    </div>
  </div>
  <p class="hero-note" id="result-count" aria-live="polite">{len(films)} titles in the archive</p>
  <ul class="grid" id="grid">
{chr(10).join(card(f) for f in films)}
  </ul>
  <p class="empty" id="empty" hidden>Nothing matches. Try a shorter search, or a character name like “Tyler”.</p>
</section>

<section class="closing" aria-label="The ledger">
  <p class="page-kicker">Curious about the big picture?</p>
  <h2 class="closing-h">A career. A few close calls.</h2>
  <p class="closing-sub">Every ending across four decades, tallied. <span class="tease-n" data-count="{counts['dies']}">?</span> deaths, <span class="tease-n" data-count="{counts['survives']}">?</span> survivals, <span class="tease-n" data-count="{counts['ambiguous']}">?</span> complicated. The ledger contains spoilers.</p>
  <a class="btn-primary" href="stats/">Open the spoiler ledger</a>
</section>
"""
    ld = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": SITE_NAME,
        "url": SITE + "/",
        "description": desc,
    }
    extra = f'<script type="application/ld+json">{json.dumps(ld)}</script>'
    return head(f"{SITE_NAME} Every movie and show, spoiler-sealed", desc, "/", extra) + header() + body + footer()


def clip_html(f: dict) -> str:
    yid = f.get("youtube_id")
    q = f"{f['title']} {f['year']} Brad Pitt scene"
    if yid:
        return f"""<div class="clip" data-clip="{yid}">
  <button class="clip-btn" type="button" aria-label="Play the scene from {e(f['title'])}">
    <img src="https://i.ytimg.com/vi/{yid}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy">
    <span class="clip-play"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg> Play the scene</span>
  </button>
  <p class="clip-note">Plays from YouTube. <a href="https://www.youtube.com/watch?v={yid}" rel="noopener" target="_blank">Open on YouTube</a></p>
</div>"""
    return f'<p class="clip-note">No clip on file yet. <a href="https://www.youtube.com/results?search_query={e(q.replace(" ", "+"))}" rel="noopener" target="_blank">Search YouTube for the scene</a></p>'


def build_film(f: dict) -> str:
    vk = verdict_key(f)
    base = "../../"
    kind = "series" if f["type"] == "tv" else "film"
    title = f"Does Brad Pitt die in {f['title']} ({f['year']})?"
    desc = (
        f"Brad Pitt plays {f.get('character') or 'a role'} in {f['title']} ({f['year']}). "
        "Does he make it out alive? The answer is sealed until you reveal it."
    )
    when = f.get("when")
    cause = f.get("cause")
    facts = []
    if vk == "dies":
        if cause:
            facts.append(("Cause", cause))
        if when:
            facts.append(("When", when.replace("-", " ")))
    if f.get("director"):
        facts.append(("Director", f["director"]))
    if f.get("runtime_minutes"):
        facts.append(("Runtime", f"{f['runtime_minutes']} min"))
    facts_html = "".join(f"<div class='fact'><dt>{e(k)}</dt><dd>{e(str(v))}</dd></div>" for k, v in facts)
    notes = f"<p class='notes'>{e(f['notes'])}</p>" if f.get("notes") else ""
    conf = f.get("confidence", "high")
    conf_html = "" if conf == "high" else f"<p class='conf'>Our confidence on this one is {conf}. <a href='{base}about/#corrections'>Know better? Tell us.</a></p>"
    prev_html = f"<a class='adj adj-prev' href='../{f['prev']['slug']}/'><small>Earlier</small>{e(f['prev']['title'])} ({f['prev']['year']})</a>" if f["prev"] else "<span></span>"
    next_html = f"<a class='adj adj-next' href='../{f['next']['slug']}/'><small>Later</small>{e(f['next']['title'])} ({f['next']['year']})</a>" if f["next"] else "<span></span>"
    links = []
    if f.get("imdb_id"):
        links.append(f"<a href='https://www.imdb.com/title/{f['imdb_id']}/' rel='noopener' target='_blank'>IMDb</a>")
    if f.get("wikipedia_url"):
        links.append(f"<a href='{e(f['wikipedia_url'])}' rel='noopener' target='_blank'>Wikipedia</a>")

    vword, vrest = split_verdict(f)
    seal_block = f"""<div class="seal" data-seal>
        <p class="seal-lead">Want to guess first?</p>
        <div class="guess" role="group" aria-label="Your guess">
          <button type="button" class="guess-btn" data-guess="survives">He survives</button>
          <button type="button" class="guess-btn" data-guess="dies">He dies</button>
        </div>
        <button type="button" class="reveal-big" data-reveal="{f['slug']}">Just reveal it</button>
        {'<button type="button" class="hint-btn" data-hint-btn><span class="hint-eye" aria-hidden="true"></span>Give me a hint</button>' if (f.get('backdrop') or f.get('still')) else ''}
        <p class="seal-fine">Revealing shows only the answer. Everything else stays behind its own curtain.</p>
      </div>"""
    if f.get("unreleased"):
        seal_block = f"""<div class="seal seal-unreleased" data-seal>
        <p class="seal-lead">Not released yet.</p>
        <p class="verdict-how">{e(f['how'])}</p>
        <p class="seal-fine">{e(f['unreleased'])}</p>
      </div>"""
    film_bd = (
        f'<div class="film-bd is-loaded" aria-hidden="true"><img class="film-bd-img" src="{base}{f["poster"]}" alt="" width="600" height="900" decoding="async"></div>'
        if f.get("poster") else ""
    )
    hint_src = f.get("still") or f.get("backdrop")
    hint = (
        f'<div class="hint" data-hint hidden><div class="hint-bar hint-bar-t"></div><div class="hint-bar hint-bar-b"></div>'
        f'<img class="hint-img" src="{base}{hint_src}" alt="A frame from {e(f["title"])}" width="1600" height="900" loading="lazy" decoding="async">'
        f'<p class="hint-cap">A frame from the film. That is all you get.</p></div>'
        if hint_src else ""
    )
    next_pool = json.dumps([{"s": x["slug"], "t": x["title"], "y": x["year"]} for x in ALL_FILMS if not x.get("unreleased") and x["slug"] != f["slug"]])
    body = f"""<article class="film{' is-unreleased' if f.get('unreleased') else ''}{' has-bd' if film_bd else ''}" data-slug="{f['slug']}" data-verdict="{vk}" data-pool='{e(next_pool)}'>
  {film_bd}
  {hint}
  <div class="film-hero">
    <div class="film-poster">{poster_html(f, base, sizes="(max-width: 700px) 60vw, 320px", eager=True)}</div>
    <div class="film-head">
      <p class="film-kicker">{f['year']} {kind}{(' &middot; ' + e(f['episode'])) if f.get('episode') else ''}{' &middot; directed by ' + e(f['director']) if f.get('director') else ''}</p>
      <h1 class="film-q">Does Brad Pitt die in <em>{e(f['title'])}</em>?</h1>
      <p class="film-role">He plays <strong>{e(f.get('character') or 'an uncredited role')}</strong>{', a ' + e(f['role_size']) + ' role' if f.get('role_size') in ('supporting','cameo','voice') else ''}.</p>

      {seal_block}

      <div class="verdict" data-nosnippet hidden>
        <div class="curtain curtain-big" aria-hidden="true"><span class="curtain-l"></span><span class="curtain-r"></span></div>
        <div class="spot" aria-hidden="true"></div>

        <section class="stage stage-1" data-stage="1">
          <p class="guess-result" data-guess-result aria-live="polite"></p>
          <p class="verdict-answer"><span class="verdict-word" data-split>{e(vword)}</span></p>
          <p class="verdict-tease" data-split>{TEASE[vk]}{(' ' + WHEN_TEASE[f['when']]) if vk == 'dies' and f.get('when') in WHEN_TEASE else ''}</p>
          <p class="streak" data-streak hidden></p>
          <div class="gate" data-gate="2">
            <button type="button" class="spoil-btn" data-spoil="2"><span class="spoil-shine" aria-hidden="true"></span>Spoil the moment</button>
            <p class="gate-fine">How it happens, in words. No pictures yet.</p>
          </div>
          <p class="next-up" data-next hidden></p>
        </section>

        <section class="stage stage-2" data-stage="2" hidden>
          <h2 class="moment-h" data-split>{e(vrest or VERDICT_WORD[vk])}</h2>
          <p class="verdict-how redact">{e(f['how'])}</p>
          {notes.replace("class='notes'", "class='notes redact'")}
          <dl class="facts">{facts_html}</dl>
          {conf_html}
          <div class="gate" data-gate="3">
            <button type="button" class="spoil-btn spoil-btn-2" data-spoil="3"><span class="spoil-shine" aria-hidden="true"></span>Show me the scene</button>
            <p class="gate-fine">{'The clip, from YouTube. This is the whole thing.' if f.get('youtube_id') else 'Where to find the scene.'}</p>
          </div>
        </section>

        <section class="stage stage-3" data-stage="3" hidden>
          <h2 class="scene-h">The scene</h2>
          {clip_html(f)}
        </section>

        <button type="button" class="reseal" data-reseal>Seal it again</button>
      </div>
    </div>
  </div>

  <nav class="adjacent" aria-label="Nearby titles">{prev_html}{next_html}</nav>
  <p class="film-links">{' '.join(links)} <a href="{base}#films">All titles</a></p>
</article>
"""
    ld = {
        "@context": "https://schema.org",
        "@type": "TVSeries" if f["type"] == "tv" else "Movie",
        "name": f["title"],
        "datePublished": str(f["year"]),
        "actor": {"@type": "Person", "name": "Brad Pitt"},
        "url": f"{SITE}/film/{f['slug']}/",
    }
    if f.get("director"):
        ld["director"] = {"@type": "Person", "name": f["director"]}
    if f["poster"]:
        ld["image"] = f"{SITE}/{f['poster']}"
    extra = f'<script type="application/ld+json">{json.dumps(ld)}</script>'
    return head(title, desc, f"/film/{f['slug']}/", extra, depth=2) + header(2) + body + footer(2)


def build_stats(films: list[dict]) -> str:
    base = "../"
    vk = [verdict_key(f) for f in films]
    n = len(films)
    dies = vk.count("dies")
    surv = vk.count("survives")
    amb = vk.count("ambiguous")
    causes = Counter((f.get("cause") or "unspecified").lower() for f in films if verdict_key(f) == "dies")
    by_decade: dict[int, Counter] = {}
    for f in films:
        by_decade.setdefault(f["year"] // 10 * 10, Counter())[verdict_key(f)] += 1
    # longest run of survivals
    best = cur = 0
    best_end = None
    for f in films:
        if verdict_key(f) == "survives":
            cur += 1
            if cur > best:
                best, best_end = cur, f
        else:
            cur = 0
    deaths = [f for f in films if verdict_key(f) == "dies"]
    deaths_list = "".join(
        f"<li><a href='{base}film/{f['slug']}/'><span class='dl-year'>{f['year']}</span><span class='dl-title'>{e(f['title'])}</span><span class='dl-how'>{e(f.get('cause') or '')}</span></a></li>"
        for f in deaths
    )
    cause_rows = "".join(
        f"<li><span class='bar' style='--w:{c/max(causes.values())*100:.0f}%'></span><span class='bar-l'>{e(k)}</span><span class='bar-n'>{c}</span></li>"
        for k, c in causes.most_common()
    )
    dec_rows = "".join(
        f"<li><span class='dec-l'>{d}s</span><span class='dec-bars'>"
        f"<i class='b-dies' style='--w:{c['dies']/n*100*3:.1f}%' title='{c['dies']} deaths'></i>"
        f"<i class='b-amb' style='--w:{c['ambiguous']/n*100*3:.1f}%' title='{c['ambiguous']} complicated'></i>"
        f"<i class='b-surv' style='--w:{c['survives']/n*100*3:.1f}%' title='{c['survives']} survivals'></i>"
        f"</span><span class='dec-n'>{c['dies']} of {sum(c.values())}</span></li>"
        for d, c in sorted(by_decade.items())
    )
    body = f"""<section class="ledger">
  <p class="page-kicker">Nothing on this page is sealed</p>
  <h1 class="page-h">The ledger</h1>
  <p class="page-sub">Across {n} films and shows since {films[0]['year']}, this is how often the screen’s most reliable movie star has failed to make it to the credits.</p>

  <div class="bignums">
    <div class="bignum bn-dies"><span class="bn-n">{dies}</span><span class="bn-l">on-screen deaths</span></div>
    <div class="bignum bn-surv"><span class="bn-n">{surv}</span><span class="bn-l">survivals</span></div>
    <div class="bignum bn-amb"><span class="bn-n">{amb}</span><span class="bn-l">it's complicated</span></div>
    <div class="bignum"><span class="bn-n">{round(dies/n*100)}<small>%</small></span><span class="bn-l">chance he dies in any given title</span></div>
  </div>

  <div class="ledger-cols">
    <section class="lcol">
      <h2>Ways to go</h2>
      <ul class="bars">{cause_rows}</ul>
    </section>
    <section class="lcol">
      <h2>By decade</h2>
      <ul class="decs">{dec_rows}</ul>
      <p class="legend"><i class="b-dies"></i> dies <i class="b-amb"></i> complicated <i class="b-surv"></i> survives</p>
      {f"<p class='streak-note'>Longest unbroken run of survivals: {best} titles in a row, ending with <a href='{base}film/{best_end['slug']}/'>{e(best_end['title'])}</a> ({best_end['year']}).</p>" if best_end else ''}
    </section>
  </div>

  <section class="deaths">
    <h2>Every death, in order</h2>
    <ul class="death-list">{deaths_list}</ul>
  </section>
</section>
"""
    title = f"The ledger: every time Brad Pitt died on screen"
    desc = f"{dies} deaths, {surv} survivals and {amb} complicated cases across {n} titles. The full, unsealed tally with causes and decades."
    return head(title, desc, "/stats/", depth=1) + header(1) + body + footer(1)


def build_about(films: list[dict]) -> str:
    body = f"""<section class="about">
  <p class="page-kicker">About this site</p>
  <h1 class="page-h">One question, answered on your terms</h1>
  <div class="prose">
    <p>Some people watch a film differently when they know the lead is going to make it. Some people cannot enjoy a film at all without knowing. This site exists for both, for one actor, because the internet already had a site for the dog.</p>
    <p>Every entry stays sealed until you choose to open it. You can guess first if you like. Your reveals are remembered on this device only, and nothing you do here is sent anywhere.</p>
    <h2>How verdicts are decided</h2>
    <p>“Dies” means the character Brad Pitt plays is dead by the end of the story, on screen or by clear narration. “Survives” means he is alive when the story ends, however badly hurt. “It’s complicated” covers hallucinations, fake deaths, resurrections, immortals and the like; the reveal explains the nuance.</p>
    <p>Voice roles, cameos and television episodes count. Documentary appearances and Brad Pitt playing himself do not, unless something happens to him.</p>
    <h2 id="corrections">Corrections</h2>
    <p>Spotted a mistake, a missing title, or a better clip? Email <span class="mail">hello at doesbradpittdie dot com</span> with the title and what should change. Corrections ship in the next build.</p>
    <h2>Credits</h2>
    <p>Poster artwork and clips belong to their respective studios and are used for identification and commentary. Plot verification against Wikipedia and first-hand viewing. This is an independent fan reference and is not affiliated with Brad Pitt or any studio. {len(films)} titles catalogued as of {BUILD_DATE}.</p>
  </div>
</section>
"""
    return head("About Does Brad Pitt Die?", "How the site works, how verdicts are decided, and how to send a correction.", "/about/", depth=1) + header(1) + body + footer(1)


def build_404() -> str:
    body = """<section class="about">
  <p class="page-kicker">404</p>
  <h1 class="page-h">This one didn’t make it</h1>
  <div class="prose"><p>The page you asked for is not in the catalogue. <a href="/">Back to every title</a>.</p></div>
</section>
"""
    return head("Not found", "Page not found.", "/404.html") + header() + body + footer()


# ---------------------------------------------------------------- assets
def make_og() -> None:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), "#1a0b10")
    d = ImageDraw.Draw(im)
    # curtain stripes
    for x in range(0, W, 40):
        d.rectangle((x, 0, x + 18, H), fill="#22101a")
    try:
        f_big = ImageFont.truetype("C:/Windows/Fonts/georgiai.ttf", 96)
        f_small = ImageFont.truetype("C:/Windows/Fonts/georgia.ttf", 34)
    except OSError:
        f_big = f_small = ImageFont.load_default()
    d.text((80, 190), "Does Brad Pitt die", font=f_big, fill="#f4ead9")
    d.text((80, 300), "in this one?", font=f_big, fill="#d9b26a")
    d.text((84, 450), "Every film and show. Sealed until you say so.", font=f_small, fill="#b9a6ad")
    d.text((84, 560), "doesbradpittdie.com", font=f_small, fill="#8f1d2c")
    im.save(DIST / "og.png", optimize=True)
    icon = Image.new("RGB", (180, 180), "#1a0b10")
    di = ImageDraw.Draw(icon)
    try:
        f_i = ImageFont.truetype("C:/Windows/Fonts/georgiai.ttf", 120)
    except OSError:
        f_i = ImageFont.load_default()
    di.text((48, 12), "?", font=f_i, fill="#d9b26a")
    icon.save(DIST / "apple-touch-icon.png")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


ALL_FILMS: list[dict] = []


def main() -> None:
    films = load_films()
    ALL_FILMS.extend(films)
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    (DIST / "assets").mkdir()
    for name in ("site.css", "site.js", "favicon.svg"):
        target = DIST / ("assets" / Path(name) if name != "favicon.svg" else Path(name))
        shutil.copy(SRC / "static" / name, target)
    posters = DATA / "posters"
    if posters.exists():
        (DIST / "posters").mkdir()
        for p in posters.glob("*.webp"):
            shutil.copy(p, DIST / "posters" / p.name)

    write(DIST / "index.html", build_index(films))
    for f in films:
        write(DIST / "film" / f["slug"] / "index.html", build_film(f))
    write(DIST / "stats" / "index.html", build_stats(films))
    write(DIST / "about" / "index.html", build_about(films))
    write(DIST / "404.html", build_404())
    # the back room: unlisted notes with comments
    import blog

    posts = blog.load_posts()
    write(
        DIST / "backroom" / "index.html",
        head("The back room", "Unlisted notes on the project.", "/backroom/", depth=1, noindex=True)
        + header(1) + blog.index_html(posts, SITE) + footer(1),
    )
    for p in posts:
        write(
            DIST / "backroom" / p["slug"] / "index.html",
            head(p["title"], p["summary"] or "A note from the back room.", f"/backroom/{p['slug']}/", depth=2, noindex=True)
            + header(2) + blog.post_html(p, SITE) + footer(2),
        )
    shutil.copy(SRC / "static" / "giscus.css", DIST / "assets" / "giscus.css")
    for folder in ("backdrops", "stills"):
        src_dir = DATA / folder
        if src_dir.exists():
            (DIST / folder).mkdir(exist_ok=True)
            for p in src_dir.glob("*.webp"):
                shutil.copy(p, DIST / folder / p.name)
    urls = ["/", "/stats/", "/about/"] + [f"/film/{f['slug']}/" for f in films]
    write(
        DIST / "sitemap.xml",
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{BUILD_DATE}</lastmod></url>\n" for u in urls)
        + "</urlset>\n",
    )
    write(DIST / "robots.txt", f"User-agent: *\nAllow: /\nDisallow: /backroom/\nSitemap: {SITE}/sitemap.xml\n")
    write(DIST / "CNAME", "doesbradpittdie.com\n")
    write(DIST / ".nojekyll", "")
    write(DIST / "films.json", json.dumps([{k: v for k, v in f.items() if k not in ("prev", "next")} for f in films], indent=1))
    make_og()
    print(f"built {len(films)} films -> {DIST}")


if __name__ == "__main__":
    main()
