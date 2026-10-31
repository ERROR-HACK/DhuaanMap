# Scope of Work: DhuaanMap
**Event:** RootAccess Overnight Sustainability Hackathon, TIET Patiala · 31 Oct – 1 Nov 2026
**Problem Statement:** AI-Powered Neighborhood-Level Air Pollution Prediction System

---

## 1. Objective
Build a web platform that predicts and visualizes **sector-level air pollution in Chandigarh** from **5 days before to 5 days after Diwali**. It separates the contribution of **firecrackers, stubble burning, traffic and weather**, using historical AQI, weather, fire and road data.

## 2. Target Users
- **Citizens:** know when and where air is unsafe
- **Municipal Corporation / Pollution Control Committee:** decide where to act and on what (crackers vs stubble)
- **Hospitals and schools:** plan health advisories

## 3. In Scope
| Area | Work |
|---|---|
| Data | Collect Chandigarh station AQI (CPCB/OpenAQ), Open-Meteo weather and gridded air quality, NASA FIRMS fire points, OSM sector boundaries. Windows: Diwali 2025 (20 Oct) ±5 days and Diwali 2026 (8 Nov) ±5 days. |
| ML | Feature engineering; LightGBM model for hourly PM2.5/AQI per sector; SHAP-based 4-way source attribution. |
| Backend | FastAPI endpoints: `/map`, `/sector/{id}`, `/fires`, `/whatif` (stretch). Pre-computed JSON for reliability. |
| Frontend | React + Leaflet map with sector heatmap, adaptive ±5-day slider, fire and wind overlay, source breakdown panel, trend chart, Past/Forecast toggle. |
| Docs | README, architecture diagram, SOW, 3–4 slide pitch deck. |

## 4. Out of Scope
Real-time traffic APIs, IoT hardware, user login, mobile apps, cities other than Chandigarh, production deployment at scale.

## 5. Deliverables by Round
| Round | Deadline | Deliverables | Points |
|---|---|---|---|
| **1 · Ideation & Core Setup** | 1:30 AM | Finalized problem and scope · Architecture diagram · README · Git repo with skeleton (frontend map + dummy slider, FastAPI stub, data folder) | 10 |
| **2 · MVP & Pitch Draft** | 6:00 AM | Trained model · Real data on map · Working slider, fire overlay, source panel · 3–4 slide deck draft | 20 |
| **3 · Grand Finale** | 8:00 AM | End-to-end working demo · 3-minute pitch · Stretch features if done · Backup demo video | 30 |

## 6. Timeline
| Time | Task |
|---|---|
| Now → 12:00 AM | Lock scope, roles, repo; bolt.new UI scaffold; import to Cursor |
| 12:00 → 1:30 AM | Skeleton running (map + dummy slider + FastAPI stub); docs finalized |
| 1:30 → 2:30 AM | **Checkpoint 1**; note mentor feedback |
| 2:30 → 4:30 AM | Data collection, cleaning, feature engineering, model training |
| 4:30 → 6:00 AM | Export predictions to JSON, connect API to frontend, draft slides |
| 6:00 → 7:00 AM | **Checkpoint 2**; fix blockers |
| 7:00 → 8:00 AM | Polish UI, stretch features, record backup demo, rehearse pitch |
| 8:00 → 9:00 AM | **Grand Finale** |

## 7. Roles & Responsibilities
| Role | Owner | Responsibilities |
|---|---|---|
| Team Lead / Docs | _Name_ | Scope, README, SOW, slides, mentor interaction, integration |
| ML & Data | _Name_ | Data collection, features, model, SHAP, JSON export |
| Backend | _Name_ | FastAPI, data contract, serving pre-computed predictions |
| Frontend | _Name_ | bolt.new scaffold, Leaflet map, slider, overlays, charts |

## 8. Success Criteria
- Slider moves from Day −5 to +5, and sector colors, fires and wind update correctly.
- Diwali night is shown hour by hour, and the AQI spike is clearly visible.
- Stubble fires are visibly linked to AQI rise when wind blows from the fields.
- Source breakdown is shown for any selected sector and time.
- The demo runs end to end offline from pre-computed data.

## 9. Assumptions
- Public data sources are reachable at the venue.
- Station data from 3 CPCB stations plus gridded data is enough to estimate sector-level values.
- Traffic is approximated with OSM road density and hour-of-day.

## 10. Risks & Mitigation
| Risk | Mitigation |
|---|---|
| Missing or patchy station data | Use Open-Meteo gridded air quality as fallback |
| NASA FIRMS key or API delay | Download CSV early; keep a cached copy |
| Model underperforms | Present attribution and past data as the hero; show honest error metrics |
| Wi-Fi fails at demo | Pre-computed JSON + recorded demo video |
| Frontend/backend mismatch | Fixed JSON data contract (see README) |
