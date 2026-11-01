import { useMemo, useRef, useEffect, useState } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getAqiCategory } from '../aqi'
import type { MapSnapshot } from '../types'

const CENTER: [number, number] = [30.7333, 76.7794]
const FIRE_COLOR = '#ff5a1f'
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY as string | undefined
const TILE_URL = CARTO_KEY
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

function aqiLabelHtml(aqi: number): string {
  return `<div class="aqi-label" style="color: white; font-weight: bold; font-size: 14px; text-shadow: 0 0 3px rgba(0,0,0,0.8); pointer-events: none;">${aqi}</div>`
}

interface MapViewProps {
  snapshot: MapSnapshot | null
  selectedId: string | null
  onSelect: (id: string) => void
}

export function MapView({ snapshot, selectedId, onSelect }: MapViewProps) {
  const geoJsonRef = useRef<any>(null)
  const [geoJsonData, setGeoJsonData] = useState<any>(null)
  
  const snapshotRef = useRef(snapshot)
  const selectedIdRef = useRef(selectedId)
  const onSelectRef = useRef(onSelect)
  
  useEffect(() => {
    snapshotRef.current = snapshot
    selectedIdRef.current = selectedId
    onSelectRef.current = onSelect
  })

  useEffect(() => {
    fetch('/sectors.geojson')
      .then((res) => res.json())
      .then(setGeoJsonData)
  }, [])

  useEffect(() => {
    if (!geoJsonRef.current || !snapshot) return

    geoJsonRef.current.eachLayer((layer: any) => {
      const feature = layer.feature
      const sectorId = feature.properties?.id
      const sector = snapshot.sectors.find((s) => s.id === sectorId)
      if (!sector) return

      const category = getAqiCategory(sector.aqi)
      const selected = sectorId === selectedId

      layer.setStyle({
        color: 'white',
        fillColor: category.color,
        fillOpacity: selected ? 0.8 : 0.55,
        weight: 1,
        opacity: 0.4,
      })
    })
  }, [snapshot, selectedId])


  const onEachFeature = (feature: any, layer: any) => {
    const sectorId = feature.properties?.id
    
    layer.on({
      click: () => {
        const handler = onSelectRef.current
        if (handler) handler(sectorId)
      },
      mouseover: (e: any) => {
        const snap = snapshotRef.current
        if (!snap) return
        const sector = snap.sectors.find((s: any) => s.id === sectorId)
        if (!sector) return
        
        const category = getAqiCategory(sector.aqi)
        e.target.setStyle({ fillOpacity: 0.7 })
        
        layer.bindTooltip(`${sector.name} · AQI ${sector.aqi} · ${category.label}`, { sticky: true })
        layer.openTooltip()
      },
      mouseout: (e: any) => {
        const selId = selectedIdRef.current
        const selected = sectorId === selId
        e.target.setStyle({ fillOpacity: selected ? 0.8 : 0.55 })
        layer.closeTooltip()
      },
    })
  }

  const polygonCenters = useMemo(() => {
    if (!geoJsonData) return {}
    const centers: Record<string, [number, number]> = {}
    geoJsonData.features.forEach((feature: any) => {
      if (feature.geometry?.type !== 'Polygon') return
      const coords = feature.geometry.coordinates[0]
      const lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length
      const lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length
      centers[feature.properties.id] = [lat, lng]
    })
    return centers
  }, [geoJsonData])

  return (
    <MapContainer center={CENTER} zoom={12} scrollWheelZoom className="isolate h-full w-full bg-zinc-950">
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        subdomains="abcd"
        maxZoom={20}
      />

      {geoJsonData && (
        <GeoJSON
          data={geoJsonData}
          ref={geoJsonRef}
          onEachFeature={onEachFeature}
          style={{
            color: 'white',
            weight: 1,
            opacity: 0.4,
          }}
          interactive={true}
          pane="overlayPane"
        />
      )}

      {snapshot?.sectors.map((sector) => {
        const center = polygonCenters[sector.id]
        if (!center) return null
        const labelIcon = divIcon({
          className: 'aqi-label',
          html: aqiLabelHtml(sector.aqi),
          iconSize: [40, 20],
          iconAnchor: [20, 10],
        })
        return (
          <Marker
            key={`label-${sector.id}`}
            position={center}
            icon={labelIcon}
            interactive={false}
            pane="overlayPane"
          />
        )
      })}

      {snapshot?.fires.map((fire) => (
        <CircleMarker
          key={`${fire.lat}-${fire.lng}`}
          center={[fire.lat, fire.lng]}
          radius={5}
          pathOptions={{ color: FIRE_COLOR, fillColor: FIRE_COLOR, fillOpacity: 0.9, weight: 1 }}
          interactive={false}
          pane="tooltipPane"
        />
      ))}

      {snapshot && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-center gap-1 rounded-full bg-zinc-900/90 p-2 shadow-lg">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Wind</div>
          <div className="relative h-[60px] w-[60px] rounded-full border-2 border-zinc-600">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 60 60"
              style={{ transform: `rotate(${snapshot.wind.direction_deg + 180}deg)` }}
            >
              <path d="M30 8 L40 28 L30 24 L20 28 Z" fill="#f97316" stroke="#7c2d12" strokeWidth="1" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-zinc-300">N</span>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-orange-300">{snapshot.wind.speed_kmh} km/h</div>
        </div>
      )}
    </MapContainer>
  )
}
