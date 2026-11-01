"""Fill in real coordinates for every sector in data/sectors.json (OpenStreetMap Nominatim).
Entries that can't be found AND have no placeholder coordinates are removed.
Run from repo root:  python scripts/geocode_sectors.py   (~1 minute)
"""
import json
import time
from pathlib import Path

import requests

PATH = Path(__file__).resolve().parents[1] / "data" / "sectors.json"
ALIASES = {"Industrial Area Ph-1": "Industrial Area Phase 1", "Industrial Area Ph-2": "Industrial Area Phase 2"}
sectors = json.loads(PATH.read_text())
keep = []

for s in sectors:
    base = s["name"].split(" (")[0]
    query = ALIASES.get(base, base) + ", Chandigarh, India"
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search",
                         params={"q": query, "format": "json", "limit": 1},
                         headers={"User-Agent": "DhuaanMap-hackathon/1.0"}, timeout=30)
        hits = r.json() if r.ok else []
    except Exception:  # noqa: BLE001
        hits = []
    if hits:
        s["lat"], s["lon"] = round(float(hits[0]["lat"]), 5), round(float(hits[0]["lon"]), 5)
        print(f"OK      {s['name']}: {s['lat']}, {s['lon']}")
        keep.append(s)
    elif s.get("lat") is not None:
        print(f"KEEP    {s['name']} (placeholder)")
        keep.append(s)
    else:
        print(f"REMOVED {s['name']} (not found)")
    time.sleep(1.1)

PATH.write_text(json.dumps(keep, indent=1))
print(f"Saved {len(keep)} sectors to {PATH}")
