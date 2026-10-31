"""Step 2: build features, train LightGBM, compute SHAP source attribution,
export JSON for the app (data/processed/past.json and forecast.json).

Run: python model/train.py
"""
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
RAW, PROC = ROOT / "data" / "raw", ROOT / "data" / "processed"
PROC.mkdir(parents=True, exist_ok=True)
SECTORS = pd.DataFrame(json.loads((ROOT / "data" / "sectors.json").read_text()))
CITY = (30.7333, 76.7794)
DIWALI = {2022: "2022-10-24", 2023: "2023-11-12", 2024: "2024-10-31", 2025: "2025-10-20", 2026: "2026-11-08"}

# No lag features on purpose: we must forecast 2026 without knowing future AQI.
GROUPS = {
    "crackers": ["day_offset", "hours_from_diwali_eve", "is_diwali_night"],
    "stubble": ["fires_200km", "fires_upwind"],
    "traffic": ["hour", "lat", "lon"],
    "weather": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_dir_sin", "wind_dir_cos"],
}
FEATURES = [f for g in GROUPS.values() for f in g]


# ---------- helpers ----------
def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    x = np.sin(lon2 - lon1) * np.cos(lat2)
    y = np.cos(lat1) * np.sin(lat2) - np.sin(lat1) * np.cos(lat2) * np.cos(lon2 - lon1)
    return (np.degrees(np.arctan2(x, y)) + 360) % 360


def pm25_to_aqi(pm):
    # Indian NAQI PM2.5 breakpoints (applied hourly as an approximation)
    return np.interp(pm, [0, 30, 60, 90, 120, 250, 380], [0, 50, 100, 200, 300, 400, 500]).round().astype(int)


def category(aqi):
    for limit, name in ((50, "Good"), (100, "Satisfactory"), (200, "Moderate"), (300, "Poor"), (400, "Very Poor")):
        if aqi <= limit:
            return name
    return "Severe"


def add_time_features(df):
    df["diwali"] = pd.to_datetime(df["year"].map(DIWALI))
    eve = df["diwali"] + pd.Timedelta(hours=20)  # fireworks start ~8 PM
    df["hours_from_diwali_eve"] = (df["time"] - eve) / pd.Timedelta(hours=1)
    df["day_offset"] = (df["time"].dt.normalize() - df["diwali"]).dt.days
    df["hour"] = df["time"].dt.hour
    df["is_diwali_night"] = df["hours_from_diwali_eve"].between(-2, 10).astype(int)
    df["date"] = df["time"].dt.normalize()
    return df


# ---------- fires ----------
def load_fires(weather):
    path = RAW / "fires.csv"
    empty = pd.DataFrame(columns=["date", "fires_200km", "fires_upwind"])
    if not path.exists():
        print("!! data/raw/fires.csv missing: stubble features will be zero.")
        return empty, pd.DataFrame(columns=["latitude", "longitude", "frp", "date"])
    f = pd.read_csv(path)
    f["date"] = pd.to_datetime(f["acq_date"]).dt.normalize()
    f = f[haversine_km(CITY[0], CITY[1], f["latitude"], f["longitude"]) <= 200].copy()
    f["bearing"] = bearing_deg(CITY[0], CITY[1], f["latitude"], f["longitude"])

    w = weather.copy()
    w["date"] = w["time"].dt.normalize()
    rad = np.radians(w["wind_direction_10m"])
    w["s"], w["c"] = np.sin(rad), np.cos(rad)
    daily = w.groupby("date")[["s", "c"]].mean()
    daily["wind_from"] = (np.degrees(np.arctan2(daily["s"], daily["c"])) + 360) % 360
    f = f.join(daily["wind_from"], on="date")
    # wind_direction_10m = direction wind comes FROM -> fire is upwind if its bearing matches
    f["upwind"] = (np.abs((f["bearing"] - f["wind_from"] + 180) % 360 - 180) <= 45).astype(int)
    agg = f.groupby("date").agg(fires_200km=("upwind", "size"), fires_upwind=("upwind", "sum")).reset_index()
    return agg, f[["latitude", "longitude", "frp", "date"]]


