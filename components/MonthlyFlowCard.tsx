'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  computeMonthlyFlow,
  type FlowPerson,
  type FlowEncounter,
  type FlowStatusChange,
  type InflowBucket,
  type OutflowBucket,
  type FlowPersonEntry,
} from '@/lib/monthlyFlow'

interface MonthlyFlowCardProps {
  allPersons: FlowPerson[]
  allEncounters: FlowEncounter[]
  statusChanges: FlowStatusChange[]
}

const INFLOW_LABELS: Record<InflowBucket, string> = {
  newlyExperiencing: 'Newly Experiencing Homelessness/New to the Area',
  returnedToHomelessness: 'Returned to Homelessness',
  returnedToActive: 'Returned to Active',
}

const OUTFLOW_LABELS: Record<OutflowBucket, string> = {
  permanentHousing: 'Permanent Housing',
  otherDestinations: 'Other/Shelter Destinations',
  unknownInactive: 'Unknown or Inactive',
}

function monthOptions(count: number): { value: string; label: string }[] {
  const opts = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts
}

export default function MonthlyFlowCard({ allPersons, allEncounters, statusChanges }: MonthlyFlowCardProps) {
  const options = useMemo(() => monthOptions(24), [])
  const [selected, setSelected] = useState(options[0].value)
  const [openBucket, setOpenBucket] = useState<InflowBucket | OutflowBucket | null>(null)

  const flow = useMemo(() => {
    const [y, m] = selected.split('-').map(Number)
    return computeMonthlyFlow(allPersons, allEncounters, statusChanges, y, m)
  }, [allPersons, allEncounters, statusChanges, selected])

  const toggle = (b: InflowBucket | OutflowBucket) => setOpenBucket((cur) => (cur === b ? null : b))

  const openList: FlowPersonEntry[] =
    openBucket && openBucket in flow.inflows
      ? flow.inflows[openBucket as InflowBucket]
      : openBucket
        ? flow.outflows[openBucket as OutflowBucket]
        : []
  const openLabel = openBucket
    ? (INFLOW_LABELS as Record<string, string>)[openBucket] || (OUTFLOW_LABELS as Record<string, string>)[openBucket]
    : ''

  const bucketRow = (
    bucketKey: InflowBucket | OutflowBucket,
    count: number,
    label: string,
    tone: 'gray' | 'dark'
  ) => (
    <button
      type="button"
      onClick={() => count > 0 && toggle(bucketKey)}
      disabled={count === 0}
      className={`w-full flex items-center gap-3 text-left px-1 py-1.5 rounded transition-colors ${
        count > 0 ? 'hover:bg-black/5 cursor-pointer' : 'cursor-default opacity-70'
      } ${openBucket === bucketKey ? 'ring-2 ring-blue-400' : ''}`}
    >
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-md font-bold text-white shrink-0 ${
          tone === 'gray' ? 'bg-gray-400' : 'bg-gray-700'
        }`}
      >
        {count}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  )

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold">By-Name List Monthly Flow</h3>
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            setOpenBucket(null)
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {flow.isPartialMonth && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-4 inline-block">
          {flow.monthLabel} is still in progress — figures are through today.
        </p>
      )}

      {/* Beginning + Inflows - Outflows = End equation */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-md bg-blue-700 text-white font-bold text-lg">
            {flow.beginningOfMonth}
          </span>
          <span className="font-serif text-lg text-gray-800">Beginning of Month</span>
        </div>
        <span className="text-xl text-gray-400 px-1">+</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-md bg-gray-400 text-white font-bold text-lg">
            {flow.totalInflows}
          </span>
          <span className="font-serif text-lg text-gray-800">Inflows</span>
        </div>
        <span className="text-xl text-gray-400 px-1">−</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-md bg-gray-700 text-white font-bold text-lg">
            {flow.totalOutflows}
          </span>
          <span className="font-serif text-lg text-gray-800">Outflows</span>
        </div>
        <span className="text-xl text-gray-400 px-1">=</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center min-w-[3rem] h-12 px-2 rounded-md bg-blue-700 text-white font-bold text-lg">
            {flow.endOfMonth}
          </span>
          <span className="font-serif text-lg text-gray-800">End of Month</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="space-y-1">
            {bucketRow('newlyExperiencing', flow.inflows.newlyExperiencing.length, INFLOW_LABELS.newlyExperiencing, 'gray')}
            {bucketRow('returnedToHomelessness', flow.inflows.returnedToHomelessness.length, INFLOW_LABELS.returnedToHomelessness, 'gray')}
            {bucketRow('returnedToActive', flow.inflows.returnedToActive.length, INFLOW_LABELS.returnedToActive, 'gray')}
          </div>
          <div className="mt-3 text-center border border-gray-300 rounded py-1.5 text-sm font-medium text-gray-700">
            Total Inflows — {flow.totalInflows}
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="space-y-1">
            {bucketRow('permanentHousing', flow.outflows.permanentHousing.length, OUTFLOW_LABELS.permanentHousing, 'dark')}
            {bucketRow('otherDestinations', flow.outflows.otherDestinations.length, OUTFLOW_LABELS.otherDestinations, 'dark')}
            {bucketRow('unknownInactive', flow.outflows.unknownInactive.length, OUTFLOW_LABELS.unknownInactive, 'dark')}
          </div>
          <div className="mt-3 text-center border border-gray-300 rounded py-1.5 text-sm font-medium text-gray-700">
            Total Outflows — {flow.totalOutflows}
          </div>
        </div>
      </div>

      {openBucket && (
        <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            {openLabel} — {openList.length}
          </p>
          <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {[...openList]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((p) => (
                <li key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                  <Link href={`/client/${p.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{p.date}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        &quot;Unknown or Inactive&quot; and &quot;Returned to Active&quot; are calculated from each
        client&apos;s actual contact history (90+ days without a visit) rather than read off a status
        field, so past months stay accurate regardless of when a status was last updated.
      </p>
    </div>
  )
}
