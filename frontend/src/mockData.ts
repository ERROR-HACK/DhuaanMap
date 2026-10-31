import type { FireSpot, HistoryPoint, MapSnapshot, Mode, SourceShares, TimeStep, Wind } from './types'

interface SectorSpec {
  number: number
  id: string
  name: string
  lat: number
  lng: number
}

interface StepTime {
  date: string
  hour: number
  offset: number
  x: number
}

interface Reading {
  aqi: number
  sources: SourceShares
}

const DIWALI_DATE: Record<Mode, string> = { past: '2025-10-20', forecast: '2026-11-08' }
const CENTER = { lat: 30.7333, lng: 76.7794 }
const FIRE_HUB = { lat: 30.69, lng: 76.66 }
const WIND: Record<Mode, Wind> = {
  past: { degrees: 135, speedKmh: 9 },
  forecast: { degrees: 125, speedKmh: 6 },
}

const SECTOR_NUMBERS = [1, 4, 5, 7, 8, 9, 10, 11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 27, 35]
const GRID_COLUMNS = 5
const GRID_STEP_LAT = 0.03
const GRID_STEP_LNG = 0.04

// Typical AQI at noon for Diwali day -5 through +5, before the Diwali night spike.
const DAY_BASELINE = [140, 150, 165, 185, 210, 250, 260, 215, 180, 160, 150]
const PEAK_HOUR = 24
const SPIKE_WIDTH_HOURS = 2.5

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_PER_DAY = 86_400_000

const SECTORS: SectorSpec[] = SECTOR_NUMBERS.map((number, i) => ({
  number,
  id: `sector-${number}`,
  name: `Sector ${number}`,
  lat: CENTER.lat + (1.5 - Math.floor(i / GRID_COLUMNS)) * GRID_STEP_LAT,
  lng: CENTER.lng + ((i % GRID_COLUMNS) - 2) * GRID_STEP_LNG,
}))

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function seeded(sectorNumber: number, salt: number): number {
  return hash01(sectorNumber * 31 + salt)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

function parseStep(mode: Mode, t: string): StepTime {
  const [date, time] = t.split('T')
  const hour = Number(time.slice(0, 2))
  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DIWALI_DATE[mode]}T00:00:00Z`)) / MS_PER_DAY,
  )
  return { date, hour, offset, x: offset * 24 + hour }
}

function formatDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`
}

function formatHour(hour: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12} ${hour < 12 ? 'AM' : 'PM'}`
}

function formatStepLabel(t: string): string {
  const [date, time] = t.split('T')
  return `${formatDate(date)} · ${formatHour(Number(time.slice(0, 2)))}`
}

function toShares(weights: SourceShares): SourceShares {
  const keys = Object.keys(weights) as (keyof SourceShares)[]
  const total = keys.reduce((sum, key) => sum + weights[key], 0)
  const shares: SourceShares = {
    crackers: Math.round((weights.crackers / total) * 100),
    stubble: Math.round((weights.stubble / total) * 100),
    traffic: Math.round((weights.traffic / total) * 100),
    weather: Math.round((weights.weather / total) * 100),
  }
  const largest = keys.reduce((a, b) => (shares[b] > shares[a] ? b : a))
  shares[largest] += 100 - keys.reduce((sum, key) => sum + shares[key], 0)
  return shares
}

function readingAt(spec: SectorSpec, mode: Mode, { offset, x }: StepTime): Reading {
  const n = spec.number
  const modeSalt = mode === 'past' ? 0 : 500
  const spike = Math.exp(-((x - PEAK_HOUR) ** 2) / (2 * SPIKE_WIDTH_HOURS ** 2))
  const baseline = DAY_BASELINE[offset + 5] * (0.88 + 0.26 * seeded(n, 1))
  const peak = 410 + 110 * seeded(n, 2)
  const noise = (hash01(n * 1000 + x * 13 + modeSalt) - 0.5) * 16
  const aqi = clamp(Math.round(baseline + (peak - baseline) * spike + noise), 20, 600)

  const fireDistance = Math.hypot(spec.lat - FIRE_HUB.lat, (spec.lng - FIRE_HUB.lng) * 0.92)
  const fireProximity = clamp(1 - fireDistance / 0.14, 0, 1)
  const sources = toShares({
    crackers: 3 + 65 * spike * (0.7 + 0.6 * seeded(n, 3)),
    stubble: 4 + 36 * fireProximity * (0.8 + 0.4 * seeded(n, 4)),
    traffic: 14 + 8 * seeded(n, 5),
    weather: 9 + 9 * seeded(n, 6),
  })

  return { aqi, sources }
}

function buildFires(mode: Mode): FireSpot[] {
  const count = mode === 'past' ? 18 : 12
  const salt = mode === 'past' ? 0 : 700
  return range(0, count - 1).map((i) => ({
    lat: 30.62 + hash01(salt + i * 2 + 1) * 0.12,
    lng: 76.56 + hash01(salt + i * 2 + 2) * 0.14,
  }))
}

export function buildTimeline(mode: Mode): TimeStep[] {
  const diwali = DIWALI_DATE[mode]
  const nextDay = addDays(diwali, 1)
  const times = [
    ...range(-5, 0).map((d) => `${addDays(diwali, d)}T12:00`),
    ...range(18, 23).map((h) => `${diwali}T${String(h).padStart(2, '0')}:00`),
    ...range(0, 6).map((h) => `${nextDay}T${String(h).padStart(2, '0')}:00`),
    ...range(1, 5).map((d) => `${addDays(diwali, d)}T12:00`),
  ]
  return times.map((t) => ({ t, label: formatStepLabel(t), isPeak: t === `${nextDay}T00:00` }))
}

export function buildSnapshot(mode: Mode, t: string): MapSnapshot {
  const step = parseStep(mode, t)
  return {
    mode,
    t,
    sectors: SECTORS.map((spec) => ({
      id: spec.id,
      name: spec.name,
      lat: spec.lat,
      lng: spec.lng,
      ...readingAt(spec, mode, step),
    })),
    fires: buildFires(mode),
    wind: WIND[mode],
  }
}

export function buildSectorHistory(mode: Mode, sectorId: string): HistoryPoint[] {
  const spec = SECTORS.find((sector) => sector.id === sectorId)
  if (!spec) return []

  const dailyPeak = new Map<string, number>()
  for (const step of buildTimeline(mode)) {
    const time = parseStep(mode, step.t)
    // Readings after midnight belong to the evening they started on.
    const day = time.hour < 12 ? addDays(time.date, -1) : time.date
    const { aqi } = readingAt(spec, mode, time)
    dailyPeak.set(day, Math.max(dailyPeak.get(day) ?? 0, aqi))
  }

  return [...dailyPeak].map(([date, aqi]) => ({ label: formatDate(date), aqi }))
}
