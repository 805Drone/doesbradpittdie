"""Fetch high-resolution publicity stills for each title from TMDB's public image pages.

    python src/stills.py            # fetch missing
    python src/stills.py --force

Writes data/stills/<slug>.webp (1600x900) and data/stills/<slug>.lqip.webp.
Uses the top-voted backdrop on themoviedb.org (no API key). Titles without a
tmdb_id keep their trailer-frame backdrop as the fallback.
"""
from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "stills"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
W, H = 1600, 900
# hand-picked backdrop overrides (slug -> tmdb file path) when the top-voted one is weak
OVERRIDES: dict[str, str] = {}


def get(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def backdrop_paths(kind: str, tid: int) -> list[str]:
    html = get(f"https://www.themoviedb.org/{kind}/{tid}/images/backdrops").decode("utf-8", "replace")
    # backdrop cards use the w500_and_h282_face thumbnail; the page header uses poster sizes
    paths = re.findall(r"/t/p/w500_and_h282_face/([A-Za-z0-9]+\.(?:jpg|png))", html)
    return list(dict.fromkeys(paths))


def fit(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = max(0, (im.height - H) // 3)
    return im.crop((x, y, x + W, y + H))


def save(im: Image.Image, slug: str) -> None:
    im.save(OUT / f"{slug}.webp", "WEBP", quality=78, method=6)
    lq = im.resize((40, 22), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    lq.save(OUT / f"{slug}.lqip.webp", "WEBP", quality=40)


def main(force: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    films = json.loads((DATA / "films.json").read_text(encoding="utf-8"))
    log = {}
    for f in films:
        slug, tid = f["slug"], f.get("tmdb_id")
        if (OUT / f"{slug}.webp").exists() and not force:
            continue
        if not tid:
            print(f"  - {slug}: no tmdb id")
            continue
        kind = "tv" if f["type"] == "tv" else "movie"
        try:
            time.sleep(1.2)
            path = OVERRIDES.get(slug)
            if not path:
                paths = backdrop_paths(kind, tid)
                if not paths:
                    print(f"  - {slug}: no backdrops")
                    continue
                path = paths[0]
            raw = get(f"https://image.tmdb.org/t/p/original/{path}", timeout=60)
            im = Image.open(io.BytesIO(raw))
            if im.width < 1000:
                print(f"  - {slug}: too small {im.size}")
                continue
            save(fit(im), slug)
            log[slug] = path
            print(f"  + {slug}: {im.size} {path}")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {slug}: {e}")
    (DATA / "stills_log.json").write_text(json.dumps(log, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
