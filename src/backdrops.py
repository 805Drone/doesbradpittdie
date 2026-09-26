"""Build backdrop images from trailer frames (YouTube thumbnails).

    python src/backdrops.py            # fetch any missing
    python src/backdrops.py --force

Reads data/trailers.json (slug -> youtube id). Writes data/backdrops/<slug>.webp
(1280 wide, 16:9) and a tiny blurred placeholder data/backdrops/<slug>.lqip.webp.
Trailer thumbnails are frames from the film that do not spoil the ending.
Titles without a trailer get a backdrop derived from their poster instead.
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = DATA / "backdrops"
UA = "doesbradpittdie.com backdrop fetcher (contact: info@805drone.com)"
W, H = 1280, 720


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except Exception:  # noqa: BLE001
        return None


def thumb(yid: str) -> Image.Image | None:
    for name in ("maxresdefault", "sddefault", "hqdefault"):
        raw = fetch(f"https://i.ytimg.com/vi/{yid}/{name}.jpg")
        if not raw:
            continue
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width < 400:  # YouTube's 120x90 "missing" placeholder
            continue
        # hqdefault/sddefault carry black letterbox bars: crop to 16:9 centre
        if abs(im.width / im.height - 16 / 9) > 0.05:
            nh = int(im.width * 9 / 16)
            top = (im.height - nh) // 2
            im = im.crop((0, top, im.width, top + nh))
        return im
    return None


def from_poster(slug: str) -> Image.Image | None:
    p = DATA / "posters" / f"{slug}.webp"
    if not p.exists():
        return None
    im = Image.open(p).convert("RGB")
    scale = max(W / im.width, H / im.height) * 1.1
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im = im.crop(((im.width - W) // 2, (im.height - H) // 3, (im.width - W) // 2 + W, (im.height - H) // 3 + H))
    im = im.filter(ImageFilter.GaussianBlur(6))
    return ImageEnhance.Brightness(im).enhance(0.9)


def save(im: Image.Image, slug: str) -> None:
    im = im.resize((W, H), Image.LANCZOS) if im.size != (W, H) else im
    im.save(OUT / f"{slug}.webp", "WEBP", quality=72, method=6)
    lq = im.resize((32, 18), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    lq.save(OUT / f"{slug}.lqip.webp", "WEBP", quality=40)


def main(force: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    films = json.loads((DATA / "films.json").read_text(encoding="utf-8"))
    trailers = json.loads((DATA / "trailers.json").read_text(encoding="utf-8")) if (DATA / "trailers.json").exists() else {}
    for f in films:
        slug = f["slug"]
        if (OUT / f"{slug}.webp").exists() and not force:
            continue
        yid = trailers.get(slug)
        im = None
        if yid:
            time.sleep(0.4)
            im = thumb(yid)
        src = "trailer"
        if im is None:
            im = from_poster(slug)
            src = "poster"
        if im is None:
            print(f"  - {slug}: nothing")
            continue
        save(im, slug)
        print(f"  + {slug}: {src}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
