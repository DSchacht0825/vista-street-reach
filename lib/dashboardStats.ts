import { format } from 'date-fns'

// Client-side twin of the date-range stats computed in app/dashboard/page.tsx.
// Lets the dashboard re-filter instantly in the browser without a server round trip.

export interface StatsPerson {
  id: string
  gender?: string | null
  race?: string | null
  ethnicity?: string | null
  veteran_status?: boolean
  chronic_homeless?: boolean
  phone_number?: string | null
  income_amount?: number | null
  how_came_to_vista?: string | null
  time_in_vista?: string | null
  exit_date?: string | null
}

export interface StatsEncounter {
  service_date: string
  person_id: string
  latitude?: number | null
  longitude?: number | null
  co_occurring_mh_sud?: boolean
  mat_referral?: boolean
  mat_provider?: string | null
  detox_referral?: boolean
  detox_provider?: string | null
  fentanyl_test_strips_count?: number | null
  transportation_provided?: boolean
  naloxone_distributed?: boolean
  shower_trailer?: boolean
  harm_reduction_education?: boolean
  case_management_notes?: string | null
  placement_made?: boolean
  placement_location?: string | null
  placement_location_other?: string | null
  placement_detox_name?: string | null
  refused_shelter?: boolean
  refused_services?: boolean
  shelter_unavailable?: boolean
  high_utilizer_contact?: boolean
  support_services?: string[] | null
  service_types?: string[] | null
}

// Label for where a placement happened: the typed label when the location is "Other"
export function getPlacementLabel(e: {
  placement_location?: string | null
  placement_location_other?: string | null
}): string {
  const other = e.placement_location_other?.trim()
  if (e.placement_location === 'Other') return other || 'Other'
  return e.placement_location || other || 'Unknown'
}

const pacificParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// YYYY-MM-DD in Pacific time for a UTC timestamp
export function getPacificDateString(dateStr: string): string {
  const parts = pacificParts.formatToParts(new Date(dateStr))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function count<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function buildDateRangeText(startDate: string, endDate: string): string {
  const fmt = (d: string) => format(new Date(d + 'T00:00:00'), 'MMM dd, yyyy')
  try {
    if (startDate && endDate) return `Showing data from ${fmt(startDate)} to ${fmt(endDate)}`
    if (startDate) return `Showing data from ${fmt(startDate)} onwards`
    if (endDate) return `Showing data up to ${fmt(endDate)}`
  } catch {
    return ''
  }
  return ''
}

export function computeDashboardStats<P extends StatsPerson, E extends StatsEncounter>(
  allPersons: P[],
  allEncounters: E[],
  startDate: string,
  endDate: string
) {
  const filteredEncounters = allEncounters.filter(e => {
    if (!startDate && !endDate) return true
    const d = getPacificDateString(e.service_date)
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  })

  const uniquePersonIds = new Set(filteredEncounters.map(e => e.person_id))
  const filteredPersons = startDate || endDate
    ? allPersons.filter(p => uniquePersonIds.has(p.id))
    : allPersons

  const personsWithExits = allPersons.filter(p => {
    if (!p.exit_date) return false
    if (startDate && p.exit_date < startDate) return false
    if (endDate && p.exit_date > endDate) return false
    return true
  })

  const enc = filteredEncounters
  const withService = (s: string) => enc.filter(e => e.support_services?.includes(s)).length

  const metrics = {
    unduplicatedIndividuals: filteredPersons.length,
    totalInteractions: enc.length,
    matDetoxReferrals: enc.filter(e => e.mat_referral || e.detox_referral).length,
    coOccurringConditions: enc.filter(e => e.co_occurring_mh_sud).length,
    fentanylTestStrips: enc.reduce((sum, e) => sum + (e.fentanyl_test_strips_count || 0), 0),
    transportationProvided: enc.filter(e => e.transportation_provided).length,
    exitsFromHomelessness: personsWithExits.length,
    naloxoneDistributed: enc.filter(e => e.naloxone_distributed).length,
    placementsMade: enc.filter(e => e.placement_made).length,
    showerTrailer: enc.filter(e => e.shower_trailer).length,
    harmReduction: enc.filter(e => e.harm_reduction_education).length,
    caseManagement: enc.filter(e => e.case_management_notes).length,
    refusedShelter: enc.filter(e => e.refused_shelter).length,
    refusedServices: enc.filter(e => e.refused_services).length,
    shelterUnavailable: enc.filter(e => e.shelter_unavailable).length,
    highUtilizerEncounters: enc.filter(e => e.high_utilizer_contact).length,
    highUtilizerPeople: new Set(enc.filter(e => e.high_utilizer_contact).map(e => e.person_id)).size,
    birthCertificate: withService('birth_certificate'),
    ssCard: withService('ss_card'),
    foodStamps: withService('food_stamps'),
    mediCal: withService('medi_cal'),
    foodProvided: withService('food_provided'),
    phoneAssistance: withService('phone_assistance'),
    bridgeHousing: enc.filter(e => e.placement_location === 'Bridge Housing').length,
    familyReunification: enc.filter(e => e.placement_location === 'Family Reunification').length,
    detoxPlacements: enc.filter(e => e.placement_location === 'Detox').length,
  }

  const detoxPlacementDetails = enc
    .filter(e => e.placement_location === 'Detox' && e.placement_detox_name)
    .reduce((acc, e) => {
      const name = e.placement_detox_name!
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const demographics = {
    byGender: count(filteredPersons, p => p.gender || 'Unknown'),
    byRace: count(filteredPersons, p => p.race || 'Unknown'),
    byEthnicity: count(filteredPersons, p => p.ethnicity || 'Unknown'),
    veterans: filteredPersons.filter(p => p.veteran_status).length,
    chronicallyHomeless: filteredPersons.filter(p => p.chronic_homeless).length,
    withPhone: filteredPersons.filter(p => p.phone_number).length,
    withIncome: filteredPersons.filter(p => p.income_amount && p.income_amount > 0).length,
    totalIncome: filteredPersons.reduce((sum, p) => sum + (p.income_amount || 0), 0),
  }

  const howCameToVistaBreakdown = count(filteredPersons, p => p.how_came_to_vista || 'Not specified')
  const timeInVistaBreakdown = count(filteredPersons, p => p.time_in_vista || 'Not specified')

  const locations = enc
    .filter(e => e.latitude && e.longitude)
    .map(e => {
      const [y, m, d] = getPacificDateString(e.service_date).split('-').map(Number)
      return {
        latitude: e.latitude!,
        longitude: e.longitude!,
        date: format(new Date(y, m - 1, d), 'MMM dd, yyyy'),
      }
    })

  const serviceTypes = {
    caseManagement: metrics.caseManagement,
    harmReduction: metrics.harmReduction,
    matReferrals: enc.filter(e => e.mat_referral).length,
    detoxReferrals: enc.filter(e => e.detox_referral).length,
    naloxone: metrics.naloxoneDistributed,
    transportation: metrics.transportationProvided,
    showerTrailer: metrics.showerTrailer,
  }

  const matByProvider: Record<string, number> = {}
  const detoxByProvider: Record<string, number> = {}
  const placementsByLocation: Record<string, number> = {}
  const serviceTypeBreakdown: Record<string, number> = {}
  enc.forEach(e => {
    if (e.mat_referral && e.mat_provider) {
      matByProvider[e.mat_provider] = (matByProvider[e.mat_provider] || 0) + 1
    }
    if (e.detox_referral && e.detox_provider) {
      detoxByProvider[e.detox_provider] = (detoxByProvider[e.detox_provider] || 0) + 1
    }
    if (e.placement_made) {
      const location = getPlacementLabel(e)
      placementsByLocation[location] = (placementsByLocation[location] || 0) + 1
    }
    if (Array.isArray(e.service_types) && e.service_types.length > 0) {
      e.service_types.forEach(type => {
        serviceTypeBreakdown[type] = (serviceTypeBreakdown[type] || 0) + 1
      })
    } else {
      // Legacy encounters logged before an interaction type was required
      serviceTypeBreakdown['Not categorized'] = (serviceTypeBreakdown['Not categorized'] || 0) + 1
    }
  })

  return {
    dateRangeText: buildDateRangeText(startDate, endDate),
    metrics,
    demographics,
    serviceTypes,
    serviceTypeBreakdown,
    matByProvider,
    detoxByProvider,
    placementsByLocation,
    detoxPlacementDetails,
    howCameToVistaBreakdown,
    timeInVistaBreakdown,
    locations,
    filteredPersons,
    filteredEncounters,
    personsWithExits,
  }
}
