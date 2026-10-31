import { AQI_CATEGORIES } from '../aqi'

export function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-[500] w-44 rounded-xl border border-zinc-700/70 bg-zinc-900/90 p-3 text-zinc-200 shadow-lg backdrop-blur sm:w-56">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">AQI scale</p>
      <ul className="space-y-1.5">
        {AQI_CATEGORIES.map((category) => (
          <li key={category.label} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
            <span className="flex-1">{category.label}</span>
            <span className="tabular-nums text-zinc-400">{category.range}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1.5 border-t border-zinc-700/70 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>Stubble fire</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 36 36" className="shrink-0" style={{ transform: 'rotate(135deg)' }}>
            <path d="M18 3 L28 20 L18 16 L8 20 Z" fill="#4ade80" />
          </svg>
          <span>Wind direction</span>
        </div>
      </div>
    </div>
  )
}
