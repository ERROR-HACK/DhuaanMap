import { useEffect, useState } from 'react'
import { fetchMap, fetchSectorHistory, fetchTimeline } from './api'
import { Legend } from './components/Legend'
import { MapView } from './components/MapView'
import { SectorPanel } from './components/SectorPanel'
import { TimeSlider } from './components/TimeSlider'
import { TopBar } from './components/TopBar'
import type { HistoryPoint, MapSnapshot, Mode, TimeStep } from './types'

const PLAY_INTERVAL_MS = 900
const LOAD_ERROR = 'Could not load air quality data. Please try again.'

export default function App() {
  const [mode, setMode] = useState<Mode>('past')
  const [timeline, setTimeline] = useState<{ mode: Mode; steps: TimeStep[] } | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [snapshot, setSnapshot] = useState<MapSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const steps = timeline?.mode === mode ? timeline.steps : []
  const currentStep = steps[index] as TimeStep | undefined
  const currentT = currentStep?.t

  useEffect(() => {
    let active = true
    fetchTimeline(mode)
      .then((loaded) => {
        if (!active) return
        setTimeline({ mode, steps: loaded })
        setIndex(Math.max(0, loaded.findIndex((step) => step.isPeak)))
      })
      .catch(() => {
        if (active) setError(LOAD_ERROR)
      })
    return () => {
      active = false
    }
  }, [mode])

  useEffect(() => {
    if (!currentT) return
    let active = true
    fetchMap(mode, currentT)
      .then((data) => {
        if (!active) return
        setSnapshot(data)
        console.log("fires", data.fires.length)
        setError(null)
      })
      .catch(() => {
        if (active) setError(LOAD_ERROR)
      })
    return () => {
      active = false
    }
  }, [mode, currentT])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    setHistory(null)
    fetchSectorHistory(mode, selectedId)
      .then((data) => {
        if (active) setHistory(data)
      })
      .catch(() => {
        if (active) setError(LOAD_ERROR)
      })
    return () => {
      active = false
    }
  }, [mode, selectedId])

  useEffect(() => {
    if (!playing || steps.length === 0) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % steps.length), PLAY_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [playing, steps.length])

  const handleModeChange = (next: Mode) => {
    setMode(next)
    setPlaying(false)
    setSelectedId(null)
  }

  const selectedSector = snapshot?.sectors.find((sector) => sector.id === selectedId) ?? null

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <TopBar mode={mode} onModeChange={handleModeChange} />

      <main className="relative min-h-0 flex-1">
        <MapView snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} />
        <Legend />

        {(error || !snapshot) && (
          <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900/95 px-4 py-2 text-sm text-zinc-200 shadow-lg">
            {error ?? 'Loading air quality data...'}
          </div>
        )}

        {selectedSector && (
          <SectorPanel
            sector={selectedSector}
            history={history}
            timeLabel={currentStep?.label ?? ''}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>

      <TimeSlider
        steps={steps}
        index={index}
        playing={playing}
        onIndexChange={setIndex}
        onTogglePlay={() => setPlaying((value) => !value)}
      />
    </div>
  )
}
