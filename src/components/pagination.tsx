'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const btn = 'text-xs font-medium px-3 py-1.5 rounded-md border transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
  const btnStyle = {
    color: 'var(--color-text-secondary)',
    borderColor: 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)',
    background: 'transparent',
  }

  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={btn}
        style={btnStyle}
      >
        Previous
      </button>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={btn}
        style={btnStyle}
      >
        Next
      </button>
    </div>
  )
}
