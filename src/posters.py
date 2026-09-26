"""Fetch film posters from Wikipedia's page-image API and normalise them.

Usage: python src/posters.py            # fetch any missing posters
       python src/posters.py --force    # refetch everything

Posters are cached in data/posters/<slug>.jpg (source) and written as
data/posters/<slug>.webp (600px wide) which build.py copies to dist/.
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
POSTERS = DATA / "posters"
UA = "doesbradpittdie.com poster fetcher (contact: info@805drone.com)"


def wiki_title(url: str) -> str:
    return urllib.parse.unquote(url.rsplit("/wiki/", 1)[1])


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def original_image(title: str) -> str | None:
    api = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
        {
            "action": "query",
            "prop": "pageimages",
            "piprop": "original",
            "titles": title,
            "format": "json",
            "redirects": 1,
            "pilicense": "any",
        }
    )
    pages = fetch_json(api).get("query", {}).get("pages", {})
    for p in pages.values():
        src = (p.get("original") or {}).get("source")
        if src and not src.lower().split("?")[0].endswith(".svg"):
            return src
    return None


def title_card(im: Image.Image) -> Image.Image:
    """Landscape logos/title cards: set them on a blurred, darkened velvet 2:3 card."""
    from PIL import ImageFilter, ImageEnhance

    W, H = 600, 900
    bg = im.copy()
    scale = max(W / bg.width, H / bg.height) * 1.15
    bg = bg.resize((int(bg.width * scale), int(bg.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(28))
    bg = ImageEnhance.Brightness(bg).enhance(0.38)
    velvet = Image.new("RGB", (W, H), (26, 11, 16))
    bg = Image.blend(velvet, bg, 0.75)
    fg = im.copy()
    fg.thumbnail((int(W * 0.84), int(H * 0.6)), Image.LANCZOS)
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    return bg


def normalise(raw: bytes, out: Path) -> tuple[int, int]:
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    if w / h > 0.9:
        card = title_card(im)
        card.save(out, "WEBP", quality=82, method=6)
        return card.size
    # crop to 2:3 if wildly off, otherwise keep
    target = 2 / 3
    if abs(w / h - target) > 0.08:
        if w / h > target:
            nw = int(h * target)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = int(w / target)
            im = im.crop((0, 0, w, nh))
    im.thumbnail((600, 900), Image.LANCZOS)
    im.save(out, "WEBP", quality=82, method=6)
    return im.size


def main(force: bool = False) -> None:
    POSTERS.mkdir(parents=True, exist_ok=True)
    films = json.loads((DATA / "films.json").read_text(encoding="utf-8"))
    for f in films:
        slug = f["slug"]
        webp = POSTERS / f"{slug}.webp"
        if webp.exists() and not force:
            continue
        url = f.get("wikipedia_url")
        if not url:
            print(f"  - {slug}: no wikipedia url")
            continue
        try:
            time.sleep(2.5)
            src = original_image(wiki_title(url))
            if not src:
                print(f"  - {slug}: no page image")
                continue
            raw = fetch_bytes(src)
            (POSTERS / f"{slug}.src").write_bytes(raw)
            size = normalise(raw, webp)
            print(f"  + {slug}: {size[0]}x{size[1]} from {src.rsplit('/',1)[1][:60]}")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {slug}: {e}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
