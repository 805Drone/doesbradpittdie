# doesbradpittdie.com

Does Brad Pitt die in this movie or show? Every credited appearance, 1987 to today,
with the answer sealed until the visitor chooses to reveal it.

Live: https://doesbradpittdie.com (GitHub Pages, deployed from `dist/` on every push to `main`).

## Editing content

1. Edit `data/films.json`. Each entry has `title`, `slug`, `year`, `type` (`film`|`tv`),
   `character`, `role_size`, `dies` (`true`|`false`|`"ambiguous"`), `verdict_short`
   (first sentence is the big answer: "Yes." / "No." / "Sort of."), `how`, `when`, `cause`,
   `notes`, `director`, `runtime_minutes`, `imdb_id`, `wikipedia_url`, `confidence`,
   `episode`, `unreleased` (string or null), `youtube_id` (or null).
2. Optional: add a YouTube ID for the scene to `data/clips.json` keyed by slug.
3. `python src/posters.py` fetches any missing poster from Wikipedia (2.5 s per request,
   Wikipedia rate-limits otherwise). Landscape artwork is set on a blurred title card.
4. `python src/build.py` renders `dist/`.
5. Commit and push. The Pages workflow publishes within a minute.

Preview locally: `python -m http.server 4070 --directory dist`.

## Hints (trailer frames)

`data/trailers.json` maps slug to a YouTube trailer ID (merged from `data/trailers_batch*.json`
by `python src/merge_trailers.py`). `python src/backdrops.py` turns each into a 1280x720
frame in `data/backdrops/`, used only for the "Give me a hint" iris on film pages. Posters
are the consistent imagery everywhere else.

## Stills (spotlight and hints)

`python src/stills.py` scrapes the top-voted backdrop for each title with a `tmdb_id` from
themoviedb.org's public image pages (no API key) into `data/stills/` at 1600x900. The home
spotlight (`SPOTLIGHT` in build.py) and the film-page hint prefer a still and fall back to the
trailer frame. Featured ordering of the grid is the `FEATURED` list in build.py.

## The back room (unlisted blog)

Posts are `content/backroom/*.md` with `title`, `date`, `summary` front matter. They render to
`/backroom/` and `/backroom/<slug>/`, are `noindex`, excluded from the sitemap and disallowed
in robots.txt. Comments are giscus, backed by GitHub Discussions (category General) on this
repo. Requirement: the giscus GitHub app must be installed on the repo
(https://github.com/apps/giscus/installations/new).

## Layout

- `src/build.py` static generator (Python 3.12, Pillow only)
- `src/static/` site.css, site.js, favicon
- `data/` films.json, clips.json, posters/, raw research files
- `docs/superpowers/specs/` design spec

## Pending

- The Adventures of Cliff Booth (Nov 25, 2026): set `unreleased` to null and fill the verdict on release.
- Heart of the Beast verdict is medium confidence (opened Sep 25, 2026).
