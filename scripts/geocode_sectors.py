"""Refresh data/sectors.json with real sector centroids from OpenStreetMap (Nominatim).
The coordinates in sectors.json are APPROXIMATE placeholders. Run this once before the demo:
    python scripts/geocode_sectors.py
Nominatim allows ~1 request/second, so this takes ~30 seconds.
"""
import json
import time
from pathlib import Path

import requests

PATH = Path(__file__).resolve().parents[1] / "data" / "sectors.json"
sectors = json.loads(PATH.read_text())

for s in sectors:
    query = s["name"].split(" (")[0] + ", Chandigarh, India"
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "json", "limit": 1},
        headers={"User-Agent": "DhuaanMap-hackathon/1.0"},
        timeout=30,
    )
    hits = r.json() if r.ok else []
    if hits:
        s["lat"], s["lon"] = round(float(hits[0]["lat"]), 4), round(float(hits[0]["lon"]), 4)
        print(f"OK   {s['name']}: {s['lat']}, {s['lon']}")
    else:
        print(f"KEEP {s['name']} (not found, placeholder kept)")
    time.sleep(1.1)

PATH.write_text(json.dumps(sectors, indent=2))
print("Saved", PATH)
