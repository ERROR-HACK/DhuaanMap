// All data access goes through here. Uses FastAPI when VITE_API_URL is set; falls back to mock data.
import { buildSectorHistory, buildSnapshot, buildTimeline } from './mockData'
import type { HistoryPoint, MapSnapshot, Mode, SourceShares, TimeStep } from './types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface ApiTimelineStep {
  time: string
  day_offset: number
  hours_from_diwali_eve: number
}

interface ApiTimelineResponse {
  diwali: string
  steps: ApiTimelineStep[]
}

interface ApiSources {
  crackers: number
  stubble: number
  traffic: number
  weather: number
}

interface ApiSector {
  id: string
  name: string
  lat: number
  lon: number
  aqi: number
  pm25?: number
  category?: string
  sources: ApiSources
}

interface ApiMapResponse {
  time: string
  day_offset: number
  hours_from_diwali_eve?: number
  sectors: ApiSector[]
  fires: { lat: number; lon: number; frp?: number }[]
  wind: { speed_kmh: number; direction_deg: number }
}

interface ApiSectorResponse {
  id: string
  diwali: string
  trend: { time: string; aqi: number; sources: ApiSources }[]
}

function formatDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`
}

function formatHour(hour: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12} ${hour < 12 ? 'AM' : 'PM'}`
}

function formatStepLabel(t: string): string {
  const date = t.slice(0, 10)
  const hour = Number(t.slice(11, 13))
  return `${formatDate(date)} · ${formatHour(hour)}`
}

function toPercentShares(sources: ApiSources): SourceShares {
  return {
    crackers: Math.round(sources.crackers * 100),
    stubble: Math.round(sources.stubble * 100),
    traffic: Math.round(sources.traffic * 100),
    weather: Math.round(sources.weather * 100),
  }
}

function mapTimeline(data: ApiTimelineResponse): TimeStep[] {
  // Peak ≈ midnight after Diwali eve (hours_from_diwali_eve ≈ 4)
  let peakIdx = 0
  let best = Infinity
  data.steps.forEach((step, i) => {
    const dist = Math.abs(step.hours_from_diwali_eve - 4)
    if (dist < best) {
      best = dist
      peakIdx = i
    }
  })
  return data.steps.map((step, i) => ({
    t: step.time,
    label: formatStepLabel(step.time),
    isPeak: i === peakIdx,
  }))
}

function mapSnapshot(mode: Mode, data: ApiMapResponse): MapSnapshot {
  return {
    mode,
    t: data.time,
    sectors: data.sectors.map((sector) => ({
      id: sector.id,
      name: sector.name,
      lat: sector.lat,
      lng: sector.lon,
      aqi: sector.aqi,
      sources: toPercentShares(sector.sources),
    })),
    fires: data.fires.map((fire) => ({ lat: fire.lat, lng: fire.lon })),
    wind: {
      degrees: data.wind.direction_deg,
      speedKmh: data.wind.speed_kmh,
    },
  }
}

function mapSectorHistory(data: ApiSectorResponse): HistoryPoint[] {
  // Aggregate hourly trend into daily peaks (matches mock chart + panel copy).
  const dailyPeak = new Map<string, number>()
  for (const point of data.trend) {
    const date = point.time.slice(0, 10)
    const hour = Number(point.time.slice(11, 13))
    // Readings after midnight belong to the evening they started on.
    let day = date
    if (hour < 12) {
      const d = new Date(`${date}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - 1)
      day = d.toISOString().slice(0, 10)
    }
    dailyPeak.set(day, Math.max(dailyPeak.get(day) ?? 0, point.aqi))
  }
  return [...dailyPeak].map(([date, aqi]) => ({ label: formatDate(date), aqi }))
}

async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL not set')
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchTimeline(mode: Mode): Promise<TimeStep[]> {
  try {
    const data = await apiGet<ApiTimelineResponse>(`/timeline?mode=${mode}`)
    return mapTimeline(data)
  } catch {
    return buildTimeline(mode)
  }
}

export async function fetchMap(mode: Mode, t: string): Promise<MapSnapshot> {
  try {
    const data = await apiGet<ApiMapResponse>(`/map?mode=${mode}&t=${encodeURIComponent(t)}`)
    return mapSnapshot(mode, data)
  } catch {
    return buildSnapshot(mode, t)
  }
}

export async function fetchSectorHistory(mode: Mode, sectorId: string): Promise<HistoryPoint[]> {
  try {
    const data = await apiGet<ApiSectorResponse>(`/sector/${encodeURIComponent(sectorId)}?mode=${mode}`)
    return mapSectorHistory(data)
  } catch {
    return buildSectorHistory(mode, sectorId)
  }
}
