"""Evaluate + compare model setups for DhuaanMap.   Run from repo root:  python model/evaluate.py

Every setup is scored with leave-one-year-out cross-validation (train on 3 Diwalis, test on the
4th, repeat for each year). That is a fairer test than one split. The setup with the lowest
average error wins, and the script tells you what to change.
Does NOT change past.json / forecast.json or anything the app uses."""
import sys
import warnings
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from train import FEATURES, build, category, pm25_to_aqi  # noqa: E402

try:
    import lightgbm as lgb
except Exception:  # noqa: BLE001
    lgb = None

ORDER = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]
IDX = {c: i for i, c in enumerate(ORDER)}
DROP = {"day_offset", "lat", "lon"}  # features that let the model memorise a particular year/place
SLIM = [f for f in FEATURES if f not in DROP]


def lgb_small():
    return lgb.LGBMRegressor(n_estimators=150, learning_rate=0.05, num_leaves=7, max_depth=3,
                             min_child_samples=300, subsample=0.8, subsample_freq=1,
                             colsample_bytree=0.8, reg_lambda=5, verbose=-1)


def rf_small():
    return RandomForestRegressor(n_estimators=100, max_depth=5, min_samples_leaf=200, n_jobs=-1, random_state=42)


def ridge():
    return make_pipeline(StandardScaler(), Ridge(alpha=10.0))


# name -> (model factory or None for baseline, feature list, blend weight with day/hour baseline)
SETUPS = {
    "Baseline: overall average": (None, None, "mean"),
    "Baseline: same day/hour avg": (None, None, "hour"),
    "Ridge (linear), slim features": (ridge, SLIM, 0.0),
    "Random Forest small, slim": (rf_small, SLIM, 0.0),
    "Random Forest small, slim + 50% baseline": (rf_small, SLIM, 0.5),
}
if lgb is not None:
    SETUPS["LightGBM original, all features"] = (
        lambda: lgb.LGBMRegressor(n_estimators=400, learning_rate=0.05, num_leaves=31, min_child_samples=20, verbose=-1),
        FEATURES, 0.0)
    SETUPS["LightGBM small, slim features"] = (lgb_small, SLIM, 0.0)
    SETUPS["LightGBM small, slim + 50% baseline"] = (lgb_small, SLIM, 0.5)


def baseline(train_df, test_df, kind):
    if kind == "mean":
        return np.full(len(test_df), train_df["pm2_5"].mean())
    lookup = train_df.groupby(["day_offset", "hour"])["pm2_5"].mean()
    fallback = train_df["pm2_5"].mean()
    return np.array([lookup.get((d, h), fallback) for d, h in zip(test_df["day_offset"], test_df["hour"])])


def predict(setup, train_df, test_df):
    factory, feats, blend = setup
    if factory is None:
        return baseline(train_df, test_df, blend)
    p = factory().fit(train_df[feats], train_df["pm2_5"]).predict(test_df[feats])
    if blend:
        p = (1 - blend) * p + blend * baseline(train_df, test_df, "hour")
    return np.clip(p, 0, None)


def scores(y, p):
    ct = [category(int(v)) for v in pm25_to_aqi(y)]
    cp = [category(int(v)) for v in pm25_to_aqi(p)]
    return dict(MAE=mean_absolute_error(y, p), RMSE=mean_squared_error(y, p) ** 0.5, R2=r2_score(y, p),
                cat=np.mean([a == b for a, b in zip(ct, cp)]),
                within1=np.mean([abs(IDX[a] - IDX[b]) <= 1 for a, b in zip(ct, cp)]))


hist, _, _ = build()
years = sorted(hist["year"].unique())
print(f"\nRows: {len(hist)} | Diwalis: {years} | features: {len(FEATURES)} (slim: {len(SLIM)})")
print("\n=== Leave-one-year-out MAE (ug/m3, lower is better) ===")
print(f"{'Setup':<44}" + "".join(f"{y:>8}" for y in years) + f"{'AVG':>8}")
cv = {}
for name, setup in SETUPS.items():
    maes = []
    for yr in years:
        tr, te = hist[hist["year"] != yr], hist[hist["year"] == yr]
        maes.append(mean_absolute_error(te["pm2_5"], predict(setup, tr, te)))
    cv[name] = np.mean(maes)
    print(f"{name:<44}" + "".join(f"{m:8.1f}" for m in maes) + f"{cv[name]:8.1f}")

best_model = min((n for n in cv if not n.startswith("Baseline")), key=cv.get)
best_base = min((n for n in cv if n.startswith("Baseline")), key=cv.get)
gain = (cv[best_base] - cv[best_model]) / cv[best_base] * 100

# Detailed report for the best model on the held-out Diwali 2025
tr, te = hist[hist["year"] < 2025], hist[hist["year"] == 2025]
y = te["pm2_5"].values
print("\n=== Detail: train 2022-24, test Diwali 2025 ===")
for name in (best_model, best_base):
    s = scores(y, predict(SETUPS[name], tr, te))
    print(f"{name:<44} MAE {s['MAE']:5.1f}  RMSE {s['RMSE']:5.1f}  R2 {s['R2']:5.2f}  "
          f"category {s['cat']*100:4.1f}%  within-1 {s['within1']*100:4.1f}%")
p = predict(SETUPS[best_model], tr, te)
night = te["is_diwali_night"].values == 1
if night.any():
    s = scores(y[night], p[night])
    print(f"{'  ...Diwali night only':<44} MAE {s['MAE']:5.1f}  category {s['cat']*100:4.1f}%  within-1 {s['within1']*100:4.1f}%")
city = te.assign(pred=p).groupby("time")[["pm2_5", "pred"]].mean()
gap = abs((city["pm2_5"].idxmax() - city["pred"].idxmax()) / np.timedelta64(1, "h"))
print(f"  Peak: actual {city['pm2_5'].max():.0f} at {city['pm2_5'].idxmax()}, "
      f"predicted {city['pred'].max():.0f} at {city['pred'].idxmax()} (off by {gap:.0f} h)")

print("\n=== Verdict ===")
print(f"Best model setup: {best_model}  (avg MAE {cv[best_model]:.1f})")
print(f"Best baseline:    {best_base}  (avg MAE {cv[best_base]:.1f})")
if gain > 0:
    print(f"-> Model beats the baseline by {gain:.0f}%. Use this setup in train.py.")
else:
    print(f"-> Model is {-gain:.0f}% worse than the baseline: data is the bottleneck (only {len(years)} Diwalis).")
