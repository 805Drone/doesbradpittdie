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

## Layout

- `src/build.py` static generator (Python 3.12, Pillow only)
- `src/static/` site.css, site.js, favicon
- `data/` films.json, clips.json, posters/, raw research files
- `docs/superpowers/specs/` design spec

## Pending

- The Adventures of Cliff Booth (Nov 25, 2026): set `unreleased` to null and fill the verdict on release.
- Heart of the Beast verdict is medium confidence (opened Sep 25, 2026).
