"""One-off: merge the research agents' JSON transcripts into data/films.json."""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

DROP_IMDB = {
    "tt0093231", "tt0093640", "tt0093638", "tt0093407",  # 1987 uncredited extras
    "tt4973112", "tt1945228", "tt1448751",  # narration-only documentaries
    "tt9425946",  # Once Upon a Deadpool (recut duplicate)
    "tt0384792",  # Abby Singer (guerrilla doc-style)
}

OVERRIDES = {
    "tt0057731": {"title": "Another World", "episode": "Two episodes, May 1987"},
    "tt0593355": {"title": "Growing Pains", "episode": "Who's Zoomin' Who? / Feet of Clay", "character": "Jeff / Jonathan Keith"},
    "tt0077000": {"title": "Dallas", "episode": "Season 11, four episodes"},
    "tt0779698": {"title": "Trial and Error", "episode": "Bon Appetit", "character": "Bellboy"},
    "tt0501965": {"title": "21 Jump Street", "episode": "Best Years of Your Life", "character": "Peter"},
    "tt0598636": {"title": "Head of the Class", "episode": "Partners", "character": "Chuck"},
    "tt0582734": {"title": "Freddy's Nightmares", "episode": "Black Tickets", "character": "Rick Austin"},
    "tt0755503": {"title": "thirtysomething", "episode": "Love and Sex", "character": "Bernard"},
    "tt0716857": {"title": "Tales from the Crypt", "episode": "King of the Road", "wikipedia_url": "https://en.wikipedia.org/wiki/Tales_from_the_Crypt_(TV_series)"},
    "tt0694762": {"title": "Saturday Night Live", "year": 1998, "episode": "Cold open, November 7, 1998", "character": "David Spade's therapist", "slug": "saturday-night-live-1998"},
    "tt0072562": {"title": "Saturday Night Live", "year": 2020, "episode": "SNL at Home, April 25, 2020", "character": "Dr. Anthony Fauci", "slug": "saturday-night-live-2020"},
    "tt0583642": {"title": "Friends", "episode": "The One with the Rumor"},
    "tt0613908": {"title": "Jackass", "episode": "Season 3: Night Monkey 2 / The Abduction", "wikipedia_url": "https://en.wikipedia.org/wiki/Jackass_(TV_series)"},
    "tt0620279": {"title": "King of the Hill", "episode": "Patch Boomhauer", "character": "Patch Boomhauer", "wikipedia_url": "https://en.wikipedia.org/wiki/King_of_the_Hill"},
    "tt6987966": {"title": "The Jim Jefferies Show", "episode": "Recurring weatherman, 2017 to 2018"},
    "tt27304947": {"title": "Dave", "episode": "Looking for Love (season 3 finale)", "character": "Himself, sort of"},
    "tt0290212": {"character": "Himself"},
    "tt0270288": {"character": "Bachelor Brad"},
    "tt0120601": {"character": "Himself"},
    "tt11152168": {"character": "Keith"},
    "tt14257582": {"character": "The other fixer"},
    "tt36408401": {"unreleased": "In IMAX Nov 25, 2026. On Netflix Dec 23, 2026.", "dies": "ambiguous", "verdict_short": "Not released yet.", "confidence": "low"},
    "tt0119643": {"character": "Joe Black / the young man in the coffee shop"},
    "tt0118930": {"year": 1988},
}


def slugify(s: str) -> str:
    s = s.lower().replace("&", "and").replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def extract_json(path: Path) -> list | dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main(paths: list[str]) -> None:
    items: list[dict] = []
    for p in paths:
        data = extract_json(Path(p))
        if isinstance(data, dict):
            data = data["films"]
        items.extend(data)
    seen: dict[str, dict] = {}
    for f in items:
        imdb = f.get("imdb_id")
        if imdb in DROP_IMDB:
            continue
        f["title"] = html.unescape(f["title"])
        for k in ("character", "verdict_short", "how", "notes", "cause"):
            if isinstance(f.get(k), str):
                f[k] = html.unescape(f[k])
        f.update(OVERRIDES.get(imdb, {}))
        f.setdefault("episode", None)
        f.setdefault("unreleased", None)
        f["slug"] = f.get("slug") or slugify(f["title"])
        if imdb in seen:
            continue
        seen[imdb] = f
    films = list(seen.values())
    # slug collisions
    slugs = [f["slug"] for f in films]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    assert not dupes, dupes
    clips = json.loads((DATA / "clips.json").read_text(encoding="utf-8"))
    for f in films:
        f["youtube_id"] = clips.get(f["slug"])
    films.sort(key=lambda f: (f["year"], f["title"]))
    (DATA / "films.json").write_text(json.dumps(films, indent=2, ensure_ascii=False), encoding="utf-8")
    print(len(films), "films;", sum(1 for f in films if f["youtube_id"]), "with clips")
    for f in films:
        print(f"{f['year']} {f['slug']:<60} {str(f['dies']):<10} {f['role_size']}")


if __name__ == "__main__":
    main(sys.argv[1:])
