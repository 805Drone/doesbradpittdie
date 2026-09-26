"""Merge data/trailers_batch*.json into data/trailers.json and drop stale poster-derived backdrops."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
merged: dict = {}
for p in sorted(DATA.glob("trailers_batch*.json")):
    merged.update({k: v for k, v in json.loads(p.read_text(encoding="utf-8")).items() if v})
(DATA / "trailers.json").write_text(json.dumps(merged, indent=2), encoding="utf-8")
# any backdrop built from a poster for a slug that now has a trailer must be rebuilt
removed = 0
for slug in merged:
    for f in (DATA / "backdrops" / f"{slug}.webp", DATA / "backdrops" / f"{slug}.lqip.webp"):
        if f.exists():
            f.unlink()
            removed += 1
print(f"{len(merged)} trailers; removed {removed} files for refetch")
