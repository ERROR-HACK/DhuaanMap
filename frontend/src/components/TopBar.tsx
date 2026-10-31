import type { Mode } from '../types'

interface TopBarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
}

const MODE_OPTIONS: { mode: Mode; title: string; subtitle: string }[] = [
  { mode: 'past', title: 'Past', subtitle: 'Diwali 2025 · Oct 20' },
  { mode: 'forecast', title: 'Forecast', subtitle: 'Diwali 2026 · Nov 8' },
]

export function TopBar({ mode, onModeChange }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_12px_#4ade80]" />
        <div>
          <h1 className="text-lg font-bold leading-tight text-zinc-50">DhuaanMap</h1>
          <p className="text-xs text-zinc-400">Chandigarh air quality</p>
        </div>
      </div>

      <div role="group" aria-label="Map mode" className="flex rounded-full border border-zinc-700 bg-zinc-900 p-1">
        {MODE_OPTIONS.map((option) => {
          const active = option.mode === mode
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(option.mode)}
              className={`rounded-full px-4 py-1.5 text-left transition-colors duration-200 ${
                active ? 'bg-green-500 text-zinc-950' : 'text-zinc-300 hover:text-zinc-50'
              }`}
            >
              <span className="block text-sm font-semibold leading-tight">{option.title}</span>
              <span className="block text-[11px] leading-tight opacity-80">{option.subtitle}</span>
            </button>
          )
        })}
      </div>
    </header>
  )
}
