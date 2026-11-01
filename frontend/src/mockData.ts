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
const FIRE_HUB = { lat: 30.69, lng: 76.66 }
const WIND: Record<Mode, Wind> = {
  past: { direction_deg: 135, speed_kmh: 9 },
  forecast: { direction_deg: 125, speed_kmh: 6 },
}

// Typical AQI at noon for Diwali day -5 through +5, before the Diwali night spike.
const DAY_BASELINE = [140, 150, 165, 185, 210, 250, 260, 215, 180, 160, 150]
const PEAK_HOUR = 24
const SPIKE_WIDTH_HOURS = 2.5

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MS_PER_DAY = 86_400_000

const SECTORS: SectorSpec[] = [
  { number: 1, id: 'S1', name: 'Sector 1 (Capitol)', lat: 30.76116, lng: 76.80215 },
  { number: 2, id: 'S2', name: 'Sector 2', lat: 30.76379, lng: 76.79137 },
  { number: 3, id: 'S3', name: 'Sector 3', lat: 30.75829, lng: 76.79616 },
  { number: 4, id: 'S4', name: 'Sector 4', lat: 30.75186, lng: 76.80141 },
  { number: 5, id: 'S5', name: 'Sector 5', lat: 30.74556, lng: 76.80678 },
  { number: 6, id: 'S6', name: 'Sector 6', lat: 30.73903, lng: 76.81245 },
  { number: 7, id: 'S7', name: 'Sector 7', lat: 30.73587, lng: 76.80428 },
  { number: 8, id: 'S8', name: 'Sector 8', lat: 30.7417, lng: 76.79945 },
  { number: 9, id: 'S9', name: 'Sector 9', lat: 30.7474, lng: 76.79393 },
  { number: 10, id: 'S10', name: 'Sector 10', lat: 30.75419, lng: 76.78896 },
  { number: 11, id: 'S11', name: 'Sector 11', lat: 30.75987, lng: 76.7845 },
  { number: 12, id: 'S12', name: 'Sector 12', lat: 30.7644, lng: 76.77885 },
  { number: 14, id: 'S14', name: 'Sector 14', lat: 30.75985, lng: 76.76683 },
  { number: 15, id: 'S15', name: 'Sector 15', lat: 30.75299, lng: 76.77265 },
  { number: 16, id: 'S16', name: 'Sector 16', lat: 30.74676, lng: 76.77752 },
  { number: 17, id: 'S17', name: 'Sector 17', lat: 30.74007, lng: 76.78259 },
  { number: 18, id: 'S18', name: 'Sector 18', lat: 30.7345, lng: 76.78825 },
  { number: 19, id: 'S19', name: 'Sector 19', lat: 30.7283, lng: 76.79306 },
  { number: 20, id: 'S20', name: 'Sector 20', lat: 30.72118, lng: 76.78158 },
  { number: 21, id: 'S21', name: 'Sector 21', lat: 30.7269, lng: 76.77654 },
  { number: 22, id: 'S22', name: 'Sector 22', lat: 30.73343, lng: 76.77135 },
  { number: 23, id: 'S23', name: 'Sector 23', lat: 30.73992, lng: 76.7662 },
  { number: 24, id: 'S24', name: 'Sector 24', lat: 30.74578, lng: 76.76173 },
  { number: 25, id: 'S25', name: 'Sector 25', lat: 30.75165, lng: 76.75673 },
  { number: 26, id: 'S26', name: 'Sector 26', lat: 30.73001, lng: 76.80911 },
  { number: 27, id: 'S27', name: 'Sector 27', lat: 30.72275, lng: 76.79842 },
  { number: 28, id: 'S28', name: 'Sector 28', lat: 30.71719, lng: 76.80372 },
  { number: 29, id: 'S29', name: 'Sector 29', lat: 30.71026, lng: 76.79242 },
  { number: 30, id: 'S30', name: 'Sector 30', lat: 30.71568, lng: 76.78697 },
  { number: 31, id: 'S31', name: 'Sector 31', lat: 30.70288, lng: 76.78109 },
  { number: 32, id: 'S32', name: 'Sector 32', lat: 30.70839, lng: 76.77529 },
  { number: 33, id: 'S33', name: 'Sector 33', lat: 30.71413, lng: 76.77014 },
  { number: 34, id: 'S34', name: 'Sector 34', lat: 30.71992, lng: 76.76521 },
  { number: 35, id: 'S35', name: 'Sector 35', lat: 30.72612, lng: 76.75989 },
  { number: 36, id: 'S36', name: 'Sector 36', lat: 30.73247, lng: 76.75491 },
  { number: 37, id: 'S37', name: 'Sector 37', lat: 30.73853, lng: 76.75034 },
  { number: 38, id: 'S38', name: 'Sector 38', lat: 30.74468, lng: 76.74577 },
  { number: 39, id: 'S39', name: 'Sector 39', lat: 30.74374, lng: 76.73028 },
  { number: 40, id: 'S40', name: 'Sector 40', lat: 30.73798, lng: 76.7354 },
  { number: 41, id: 'S41', name: 'Sector 41', lat: 30.73254, lng: 76.7378 },
  { number: 42, id: 'S42', name: 'Sector 42', lat: 30.72608, lng: 76.74315 },
  { number: 43, id: 'S43', name: 'Sector 43', lat: 30.71909, lng: 76.74879 },
  { number: 44, id: 'S44', name: 'Sector 44', lat: 30.7129, lng: 76.75411 },
  { number: 45, id: 'S45', name: 'Sector 45', lat: 30.70659, lng: 76.75693 },
  { number: 46, id: 'S46', name: 'Sector 46', lat: 30.7014, lng: 76.76423 },
  { number: 47, id: 'S47', name: 'Sector 47', lat: 30.69581, lng: 76.76905 },
  { number: 48, id: 'S48', name: 'Sector 48', lat: 30.68794, lng: 76.75732 },
  { number: 49, id: 'S49', name: 'Sector 49', lat: 30.69403, lng: 76.75214 },
  { number: 50, id: 'S50', name: 'Sector 50', lat: 30.7, lng: 76.74775 },
  { number: 51, id: 'S51', name: 'Sector 51', lat: 30.70562, lng: 76.74276 },
  { number: 52, id: 'S52', name: 'Sector 52', lat: 30.71217, lng: 76.73725 },
  { number: 53, id: 'S53', name: 'Sector 53', lat: 30.71924, lng: 76.73215 },
  { number: 54, id: 'S54', name: 'Sector 54', lat: 30.72608, lng: 76.72921 },
  { number: 55, id: 'S55', name: 'Sector 55', lat: 30.73008, lng: 76.72283 },
  { number: 56, id: 'S56', name: 'Sector 56', lat: 30.73665, lng: 76.7189 },
  { number: 61, id: 'S61', name: 'Sector 61', lat: 30.70889, lng: 76.73076 },
  { number: 63, id: 'S63', name: 'Sector 63', lat: 30.69297, lng: 76.73648 },
  { number: 0, id: 'MMJ', name: 'Manimajra', lat: 30.71275, lng: 76.83294 },
  { number: 0, id: 'IA1', name: 'Industrial Area Ph-1', lat: 30.7054, lng: 76.80096 },
  { number: 0, id: 'IA2', name: 'Industrial Area Ph-2', lat: 30.69813, lng: 76.78801 },
]

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
    frp: 10 + hash01(salt + i * 2 + 3) * 50,
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
