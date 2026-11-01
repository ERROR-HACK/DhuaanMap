"""Build data/sectors.geojson: one polygon per sector, no gaps.
1. Real sector outlines from OpenStreetMap (Overpass API) where available.
2. Voronoi tiles around sector centres for the rest, clipped to the city boundary.
Run AFTER geocode_sectors.py:   python scripts/sector_polygons.py
Needs: pip install shapely requests
"""
import json
import re
from pathlib import Path

import requests
from shapely.geometry import LineString, MultiPoint, Point, Polygon, mapping
from shapely.ops import polygonize, unary_union
from shapely.ops import voronoi_diagram

ROOT = Path(__file__).resolve().parents[1]
SECTORS = [s for s in json.loads((ROOT / "data" / "sectors.json").read_text()) if s.get("lat") is not None]
OUT = ROOT / "data" / "sectors.geojson"
FRONT_COPY = ROOT / "frontend" / "public" / "sectors.geojson"
OVERPASS = "https://overpass-api.de/api/interpreter"
KM2_PER_DEG2 = 111.0 * 95.6  # approx at Chandigarh latitude


def overpass(query):
    try:
        r = requests.post(OVERPASS, data={"data": query}, timeout=120)
        r.raise_for_status()
        return r.json().get("elements", [])
    except Exception as e:  # noqa: BLE001
        print(f"Overpass failed ({e}); using fallback")
        return []


def element_polygons(el):
    """Turn an Overpass way/relation (out geom) into shapely polygons."""
    if el["type"] == "way" and "geometry" in el:
        pts = [(p["lon"], p["lat"]) for p in el["geometry"]]
        if len(pts) >= 4 and pts[0] == pts[-1]:
            return [Polygon(pts)]
        return []
    if el["type"] == "relation":
        lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
                 for m in el.get("members", []) if m.get("role") in ("outer", "") and "geometry" in m]
        return list(polygonize(unary_union(lines))) if lines else []
    return []


def city_boundary():
    els = overpass('[out:json][timeout:90];relation["name"="Chandigarh"]["boundary"="administrative"];out geom;')
    polys = [p for el in els for p in element_polygons(el)]
    if polys:
        return unary_union(polys).buffer(0)
    print("City boundary not found; using hull of sector centres")
    return MultiPoint([(s["lon"], s["lat"]) for s in SECTORS]).convex_hull.buffer(0.008)


def osm_sector_polygons():
    q = ('[out:json][timeout:90];area["name"="Chandigarh"]["boundary"="administrative"]->.a;'
         '(way["name"~"^Sector[- ]?[0-9]+[A-D]?$"](area.a);relation["name"~"^Sector[- ]?[0-9]+[A-D]?$"](area.a););out geom;')
    found = {}
    for el in overpass(q):
        m = re.match(r"^Sector[- ]?(\d+)", el.get("tags", {}).get("name", ""))
        if not m:
            continue
        sid = f"S{int(m.group(1))}"
        for poly in element_polygons(el):
            area_km2 = poly.area * KM2_PER_DEG2
            if 0.05 < area_km2 < 5:  # skip tiny buildings and huge areas
                found.setdefault(sid, []).append(poly)
    return {sid: unary_union(p).buffer(0) for sid, p in found.items()}


def main():
    ids = {s["id"] for s in SECTORS}
    boundary = city_boundary()
    osm = {k: v for k, v in osm_sector_polygons().items() if k in ids}
    print(f"OSM outlines found for {len(osm)} of {len(SECTORS)} sectors")

    # Voronoi tiles for every sector, clipped to the city
    pts = MultiPoint([(s["lon"], s["lat"]) for s in SECTORS])
    cells = voronoi_diagram(pts, envelope=boundary.envelope.buffer(0.05))
    taken = unary_union(list(osm.values())) if osm else None

    features = []
    for s in SECTORS:
        if s["id"] in osm:
            geom, source = osm[s["id"]], "osm"
        else:
            p = Point(s["lon"], s["lat"])
            cell = next((c for c in cells.geoms if c.contains(p)), None)
            if cell is None:
                continue
            geom = cell.intersection(boundary)
            if taken is not None:
                geom = geom.difference(taken)
            source = "voronoi"
        if geom.is_empty:
            continue
        features.append({"type": "Feature", "properties": {"id": s["id"], "name": s["name"], "source": source},
                         "geometry": mapping(geom.simplify(0.00005))})

    fc = {"type": "FeatureCollection", "features": features}
    OUT.write_text(json.dumps(fc))
    if FRONT_COPY.parent.exists():
        FRONT_COPY.write_text(json.dumps(fc))
        print(f"Copied to {FRONT_COPY}")
    print(f"Saved {OUT} with {len(features)} sector polygons")


if __name__ == "__main__":
    main()
