import type { TimeStep } from '../types'

interface TimeSliderProps {
  steps: TimeStep[]
  index: number
  playing: boolean
  onIndexChange: (index: number) => void
  onTogglePlay: () => void
}

export function TimeSlider({ steps, index, playing, onIndexChange, onTogglePlay }: TimeSliderProps) {
  const current = steps[index] as TimeStep | undefined

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center gap-4">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={steps.length === 0}
          aria-label={playing ? 'Pause timeline' : 'Play timeline'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-zinc-950 transition-colors duration-200 hover:bg-green-400 disabled:opacity-40"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between text-xs text-zinc-400">
            <span>Day -5</span>
            <span className="font-medium text-green-400">Diwali</span>
            <span>Day +5</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(steps.length - 1, 0)}
            value={index}
            onChange={(event) => onIndexChange(Number(event.target.value))}
            aria-label="Time"
            className="w-full accent-green-500"
          />
        </div>

        <span className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-100 sm:w-40">
          {current?.label ?? '...'}
        </span>
      </div>
    </footer>
  )
}
