import { EXIT_DESTINATIONS } from '@/lib/schemas/exit-schema'
import { getPacificDateString } from '@/lib/dashboardStats'

// By-name-list monthly flow: Beginning of Month + Inflows - Outflows = End of Month.
//
// "Active" here means: on the unsheltered by-name list, i.e. no formal exit in effect
// on the as-of date AND contacted within the last 90 days (or enrolled within 90 days,
// if never contacted). This is recomputed fresh from encounter history for every date,
// rather than read off `persons.exit_date`, because the app's automatic 90-day
// inactivation was broken for a long time and only started working on 2026-09-17 -
// on that date it exited ~1,300 people in one batch. Reading exit_date directly would
// dump that whole backlog into a single month's "Unknown or Inactive" outflow instead
// of the months they actually went quiet in. Recomputing from real contact dates gives
// a consistent trend for every month, past or present, regardless of when that bug was
// fixed. Formal exits (housing, shelter, etc.) ARE read from the real record, since
// those are genuine point-in-time staff actions, not something to recompute.

const SHELTERED_SITUATIONS = [
  'Emergency shelter',
  'Transitional housing',
  'Safe Haven',
  'Hotel/motel paid by organization',
  'Staying with family/friends (permanent)',
]

function isUnsheltered(livingSituation: string | null | undefined): boolean {
  if (!livingSituation) return true
  return !SHELTERED_SITUATIONS.includes(livingSituation)
}

const PERMANENT_HOUSING_DESTINATIONS: readonly string[] = EXIT_DESTINATIONS['Permanent Housing']
const AUTO_INACTIVATE_DESTINATION = 'Auto-inactivated - No contact for 90 days'

export interface FlowPerson {
  id: string
  first_name: string
  last_name?: string | null
  client_id?: string
  enrollment_date: string
  living_situation?: string | null
}

export interface FlowEncounter {
  person_id: string
  service_date: string
}

export interface FlowStatusChange {
  person_id: string
  change_type: 'exit' | 'return_to_active'
  change_date: string
  exit_destination?: string | null
}

export interface FlowPersonEntry {
  id: string
  name: string
  client_id?: string
  date: string // the enrollment/exit/return date driving this bucket
}

export type InflowBucket = 'newlyExperiencing' | 'returnedToHomelessness' | 'returnedToActive'
export type OutflowBucket = 'permanentHousing' | 'otherDestinations' | 'unknownInactive'

export interface MonthlyFlowResult {
  monthLabel: string
  beginningOfMonth: number
  endOfMonth: number
  isPartialMonth: boolean // true when the selected month hasn't finished yet (uses "today" as the cutoff)
  inflows: Record<InflowBucket, FlowPersonEntry[]>
  outflows: Record<OutflowBucket, FlowPersonEntry[]>
  totalInflows: number
  totalOutflows: number
}

