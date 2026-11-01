"""Evaluate the DhuaanMap model.  Run from repo root:  python model/evaluate.py
Train on Diwali 2022-2024, test on Diwali 2025 (never seen), compare with simple baselines,
then leave-one-year-out cross-validation."""
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train import FEATURES, build, category, pm25_to_aqi  # noqa: E402

try:
    import lightgbm as lgb

    def make():
        return lgb.LGBMRegressor(n_estimators=400, learning_rate=0.05, num_leaves=31, min_child_samples=20, verbose=-1)
    NAME = "LightGBM"
except Exception:  # noqa: BLE001
    from sklearn.ensemble import RandomForestRegressor

    def make():
        return RandomForestRegressor(n_estimators=100, max_depth=10, min_samples_leaf=5, n_jobs=-1, random_state=42)
    NAME = "Random Forest"


def scores(y, p):
    a_true, a_pred = pm25_to_aqi(y), pm25_to_aqi(np.clip(p, 0, None))
    c_true = np.array([category(int(v)) for v in a_true])
    c_pred = np.array([category(int(v)) for v in a_pred])
    order = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]
    idx = {c: i for i, c in enumerate(order)}
    within1 = np.mean([abs(idx[a] - idx[b]) <= 1 for a, b in zip(c_true, c_pred)])
    return {"MAE": mean_absolute_error(y, p), "RMSE": mean_squared_error(y, p) ** 0.5, "R2": r2_score(y, p),
            "AQI cat acc": np.mean(c_true == c_pred), "within 1 cat": within1}


def show(name, s):
    print(f"{name:<28} MAE {s['MAE']:6.1f}  RMSE {s['RMSE']:6.1f}  R2 {s['R2']:5.2f}  "
          f"category {s['AQI cat acc']*100:5.1f}%  within-1 {s['within 1 cat']*100:5.1f}%")


hist, _, _ = build()
tr, te = hist[hist["year"] < 2025], hist[hist["year"] == 2025]
model = make().fit(tr[FEATURES], tr["pm2_5"])
y, pred = te["pm2_5"].values, model.predict(te[FEATURES])

# Baselines: always predict the average; and average for the same day/hour in past years
b_mean = np.full_like(y, tr["pm2_5"].mean())
lookup = tr.groupby(["day_offset", "hour"])["pm2_5"].mean()
b_hour = np.array([lookup.get((d, h), tr["pm2_5"].mean()) for d, h in zip(te["day_offset"], te["hour"])])

print(f"\n=== Test on Diwali 2025 (model: {NAME}, PM2.5 in ug/m3) ===")
show("Our model", scores(y, pred))
show("Baseline: overall average", scores(y, b_mean))
show("Baseline: same day/hour avg", scores(y, b_hour))

night = te["is_diwali_night"].values == 1
if night.any():
    show("Our model, Diwali night only", scores(y[night], pred[night]))

city = te.assign(pred=pred).groupby("time")[["pm2_5", "pred"]].mean()
gap = abs((city["pm2_5"].idxmax() - city["pred"].idxmax()) / np.timedelta64(1, "h"))
print(f"Peak timing: actual {city['pm2_5'].idxmax()}, predicted {city['pred'].idxmax()} (off by {gap:.0f} h)")
print(f"Peak level:  actual {city['pm2_5'].max():.0f}, predicted {city['pred'].max():.0f} ug/m3")

print("\n=== Leave-one-year-out (train on other years, test on this one) ===")
for yr in sorted(hist["year"].unique()):
    a, b = hist[hist["year"] != yr], hist[hist["year"] == yr]
    m = make().fit(a[FEATURES], a["pm2_5"])
    print(f"Diwali {yr}: MAE {mean_absolute_error(b['pm2_5'], m.predict(b[FEATURES])):6.1f}")
