"""DhuaanMap API.
Serves data/processed/past.json and forecast.json (made by model/train.py).
If those files don't exist yet, it serves realistic MOCK data so the frontend works from minute one.

Run: uvicorn main:app --reload   (from the backend/ folder)
Docs: http://127.0.0.1:8000/docs
"""
import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
SECTORS = [s for s in json.loads((ROOT / "data" / "sectors.json").read_text()) if s.get("lat") is not None]
DIWALI = {"past": "2025-10-20", "forecast": "2026-11-08"}
Mode = Literal["past", "forecast"]

app = FastAPI(title="DhuaanMap API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_cache: dict = {}


def category(aqi: int) -> str:
    for limit, name in ((50, "Good"), (100, "Satisfactory"), (200, "Moderate"), (300, "Poor"), (400, "Very Poor")):
        if aqi <= limit:
            return name
    return "Severe"


def mock(mode: str) -> dict:
    rnd = random.Random(42 if mode == "past" else 7)
    diwali = datetime.fromisoformat(DIWALI[mode])
    eve = diwali + timedelta(hours=20)
    start = diwali - timedelta(days=5)
    bias = {s["id"]: rnd.uniform(-20, 30) for s in SECTORS}
    steps = []
    for h in range(11 * 24):
        t = start + timedelta(hours=h)
        hrs = (t - eve).total_seconds() / 3600
        day = (t.date() - diwali.date()).days
        base = 140 + 22 * (5 - abs(day)) + 25 * math.sin((t.hour - 4) / 24 * 2 * math.pi + math.pi)
        spike = 230 * math.exp(-(((hrs - 3) / 4) ** 2))
        crackers = 0.10 + 0.55 * math.exp(-(((hrs - 3) / 8) ** 2))
        stubble = (1 - crackers) * 0.45
        traffic = (1 - crackers) * 0.30
        weather = 1 - crackers - stubble - traffic
        sectors = []
        for s in SECTORS:
            aqi = int(max(40, min(500, base + spike + bias[s["id"]] + rnd.uniform(-15, 15))))
            sectors.append({**s, "aqi": aqi, "pm25": round(aqi * 0.6, 1), "category": category(aqi),
                            "sources": {"crackers": round(crackers, 3), "stubble": round(stubble, 3),
                                        "traffic": round(traffic, 3), "weather": round(weather, 3)}})
        n_fires = 30 + 15 * (5 - abs(day))
        fires = [{"lat": round(rnd.uniform(29.8, 31.2), 4), "lon": round(rnd.uniform(74.5, 76.6), 4),
                  "frp": round(rnd.uniform(2, 40), 1)} for _ in range(n_fires)]
        steps.append({"time": t.strftime("%Y-%m-%dT%H:%M:%S") + "+05:30", "day_offset": day,
                      "hours_from_diwali_eve": hrs, "sectors": sectors, "fires": fires,
                      "wind": {"speed_kmh": round(4 + 3 * rnd.random(), 1), "direction_deg": int(rnd.uniform(280, 330))}})
    return {"mode": mode, "diwali": DIWALI[mode], "steps": steps, "mock": True}


def load(mode: str) -> dict:
    if mode not in _cache:
        p = PROC / f"{mode}.json"
        _cache[mode] = json.loads(p.read_text()) if p.exists() else mock(mode)
    return _cache[mode]


def parse_time(s: str) -> datetime:
    return datetime.fromisoformat(s[:19])


@app.get("/health")
def health():
    return {"status": "ok", "past_is_mock": load("past").get("mock", False),
            "forecast_is_mock": load("forecast").get("mock", False)}


@app.get("/sectors/geojson")
def sectors_geojson():
    """Sector polygons made by scripts/sector_polygons.py."""
    p = ROOT / "data" / "sectors.geojson"
    if not p.exists():
        raise HTTPException(404, "Run scripts/sector_polygons.py first")
    return json.loads(p.read_text())


@app.get("/timeline")
def timeline(mode: Mode = "past"):
    """All available time steps, so the frontend can build the adaptive slider."""
    d = load(mode)
    return {"diwali": d["diwali"], "steps": [{"time": s["time"], "day_offset": s["day_offset"],
                                              "hours_from_diwali_eve": s["hours_from_diwali_eve"]} for s in d["steps"]]}


@app.get("/map")
def map_at(mode: Mode = "past", t: Optional[str] = Query(None, description="ISO time; nearest step is returned")):
    d = load(mode)
    if not t:
        t = d["diwali"] + "T22:00:00"
    target = parse_time(t)
    return min(d["steps"], key=lambda s: abs((parse_time(s["time"]) - target).total_seconds()))


@app.get("/sector/{sector_id}")
def sector_trend(sector_id: str, mode: Mode = "past"):
    """AQI of one sector across the whole +/-5 day window (for the trend chart)."""
    d = load(mode)
    trend = []
    for s in d["steps"]:
        for sec in s["sectors"]:
            if sec["id"] == sector_id:
                trend.append({"time": s["time"], "aqi": sec["aqi"], "sources": sec["sources"]})
    if not trend:
        raise HTTPException(404, f"Unknown sector {sector_id}")
    return {"id": sector_id, "diwali": d["diwali"], "trend": trend}


@app.get("/whatif")
def what_if(mode: Mode = "forecast", t: Optional[str] = None, cracker_cut: float = 0.0, stubble_cut: float = 0.0):
    """Stretch: reduce crackers / stubble share by a fraction (0-1) and recompute AQI."""
    step = map_at(mode, t)
    out = []
    for sec in step["sectors"]:
        src = sec["sources"]
        factor = 1 - src["crackers"] * cracker_cut - src["stubble"] * stubble_cut
        aqi = int(sec["aqi"] * max(factor, 0.1))
        out.append({**sec, "aqi": aqi, "category": category(aqi)})
    return {**step, "sectors": out, "whatif": {"cracker_cut": cracker_cut, "stubble_cut": stubble_cut}}
