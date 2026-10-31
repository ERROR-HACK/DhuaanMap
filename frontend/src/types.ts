export type Mode = 'past' | 'forecast'

export interface SourceShares {
  crackers: number
  stubble: number
  traffic: number
  weather: number
}

export interface SectorReading {
  id: string
  name: string
  lat: number
  lng: number
  aqi: number
  sources: SourceShares
}

export interface FireSpot {
  lat: number
  lng: number
}

export interface Wind {
  degrees: number
  speedKmh: number
}

export interface MapSnapshot {
  mode: Mode
  t: string
  sectors: SectorReading[]
  fires: FireSpot[]
  wind: Wind
}

export interface TimeStep {
  t: string
  label: string
  isPeak: boolean
}

export interface HistoryPoint {
  label: string
  aqi: number
}