function personName(p: { first_name: string; last_name?: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ')
}

// A "manual" exit/return is a real staff action, not the system's own 90-day auto-exit.
function isManualExit(sc: FlowStatusChange): boolean {
  return sc.change_type === 'exit' && !!sc.exit_destination && sc.exit_destination !== AUTO_INACTIVATE_DESTINATION
}

export function computeMonthlyFlow(
  persons: FlowPerson[],
  encounters: FlowEncounter[],
  statusChanges: FlowStatusChange[],
  year: number,
  month: number // 1-12
): MonthlyFlowResult {
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`
  const todayStr = getPacificDateString(new Date().toISOString())
  const isPartialMonth = monthEnd > todayStr
  const effectiveMonthEnd = isPartialMonth ? todayStr : monthEnd
  // "Beginning of month" = state at the instant before the month started
  const prevDay = new Date(year, month - 1, 0)
  const beforeMonthStart = `${prevDay.getFullYear()}-${pad(prevDay.getMonth() + 1)}-${pad(prevDay.getDate())}`

  // Pre-index encounters and status changes per person, sorted by date, once.
  const encountersByPerson = new Map<string, string[]>()
  for (const e of encounters) {
    const d = getPacificDateString(e.service_date)
    const arr = encountersByPerson.get(e.person_id)
    if (arr) arr.push(d)
    else encountersByPerson.set(e.person_id, [d])
  }
  for (const arr of encountersByPerson.values()) arr.sort()

  const statusByPerson = new Map<string, FlowStatusChange[]>()
  for (const sc of statusChanges) {
    const arr = statusByPerson.get(sc.person_id)
    if (arr) arr.push(sc)
    else statusByPerson.set(sc.person_id, [sc])
  }
  for (const arr of statusByPerson.values()) arr.sort((a, b) => a.change_date.localeCompare(b.change_date))

  // Most recent contact date <= asOf (falls back to enrollment date, matching the
  // server's own auto_inactivate_clients() definition of "last activity").
  function lastContactAsOf(person: FlowPerson, asOf: string): string {
    const dates = encountersByPerson.get(person.id)
    let best = person.enrollment_date
    if (dates) {
      for (const d of dates) {
        if (d > asOf) break
        if (d > best) best = d
      }
    }
    return best
  }

  function daysBetween(a: string, b: string): number {
    return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
  }

  // Was this person under a staff-entered exit as of `asOf`? (independent of the 90-day rule)
  function manuallyExitedAsOf(person: FlowPerson, asOf: string): boolean {
    const events = statusByPerson.get(person.id)
    if (!events) return false
    let exited = false
    for (const sc of events) {
      if (sc.change_date > asOf) break
      if (isManualExit(sc)) exited = true
      else if (sc.change_type === 'return_to_active') exited = false
    }
    return exited
  }

  function isActiveAsOf(person: FlowPerson, asOf: string): boolean {
    if (person.enrollment_date > asOf) return false
    if (!isUnsheltered(person.living_situation)) return false
    if (manuallyExitedAsOf(person, asOf)) return false
    const lastContact = lastContactAsOf(person, asOf)
    return daysBetween(lastContact, asOf) < 90
  }

  // Most recent manual exit strictly before `before`, if any.
  function priorManualExit(personId: string, before: string): FlowStatusChange | null {
    const events = statusByPerson.get(personId)
    if (!events) return null
    let found: FlowStatusChange | null = null
    for (const sc of events) {
      if (sc.change_date >= before) break
      if (isManualExit(sc)) found = sc
    }
    return found
  }

  // Most recent manual exit within [monthStart, effectiveMonthEnd], if any.
  function manualExitInMonth(personId: string): FlowStatusChange | null {
    const events = statusByPerson.get(personId)
    if (!events) return null
    let found: FlowStatusChange | null = null
    for (const sc of events) {
      if (sc.change_date < monthStart || sc.change_date > effectiveMonthEnd) continue
      if (isManualExit(sc)) found = sc
    }
    return found
  }

  function hadReturnEventInMonth(personId: string): boolean {
    const events = statusByPerson.get(personId)
    if (!events) return false
    return events.some(
      (sc) => sc.change_type === 'return_to_active' && sc.change_date >= monthStart && sc.change_date <= effectiveMonthEnd
    )
  }

  const bomRoster = new Set<string>()
  const eomRoster = new Set<string>()
  for (const p of persons) {
    if (isActiveAsOf(p, beforeMonthStart)) bomRoster.add(p.id)
    if (isActiveAsOf(p, effectiveMonthEnd)) eomRoster.add(p.id)
  }

  const inflows: Record<InflowBucket, FlowPersonEntry[]> = {
    newlyExperiencing: [],
    returnedToHomelessness: [],
    returnedToActive: [],
  }
  const outflows: Record<OutflowBucket, FlowPersonEntry[]> = {
    permanentHousing: [],
    otherDestinations: [],
    unknownInactive: [],
  }

  const byId = new Map(persons.map((p) => [p.id, p]))

  for (const id of eomRoster) {
    if (bomRoster.has(id)) continue
    const p = byId.get(id)
    if (!p) continue
    const entryBase = { id, name: personName(p), client_id: p.client_id }

    if (p.enrollment_date >= monthStart && p.enrollment_date <= effectiveMonthEnd) {
      inflows.newlyExperiencing.push({ ...entryBase, date: p.enrollment_date })
      continue
    }
    const priorExit = priorManualExit(id, effectiveMonthEnd)
    if (priorExit && PERMANENT_HOUSING_DESTINATIONS.includes(priorExit.exit_destination || '')) {
      inflows.returnedToHomelessness.push({ ...entryBase, date: priorExit.change_date })
    } else {
      const returnEvent = statusByPerson.get(id)?.find(
        (sc) => sc.change_type === 'return_to_active' && sc.change_date >= monthStart && sc.change_date <= effectiveMonthEnd
      )
      inflows.returnedToActive.push({ ...entryBase, date: returnEvent?.change_date || effectiveMonthEnd })
    }
  }

  for (const id of bomRoster) {
    if (eomRoster.has(id)) continue
    const p = byId.get(id)
    if (!p) continue
    const entryBase = { id, name: personName(p), client_id: p.client_id }

    const exitEvent = manualExitInMonth(id)
    if (exitEvent && PERMANENT_HOUSING_DESTINATIONS.includes(exitEvent.exit_destination || '')) {
      outflows.permanentHousing.push({ ...entryBase, date: exitEvent.change_date })
    } else if (exitEvent) {
      outflows.otherDestinations.push({ ...entryBase, date: exitEvent.change_date })
    } else {
      outflows.unknownInactive.push({ ...entryBase, date: effectiveMonthEnd })
    }
  }

  // hadReturnEventInMonth is exposed above for potential future use (e.g. distinguishing
  // a formally-logged return from a silent recontact); not currently surfaced in the UI.
  void hadReturnEventInMonth

  const totalInflows = inflows.newlyExperiencing.length + inflows.returnedToHomelessness.length + inflows.returnedToActive.length
  const totalOutflows = outflows.permanentHousing.length + outflows.otherDestinations.length + outflows.unknownInactive.length

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return {
    monthLabel,
    beginningOfMonth: bomRoster.size,
    endOfMonth: eomRoster.size,
    isPartialMonth,
    inflows,
    outflows,
    totalInflows,
    totalOutflows,
  }
}
