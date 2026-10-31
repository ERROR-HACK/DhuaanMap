# Prompt to paste into bolt.new

Build a React + Vite + TypeScript + Tailwind web app called **DhuaanMap**: a sector-level Diwali air pollution dashboard for **Chandigarh, India**. Use **react-leaflet** for the map and **Recharts** for charts. Dark theme with green accents. Use only mock data for now, stored in `src/data/mock.json`, but keep all data access in one file, `src/api.ts`, so I can swap in a real FastAPI backend later (`GET /map?mode=past|forecast&t=<ISO time>`).

## Layout
- **Top bar:** app name "DhuaanMap", subtitle "Chandigarh · Diwali Air Quality", and a toggle **Past (Diwali 2025, 20 Oct)** / **Forecast (Diwali 2026, 8 Nov)**.
- **Center:** full-height Leaflet map centered on Chandigarh (lat 30.7333, lon 76.7794, zoom 12), dark tile layer.
- **Bottom:** an **adaptive time slider** from Day −5 to Day +5. Use daily steps on normal days, but **hourly steps on Diwali night (6 PM to 6 AM)**, so the slider has more resolution there. Show the selected date and time and a "Diwali" marker. Add a play/pause button that animates through the slider.
- **Right panel:** opens when a sector is clicked. Show:
  - Sector name, AQI number, and category badge
  - A donut chart with the source breakdown: Crackers, Stubble, Traffic, Weather
  - A line chart of that sector's AQI across the full ±5-day window, with a vertical line at Diwali
  - A short health advisory based on AQI category

## Map layers
1. **Sectors:** circles (or polygons if available) for about 30 Chandigarh sectors, colored by AQI using the Indian AQI scale:
   - Good 0–50: green
   - Satisfactory 51–100: light green
   - Moderate 101–200: yellow
   - Poor 201–300: orange
   - Very Poor 301–400: red
   - Severe 401+: maroon
2. **Stubble fires:** small pulsing red/orange dots at fire locations in Punjab and Haryana (north, west and south-west of the city) that change with the selected day. More fires appear in the days around Diwali.
3. **Wind:** an arrow overlay showing wind direction and speed for the selected time.
4. **Legend:** AQI colors, fire dots, and a wind indicator.
5. **Layer toggles:** checkboxes to show or hide fires and wind.

## Mock data shape (per time step)
```json
{
  "time": "2025-10-20T22:00:00+05:30",
  "day_offset": 0,
  "sectors": [
    { "id": "S17", "name": "Sector 17", "lat": 30.74, "lon": 76.78, "aqi": 342, "pm25": 210.5, "category": "Very Poor",
      "sources": { "crackers": 0.42, "stubble": 0.33, "traffic": 0.15, "weather": 0.10 } }
  ],
  "fires": [ { "lat": 30.41, "lon": 76.12, "frp": 12.4 } ],
  "wind": { "speed_kmh": 4.2, "direction_deg": 300 }
}
```
Generate realistic mock values:
- AQI around 120–180 at Day −5, rising to 300+ the day before Diwali
- A spike of 400+ between 10 PM and 2 AM on Diwali night
- Slow recovery after Diwali
- Stubble share higher on non-Diwali days; crackers share highest on Diwali night

## Code quality
Clean component structure: `MapView`, `TimeSlider`, `SectorPanel`, `Legend`, `TopBar`. Make it responsive. No login. Add a short README.