# ---------- build datasets ----------
def build():
    aq = pd.read_csv(RAW / "aq.csv", parse_dates=["time"])
    wx = pd.read_csv(RAW / "weather.csv", parse_dates=["time"])
    wx["wind_dir_sin"] = np.sin(np.radians(wx["wind_direction_10m"]))
    wx["wind_dir_cos"] = np.cos(np.radians(wx["wind_direction_10m"]))
    fire_daily, fire_points = load_fires(wx[wx["year"] < 2026])

    hist = aq.merge(wx, on=["time", "year"]).merge(SECTORS[["id", "lat", "lon"]], left_on="sector_id", right_on="id")
    hist = add_time_features(hist).merge(fire_daily, on="date", how="left")
    hist[["fires_200km", "fires_upwind"]] = hist[["fires_200km", "fires_upwind"]].fillna(0)
    hist = hist.dropna(subset=["pm2_5"])

    # 2026: weather forecast x sectors, fires = historical average for the same day_offset
    fut = wx[wx["year"] == 2026].merge(SECTORS[["id", "lat", "lon"]].rename(columns={"id": "sector_id"}), how="cross")
    fut = add_time_features(fut)
    fire_by_offset = hist.groupby("day_offset")[["fires_200km", "fires_upwind"]].mean().reset_index()
    fut = fut.merge(fire_by_offset, on="day_offset", how="left").fillna({"fires_200km": 0, "fires_upwind": 0})
    return hist, fut, fire_points


def train(hist):
    params = dict(n_estimators=400, learning_rate=0.05, num_leaves=31, min_child_samples=20, verbose=-1)
    train_df, test_df = hist[hist["year"] < 2025], hist[hist["year"] == 2025]
    if len(train_df) and len(test_df):
        m = lgb.LGBMRegressor(**params).fit(train_df[FEATURES], train_df["pm2_5"])
        mae = mean_absolute_error(test_df["pm2_5"], m.predict(test_df[FEATURES]))
        print(f"Validation (train 2022-24, test Diwali 2025): MAE = {mae:.1f} ug/m3")
    model = lgb.LGBMRegressor(**params).fit(hist[FEATURES], hist["pm2_5"])
    model.booster_.save_model(str(ROOT / "model" / "lgbm.txt"))
    return model


def source_shares(model, X):
    sv = shap.TreeExplainer(model).shap_values(X)
    sv = pd.DataFrame(np.clip(sv, 0, None), columns=FEATURES, index=X.index)  # only what pushes pollution UP
    shares = pd.DataFrame({g: sv[cols].sum(axis=1) for g, cols in GROUPS.items()})
    total = shares.sum(axis=1).replace(0, np.nan)
    return shares.div(total, axis=0).fillna(0.25).round(3)


def export(df, value_col, fire_points, mode, path):
    df = df.copy()
    df["aqi"] = pm25_to_aqi(df[value_col])
    names = SECTORS.set_index("id")["name"].to_dict()
    fp_2025 = fire_points.copy()
    fp_2025["day_offset"] = (fp_2025["date"] - pd.Timestamp(DIWALI[2025])).dt.days
    steps = []
    for t, g in df.groupby("time"):
        day_offset = int(g["day_offset"].iloc[0])
        if mode == "past":
            fires = fire_points[fire_points["date"] == t.normalize()]
        else:  # expected fires: same day_offset last year
            fires = fp_2025[fp_2025["day_offset"] == day_offset]
        fires = fires.nlargest(300, "frp") if len(fires) > 300 else fires
        steps.append({
            "time": t.strftime("%Y-%m-%dT%H:%M:%S") + "+05:30",
            "day_offset": day_offset,
            "hours_from_diwali_eve": float(g["hours_from_diwali_eve"].iloc[0]),
            "sectors": [{
                "id": r.sector_id, "name": names.get(r.sector_id, r.sector_id), "lat": r.lat, "lon": r.lon,
                "aqi": int(r.aqi), "pm25": round(float(getattr(r, value_col)), 1), "category": category(int(r.aqi)),
                "sources": {k: float(getattr(r, k)) for k in GROUPS},
            } for r in g.itertuples()],
            "fires": [{"lat": round(float(a), 4), "lon": round(float(b), 4), "frp": round(float(c), 1)}
                      for a, b, c in fires[["latitude", "longitude", "frp"]].itertuples(index=False)],
            "wind": {"speed_kmh": round(float(g["wind_speed_10m"].iloc[0]), 1),
                     "direction_deg": round(float(g["wind_direction_10m"].iloc[0]))},
        })
    year = 2025 if mode == "past" else 2026
    path.write_text(json.dumps({"mode": mode, "diwali": DIWALI[year], "steps": steps}))
    print(f"Saved {path.name}: {len(steps)} time steps")


if __name__ == "__main__":
    hist, fut, fire_points = build()
    model = train(hist)

    past = hist[hist["year"] == 2025].copy()
    past = past.join(source_shares(model, past[FEATURES]))
    export(past, "pm2_5", fire_points, "past", PROC / "past.json")

    fut["pm25_pred"] = np.clip(model.predict(fut[FEATURES]), 0, None)
    fut = fut.join(source_shares(model, fut[FEATURES]))
    export(fut, "pm25_pred", fire_points, "forecast", PROC / "forecast.json")
