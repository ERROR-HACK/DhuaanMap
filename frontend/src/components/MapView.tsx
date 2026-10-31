import { useMemo } from 'react'
import { divIcon } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getAqiCategory } from '../aqi'
import type { MapSnapshot, Wind } from '../types'

const CENTER: [number, number] = [30.7333, 76.7794]
const WIND_MARKER_POSITION: [number, number] = [30.795, 76.69]
const SECTOR_RADIUS_METERS = 1500
const FIRE_COLOR = '#ff3b3b'
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function windMarkerHtml({ degrees, speedKmh }: Wind): string {
  return `<div class="flex flex-col items-center gap-1">
    <svg width="36" height="36" viewBox="0 0 36 36" style="transform: rotate(${degrees}deg)">
      <path d="M18 3 L28 20 L18 16 L8 20 Z" fill="#4ade80" stroke="#052e16" stroke-width="1" />
    </svg>
    <span class="rounded bg-zinc-900/90 px-1.5 py-0.5 text-[11px] font-semibold text-green-300">${speedKmh} km/h</span>
  </div>`
}

interface MapViewProps {
  snapshot: MapSnapshot | null
  selectedId: string | null
  onSelect: (id: string) => void
}

export function MapView({ snapshot, selectedId, onSelect }: MapViewProps) {
  const windIcon = useMemo(
    () =>
      snapshot
        ? divIcon({
            className: 'wind-marker',
            html: windMarkerHtml(snapshot.wind),
            iconSize: [80, 64],
            iconAnchor: [40, 32],
          })
        : null,
    [snapshot],
  )

  return (
    <MapContainer center={CENTER} zoom={12} scrollWheelZoom className="isolate h-full w-full bg-zinc-950">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      {snapshot?.sectors.map((sector) => {
        const category = getAqiCategory(sector.aqi)
        const selected = sector.id === selectedId
        return (
          <Circle
            key={sector.id}
            center={[sector.lat, sector.lng]}
            radius={SECTOR_RADIUS_METERS}
            pathOptions={{
              color: category.color,
              fillColor: category.color,
              fillOpacity: selected ? 0.8 : 0.55,
              weight: selected ? 3 : 1,
            }}
            eventHandlers={{ click: () => onSelect(sector.id) }}
          >
            <Tooltip sticky>{`${sector.name} · AQI ${sector.aqi}`}</Tooltip>
          </Circle>
        )
      })}

      {snapshot?.fires.map((fire) => (
        <CircleMarker
          key={`${fire.lat}-${fire.lng}`}
          center={[fire.lat, fire.lng]}
          radius={5}
          pathOptions={{ color: FIRE_COLOR, fillColor: FIRE_COLOR, fillOpacity: 0.95, weight: 1 }}
          interactive={false}
        />
      ))}

      {windIcon && <Marker position={WIND_MARKER_POSITION} icon={windIcon} interactive={false} />}
    </MapContainer>
  )
}
