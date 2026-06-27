'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { FindCardDialog } from '@/components/find-card-dialog'
import { Pagination } from '@/components/pagination'
import { updateFindStatus } from '@/app/actions/admin'
import type { Find, Clover, FindStatus } from '@/types'

const PAGE_SIZE = 20

type AdminFind = Find & { clovers: Clover[]; users: { username: string } | null }

interface Props {
  finds: AdminFind[]
  adminUserId: string
  initialSearch?: string
}

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'all', label: 'All' },
] as const

type FilterValue = typeof STATUS_FILTERS[number]['value']

const STATUS_STYLES: Record<FindStatus, { color: string; bg: string }> = {
  pending:  { color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  approved: { color: 'var(--color-accent)', bg: 'var(--color-accent-light)' },
  rejected: { color: 'var(--color-error)', bg: 'rgba(185,28,28,0.12)' },
  disputed: { color: '#ea580c', bg: 'rgba(234,88,12,0.12)' },
}

const APPROVAL_ACTIONS: { status: FindStatus; label: string }[] = [
  { status: 'approved', label: 'Approve' },
  { status: 'rejected', label: 'Reject' },
  { status: 'disputed', label: 'Mark disputed' },
  { status: 'pending',  label: 'Reset to pending' },
]

function LeafSummary({ clovers }: { clovers: Clover[] }) {
  const counts = clovers.map((c) => c.leaf_count).sort((a, b) => b - a)
  if (counts.length === 0) return <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span>
  return (
    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {counts.join(', ')}-leaf
    </span>
  )
}

function StatusBadge({ status }: { status: FindStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  )
}

type SortField = 'found_at' | 'created_at'
type SortDir = 'desc' | 'asc'

export function AdminPanel({ finds: initialFinds, adminUserId, initialSearch = '' }: Props) {
  const [finds, setFinds] = useState<AdminFind[]>(initialFinds)
  // When arriving with a username search (e.g. from the users view), show all
  // statuses so approved finds aren't hidden by the default "pending" filter.
  const [filter, setFilter] = useState<FilterValue>(initialSearch ? 'all' : 'pending')
  const [search, setSearch] = useState(initialSearch)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedFind, setSelectedFind] = useState<AdminFind | null>(null)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Reset to the first page whenever the visible set changes.
  useEffect(() => {
    setPage(1)
  }, [filter, search, sortField, sortDir])

  const filtered = (filter === 'all' ? finds : finds.filter((f) => f.status === filter))
    .filter((f) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      const creator = f.user_id ? (f.users?.username ?? '') : 'anonymous'
      return creator.toLowerCase().includes(q)
    })
    .slice()
    .sort((a, b) => {
      const av = new Date(a[sortField]).getTime()
      const bv = new Date(b[sortField]).getTime()
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function handleStatusChange(findId: string, status: FindStatus) {
    setActionError(null)
    startTransition(async () => {
      const result = await updateFindStatus(findId, status)
      if ('error' in result) {
        setActionError(result.error)
        return
      }
      setFinds((prev) =>
        prev.map((f) => {
          if (f.id !== findId) return f
          // If approving a non-anonymous find, also mark creator trusted in local state
          const updatedFind = { ...f, status }
          return updatedFind
        }),
      )
      setSelectedFind((prev) => (prev?.id === findId ? { ...prev, status } : prev))
    })
  }

  const adminControls = selectedFind ? (
    <div className="flex flex-col gap-2 pt-1 mt-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Status: <StatusBadge status={selectedFind.status} />
        </p>
        <Link
          href={`/admin/finds/${selectedFind.id}/edit`}
          className="text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-accent)' }}
        >
          Edit find →
        </Link>
      </div>
      {actionError && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>{actionError}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {APPROVAL_ACTIONS.filter((a) => a.status !== selectedFind.status).map((action) => (
          <button
            key={action.status}
            disabled={isPending}
            onClick={() => handleStatusChange(selectedFind.id, action.status)}
            className="text-xs font-medium px-3 py-1.5 rounded-md border transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              color: STATUS_STYLES[action.status].color,
              borderColor: STATUS_STYLES[action.status].color,
              background: STATUS_STYLES[action.status].bg,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  ) : null

  const sortLabel = (field: SortField) => {
    const labels: Record<SortField, string> = { found_at: 'Date found', created_at: 'Date added' }
    if (sortField !== field) return labels[field]
    return `${labels[field]} ${sortDir === 'desc' ? '↓' : '↑'}`
  }

  return (
    <>
      {/* Search + sort toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search by username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded-md px-3 py-1.5 text-sm"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <div className="flex gap-1">
          {(['found_at', 'created_at'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: sortField === field ? 'var(--color-accent-light)' : 'transparent',
                color: sortField === field ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: `1px solid ${sortField === field ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text-primary) 15%, transparent)'}`,
              }}
            >
              {sortLabel(field)}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => {
          const count = value === 'all' ? finds.length : finds.filter((f) => f.status === value).length
          const active = filter === value
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--color-accent-light)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: `1px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
              }}
            >
              {label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text-primary) 12%, transparent)',
                  color: active ? 'var(--color-background)' : 'var(--color-text-secondary)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Find list */}
      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No {filter === 'all' ? '' : filter + ' '}finds.
        </p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent)' }}
        >
          {paged.map((find, i) => {
            const creator = find.user_id ? (find.users?.username ?? 'unknown') : 'anonymous'
            const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
            return (
              <button
                key={find.id}
                onClick={() => setSelectedFind(find)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity"
                style={{
                  borderTop: i > 0 ? '1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent)' : undefined,
                  background: 'var(--color-surface)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={find.photo_url}
                  alt=""
                  className="rounded-md object-cover shrink-0"
                  style={{ width: 48, height: 48 }}
                />

                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {creator}
                    </span>
                    <StatusBadge status={find.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <LeafSummary clovers={find.clovers} />
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      found {fmt(find.found_at)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      added {fmt(find.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />

      {/* Dialog */}
      <FindCardDialog
        finds={paged}
        activeId={selectedFind?.id ?? null}
        userId={adminUserId}
        onClose={() => setSelectedFind(null)}
        onNavigate={(find) => setSelectedFind(find as AdminFind)}
        adminControls={adminControls}
      />
    </>
  )
}
