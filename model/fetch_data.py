"""Step 1: download training data.

- Hourly PM2.5 / PM10 for every sector (Open-Meteo Air Quality API, no key needed)
  for the +/-5 day windows around Diwali 2022, 2023, 2024, 2025.
- Hourly weather for the city (Open-Meteo archive) for the same windows,
  plus the weather FORECAST for the Diwali 2026 window (needed to predict).
- Stubble fires from NASA FIRMS (needs a free MAP_KEY:
  https://firms.modaps.eosdis.nasa.gov/api/map_key/ ), saved to data/raw/fires.csv

Run:  FIRMS_MAP_KEY=xxxx python model/fetch_data.py
"""
import io
import json
import os
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
SECTORS = json.loads((ROOT / "data" / "sectors.json").read_text())

CITY = (30.7333, 76.7794)
DIWALI = {2022: "2022-10-24", 2023: "2023-11-12", 2024: "2024-10-31", 2025: "2025-10-20"}
DIWALI_2026 = "2026-11-08"
WINDOW = 5

AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WX_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
# Punjab + Haryana bounding box: west,south,east,north
FIRMS_BBOX = "73.5,28.5,78.5,32.6"


def window(day: str):
    d = pd.Timestamp(day)
    return (d - pd.Timedelta(days=WINDOW)).strftime("%Y-%m-%d"), (d + pd.Timedelta(days=WINDOW)).strftime("%Y-%m-%d")


def get_json(url, params):
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            print(f"  retry {attempt + 1}: {e}")
            time.sleep(2)
    raise RuntimeError(f"Failed: {url} {params}")


def fetch_air_quality():
    frames = []
    for year, day in DIWALI.items():
        start, end = window(day)
        print(f"AQ {year}: {start} -> {end}")
        for s in SECTORS:
            j = get_json(AQ_URL, dict(latitude=s["lat"], longitude=s["lon"], hourly="pm2_5,pm10",
                                      start_date=start, end_date=end, timezone="Asia/Kolkata"))
            df = pd.DataFrame(j["hourly"])
            df["sector_id"], df["year"] = s["id"], year
            frames.append(df)
    out = pd.concat(frames, ignore_index=True)
    out.to_csv(RAW / "aq.csv", index=False)
    print(f"Saved aq.csv ({len(out)} rows)")


def fetch_weather():
    frames = []
    for year, day in DIWALI.items():
        start, end = window(day)
        j = get_json(ARCHIVE_URL, dict(latitude=CITY[0], longitude=CITY[1], hourly=WX_VARS,
                                       start_date=start, end_date=end, timezone="Asia/Kolkata"))
        df = pd.DataFrame(j["hourly"])
        df["year"] = year
        frames.append(df)
    start, end = window(DIWALI_2026)
    j = get_json(FORECAST_URL, dict(latitude=CITY[0], longitude=CITY[1], hourly=WX_VARS,
                                    start_date=start, end_date=end, timezone="Asia/Kolkata"))
    df = pd.DataFrame(j["hourly"])
    df["year"] = 2026
    frames.append(df)
    out = pd.concat(frames, ignore_index=True)
    out.to_csv(RAW / "weather.csv", index=False)
    print(f"Saved weather.csv ({len(out)} rows)")


def fetch_fires():
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        print("!! FIRMS_MAP_KEY not set: skipping fires. Get a key and re-run, the stubble feature needs it.")
        return
    frames = []
    for year, day in DIWALI.items():
        start, _ = window(day)
        # FIRMS area API: up to 10 days per call -> two calls cover the 11-day window
        for offset, days in ((0, 10), (10, 1)):
            date = (pd.Timestamp(start) + pd.Timedelta(days=offset)).strftime("%Y-%m-%d")
            for source in ("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"):
                url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{FIRMS_BBOX}/{days}/{date}"
                r = requests.get(url, timeout=120)
                if r.ok and r.text.startswith("latitude"):
                    df = pd.read_csv(io.StringIO(r.text))
                    if len(df):
                        frames.append(df[["latitude", "longitude", "acq_date", "frp"]])
                        print(f"Fires {date} (+{days}d) {source}: {len(df)}")
                        break
    if frames:
        out = pd.concat(frames, ignore_index=True).drop_duplicates()
        out.to_csv(RAW / "fires.csv", index=False)
        print(f"Saved fires.csv ({len(out)} rows)")


if __name__ == "__main__":
    fetch_weather()
    fetch_fires()
    fetch_air_quality()
