'use client'

import { X, Plus } from 'lucide-react'

interface CloverFieldsProps {
  value: number[]
  onChange: (counts: number[]) => void
  activeIndex: number
  onActivate: (index: number) => void
  hasPhoto: boolean
}

export function CloverFields({
  value,
  onChange,
  activeIndex,
  onActivate,
  hasPhoto,
}: CloverFieldsProps) {
  function updateCount(index: number, newCount: number) {
    onChange(value.map((c, i) => (i === index ? newCount : c)))
  }

  function addClover() {
    onChange([...value, 4])
    onActivate(value.length)
  }

  function removeClover(index: number) {
    onChange(value.filter((_, i) => i !== index))
    onActivate(Math.max(0, index - 1))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((count, index) => {
        const isActive = index === activeIndex
        return (
          <div
            key={index}
            onClick={() => onActivate(index)}
            className={[
              'flex items-center gap-3 rounded-lg border px-3 py-2.5 w-full transition-colors duration-150 cursor-pointer',
              isActive
                ? 'border-accent bg-accent-light'
                : 'border-border bg-surface hover:border-accent/50',
            ].join(' ')}
          >
            {/* Clover number badge */}
            <span
              className={[
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0',
                isActive ? 'bg-accent text-white' : 'bg-border text-text-secondary',
              ].join(' ')}
            >
              {index + 1}
            </span>

            {/* Slider */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-primary font-medium">
                  {count}-leaf clover
                </span>
                {hasPhoto && isActive && (
                  <span className="text-xs text-text-secondary">
                    Click photo to mark position
                  </span>
                )}
              </div>
              <input
                type="range"
                min={4}
                max={10}
                value={count}
                onChange={(e) => updateCount(index, parseInt(e.target.value, 10))}
                onClick={(e) => e.stopPropagation()}
                className="w-full accent-accent h-1.5 cursor-pointer"
                aria-label={`Leaf count for clover ${index + 1}`}
              />
              <div className="flex justify-between text-xs text-text-secondary select-none">
                <span>4</span>
                <span>10</span>
              </div>
            </div>

            {/* Remove */}
            {value.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeClover(index)
                }}
                className="shrink-0 text-text-secondary hover:text-error transition-colors duration-150 p-1"
                aria-label={`Remove clover ${index + 1}`}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addClover}
        className="flex items-center gap-1.5 text-sm text-accent hover:bg-accent-light rounded-md px-2 py-1.5 transition-colors duration-150 self-start"
      >
        <Plus size={16} strokeWidth={1.5} />
        Add another clover
      </button>
    </div>
  )
}
