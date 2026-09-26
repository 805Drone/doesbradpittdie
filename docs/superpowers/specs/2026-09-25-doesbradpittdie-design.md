# doesbradpittdie.com — design spec (2026-09-25)

## Intent (from the owner)
A premium, spoiler-gated answer to one question: **Does Brad Pitt die in this movie or show?**
Modeled on the utility of doesthedogdie.com, but built as an ultra-premium single-subject site.
Every Brad Pitt screen appearance is catalogued. The answer stays hidden until the visitor
chooses to *reveal* it; the reveal then shows the verdict, the moment/scene, and (when
available) the clip. Owner said: don't stop until it is live and working.

## Success criteria
- Every credited Pitt film/TV appearance (1987 → 2026) has an entry with a verified verdict.
- Answer is never visible by accident: grid cards and film pages are sealed until reveal.
- Reveal is the memorable moment of the site (curtain wipe → verdict in huge type → scene).
- Fast, static, works on phones, keyboard accessible, reduced-motion respected.
- Live at https://doesbradpittdie.com with HTTPS.

## Architecture
- **Static site generator** in Python (`src/build.py`), no framework. Input: `data/films.json`
  (+ `data/clips.json`). Output: `dist/` (index, `/film/<slug>/`, `/stats/`, `/about/`,
  `404.html`, `sitemap.xml`, `robots.txt`, `posters/`).
- Posters fetched at build time from Wikipedia page-image API into `dist/posters/` (cached in
  `data/posters/`); typographic fallback card when none.
- **Hosting**: GitHub Pages from repo `805Drone/doesbradpittdie` (branch `main`, `/dist` published
  via Actions or the `docs` convention), custom domain via `CNAME`; DNS at GoDaddy (A records to
  GitHub Pages IPs + `www` CNAME). Rationale: the existing GoDaddy Economy plan hosts one site
  (805drone.com); Pages is free, CDN-backed, HTTPS, and fully scriptable with `gh`.

## Design direction ("the velvet curtain")
- Palette: velvet `#1a0b10` (base), curtain crimson `#8f1d2c`, ivory `#f4ead9` (type),
  marquee gold `#d9b26a` (survives / highlights), smoke `#6b5a63` (ambiguous, meta text).
- Type: Bodoni Moda (display, italic for the question), Instrument Sans (UI/body). No mono.
- Hero: the question set in oversized Bodoni italic with the film title cycling ("…in Fury?").
- Grid: poster cards grouped by decade (a true timeline), each sealed with a "Reveal" control;
  revealing wipes a curtain across the card and stamps the verdict.
- Film page: guess first (Dies / Survives) or just reveal; curtain parts to show verdict,
  how/when/cause, the scene, the clip (YouTube embed if known), and a streak counter.
- One orchestrated motion: the reveal. Everything else quiet.

## Data model (`data/films.json` entry)
title, slug, year, type, character, role_size, dies (true|false|"ambiguous"), verdict_short,
how, when, cause, notes, director, runtime_minutes, imdb_id, wikipedia_url, confidence,
poster (filename or null), youtube_id (optional).

## Out of scope (v1)
User accounts, comments/voting, non-Pitt actors, ads.
