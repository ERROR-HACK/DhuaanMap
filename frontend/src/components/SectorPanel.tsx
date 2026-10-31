import { Cell, CartesianGrid, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getAqiCategory } from '../aqi'
import type { HistoryPoint, SectorReading } from '../types'

interface SectorPanelProps {
  sector: SectorReading
  history: HistoryPoint[] | null
  timeLabel: string
  onClose: () => void
}

const SOURCE_COLORS = {
  crackers: '#f97316',
  stubble: '#eab308',
  traffic: '#60a5fa',
  weather: '#2dd4bf',
}

const AXIS_TICK = { fill: '#a1a1aa', fontSize: 10 }

export function SectorPanel({ sector, history, timeLabel, onClose }: SectorPanelProps) {
  const category = getAqiCategory(sector.aqi)
  const sourceData = [
    { name: 'Crackers', value: sector.sources.crackers, color: SOURCE_COLORS.crackers },
    { name: 'Stubble', value: sector.sources.stubble, color: SOURCE_COLORS.stubble },
    { name: 'Traffic', value: sector.sources.traffic, color: SOURCE_COLORS.traffic },
    { name: 'Weather', value: sector.sources.weather, color: SOURCE_COLORS.weather },
  ]

  return (
    <aside className="animate-slide-in absolute inset-x-0 bottom-0 z-[1000] max-h-[65%] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:border-l sm:border-t-0">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">{timeLabel}</p>
          <h2 className="text-xl font-semibold text-zinc-50">{sector.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sector details"
          className="rounded-full px-2.5 py-1 text-xl leading-none text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          ×
        </button>
      </header>

      <div className="mt-5 flex items-center gap-4">
        <span className="text-5xl font-bold tabular-nums text-zinc-50">{sector.aqi}</span>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">AQI</span>
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: category.color, color: category.textColor }}
          >
            {category.label}
          </span>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-200">Sources of pollution</h3>
        <div className="mt-3 flex items-center gap-4">
          <PieChart width={150} height={150}>
            <Pie data={sourceData} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="none">
              {sourceData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
          <ul className="flex-1 space-y-2 text-sm">
            {sourceData.map((entry) => (
              <li key={entry.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="flex-1 text-zinc-300">{entry.name}</span>
                <span className="tabular-nums font-semibold text-zinc-100">{entry.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-200">AQI over 11 days</h3>
        <p className="text-xs text-zinc-500">Daily peak, Diwali day -5 to +5</p>
        <div className="mt-3 h-52">
          {history ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
                <ReferenceLine
                  y={400}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Severe', fill: '#f87171', fontSize: 10, position: 'insideTopLeft' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5' }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Line type="monotone" dataKey="aqi" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: '#4ade80' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-zinc-500">Loading trend...</p>
          )}
        </div>
      </section>
    </aside>
  )
}
