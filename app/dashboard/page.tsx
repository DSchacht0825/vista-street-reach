import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import LogoutButton from '@/components/LogoutButton'
import DuplicateManagerWrapper from '@/components/DuplicateManagerWrapper'
import DashboardClient from './DashboardClient'

// Disable caching for this page - always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start_date?: string; end_date?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Get date range from URL params
  const startDate = params.start_date || ''
  const endDate = params.end_date || ''

  // Helper function to get Pacific time date string from UTC timestamp
  // Pacific time is UTC-8 (PST) or UTC-7 (PDT)
  const getPacificDateString = (dateStr: string): string => {
    const date = new Date(dateStr)
    // Use toLocaleString to get the date in Pacific timezone
    const pacificDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const year = pacificDate.getFullYear()
    const month = String(pacificDate.getMonth() + 1).padStart(2, '0')
    const day = String(pacificDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fetch all persons with pagination to bypass 1000 row limit
  let allPersonsData: Record<string, unknown>[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Dashboard data fetch error:', error)
      break
    }

    if (!data || data.length === 0) break
    allPersonsData = allPersonsData.concat(data)
    from += pageSize

    if (from > 50000) break
  }

  // Fetch all encounters with pagination
  let allEncountersData: Record<string, unknown>[] = []
  from = 0

  while (true) {
    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Encounters fetch error:', error)
      break
    }

    if (!data || data.length === 0) break
    allEncountersData = allEncountersData.concat(data)
    from += pageSize

    if (from > 100000) break
  }

  // Fetch status changes for exits/returns
  let statusChangesData: Record<string, unknown>[] = []
  const { data: statusData } = await supabase
    .from('status_changes')
    .select('*')
    .order('change_date', { ascending: false })

  if (statusData) {
    statusChangesData = statusData
  }

  // Type definitions
  type PersonData = {
    id: string
    client_id: string
    first_name: string
    middle_name?: string | null
    last_name?: string | null
    nickname?: string | null
    aka?: string | null
    gender?: string | null
    race?: string | null
    ethnicity?: string | null
    age?: number | null
    date_of_birth?: string | null
    height?: string | null
    weight?: string | null
    hair_color?: string | null
    eye_color?: string | null
    physical_description?: string | null
    phone_number?: string | null
    notes?: string | null
    last_contact?: string | null
    contact_count?: number | null
    enrollment_date: string
    veteran_status: boolean
    disability_status?: boolean
    disability_type?: string | null
    chronic_homeless: boolean
    living_situation?: string | null
    income?: string | null
    income_amount?: number | null
    exit_date?: string | null
    exit_destination?: string | null
    exit_notes?: string | null
    sexual_orientation?: string | null
  }

  type EncounterData = {
    id: string
    person_id: string
    service_date: string
    outreach_location: string
    latitude?: number | null
    longitude?: number | null
    outreach_worker: string
    co_occurring_mh_sud: boolean
    co_occurring_type?: string | null
    mat_referral: boolean
    mat_type?: string | null
    mat_provider?: string | null
    detox_referral: boolean
    detox_provider?: string | null
    fentanyl_test_strips_count?: number | null
    harm_reduction_education?: boolean
    transportation_provided: boolean
    shower_trailer?: boolean
    placement_made?: boolean
    placement_location?: string | null
    placement_location_other?: string | null
    placement_detox_name?: string | null
    refused_shelter?: boolean
    refused_services?: boolean
    shelter_unavailable?: boolean
    high_utilizer_contact?: boolean
    case_management_notes?: string | null
    naloxone_distributed?: boolean
    naloxone_date?: string | null
    support_services?: string[] | null
  }

  type StatusChange = {
    id: string
    person_id: string
    change_type: 'exit' | 'return_to_active'
    change_date: string
    exit_destination?: string | null
    notes?: string | null
    created_by?: string | null
    created_at: string
  }

  const allPersons = (allPersonsData || []) as PersonData[]
  const allEncounters = (allEncountersData || []) as EncounterData[]
  const statusChanges = (statusChangesData || []) as StatusChange[]

  // Filter encounters by date range if specified (using Pacific timezone)
  let filteredEncounters = allEncounters
  if (startDate) {
    filteredEncounters = filteredEncounters.filter(e => {
      const serviceDate = getPacificDateString(e.service_date)
      return serviceDate >= startDate
    })
  }
  if (endDate) {
    filteredEncounters = filteredEncounters.filter(e => {
      const serviceDate = getPacificDateString(e.service_date)
      return serviceDate <= endDate
    })
  }

  // Get unique person IDs from filtered encounters
  const uniquePersonIds = new Set(filteredEncounters.map(e => e.person_id))
  const filteredPersons = startDate || endDate
    ? allPersons.filter(p => uniquePersonIds.has(p.id))
    : allPersons

  // Filter persons with exits in date range
  const personsWithExits = allPersons.filter(p => {
    if (!p.exit_date) return false
    if (startDate && p.exit_date < startDate) return false
    if (endDate && p.exit_date > endDate) return false
    return true
  })

  // Calculate 90-day cutoff for active status
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0]

  // Calculate 180-day cutoff (for "fell off in last 90 days")
  const oneEightyDaysAgo = new Date()
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180)
  const cutoff180Date = oneEightyDaysAgo.toISOString().split('T')[0]

  // Separate active and inactive clients (from all clients, not filtered)
  const activeClients = allPersons.filter(p => p.last_contact && p.last_contact >= cutoffDate && !p.exit_date)
  const inactiveClients = allPersons.filter(p => (!p.last_contact || p.last_contact < cutoffDate) && !p.exit_date)
  const exitedClients = allPersons.filter(p => p.exit_date)

  // Clients who fell off in the last 90 days (were active, now inactive)
  // Last contact between 90-180 days ago
  const fellOffClients = allPersons.filter(p =>
    p.last_contact &&
    p.last_contact < cutoffDate &&
    p.last_contact >= cutoff180Date &&
    !p.exit_date
  )

  // Calculate metrics
  const metrics = {
    unduplicatedIndividuals: filteredPersons.length,
    totalInteractions: filteredEncounters.length,
    matDetoxReferrals: filteredEncounters.filter(e => e.mat_referral || e.detox_referral).length,
    coOccurringConditions: filteredEncounters.filter(e => e.co_occurring_mh_sud).length,
    fentanylTestStrips: filteredEncounters.reduce((sum, e) => sum + (e.fentanyl_test_strips_count || 0), 0),
    transportationProvided: filteredEncounters.filter(e => e.transportation_provided).length,
    exitsFromHomelessness: personsWithExits.length,
    naloxoneDistributed: filteredEncounters.filter(e => e.naloxone_distributed).length,
    placementsMade: filteredEncounters.filter(e => e.placement_made).length,
    showerTrailer: filteredEncounters.filter(e => e.shower_trailer).length,
    harmReduction: filteredEncounters.filter(e => e.harm_reduction_education).length,
    caseManagement: filteredEncounters.filter(e => e.case_management_notes).length,
    refusedShelter: filteredEncounters.filter(e => e.refused_shelter).length,
    refusedServices: filteredEncounters.filter(e => e.refused_services).length,
    shelterUnavailable: filteredEncounters.filter(e => e.shelter_unavailable).length,
    highUtilizerEncounters: filteredEncounters.filter(e => e.high_utilizer_contact).length,
    highUtilizerPeople: new Set(filteredEncounters.filter(e => e.high_utilizer_contact).map(e => e.person_id)).size,
    // Support services
    birthCertificate: filteredEncounters.filter(e => e.support_services?.includes('birth_certificate')).length,
    ssCard: filteredEncounters.filter(e => e.support_services?.includes('ss_card')).length,
    foodStamps: filteredEncounters.filter(e => e.support_services?.includes('food_stamps')).length,
    mediCal: filteredEncounters.filter(e => e.support_services?.includes('medi_cal')).length,
    foodProvided: filteredEncounters.filter(e => e.support_services?.includes('food_provided')).length,
    phoneAssistance: filteredEncounters.filter(e => e.support_services?.includes('phone_assistance')).length,
    // Placement breakdown
    bridgeHousing: filteredEncounters.filter(e => e.placement_location === 'Bridge Housing').length,
    familyReunification: filteredEncounters.filter(e => e.placement_location === 'Family Reunification').length,
    detoxPlacements: filteredEncounters.filter(e => e.placement_location === 'Detox').length,
  }

  // Get detox placement details with facility names
  const detoxPlacementDetails = filteredEncounters
    .filter(e => e.placement_location === 'Detox' && e.placement_detox_name)
    .reduce((acc, e) => {
      const name = e.placement_detox_name!
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  // Demographics breakdown
  const demographics = {
    byGender: filteredPersons.reduce((acc, p) => {
      const gender = p.gender || 'Unknown'
      acc[gender] = (acc[gender] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byRace: filteredPersons.reduce((acc, p) => {
      const race = p.race || 'Unknown'
      acc[race] = (acc[race] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byEthnicity: filteredPersons.reduce((acc, p) => {
      const ethnicity = p.ethnicity || 'Unknown'
      acc[ethnicity] = (acc[ethnicity] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    veterans: filteredPersons.filter(p => p.veteran_status).length,
    chronicallyHomeless: filteredPersons.filter(p => p.chronic_homeless).length,
    withPhone: filteredPersons.filter(p => p.phone_number).length,
    withIncome: filteredPersons.filter(p => p.income_amount && p.income_amount > 0).length,
    totalIncome: filteredPersons.reduce((sum, p) => sum + (p.income_amount || 0), 0),
  }

  // Locations for heat map - only encounters with GPS data (using Pacific timezone for display)
  const locations = filteredEncounters
    .filter(e => e.latitude && e.longitude)
    .map(e => {
      // Convert to Pacific time for display
      const utcDate = new Date(e.service_date)
      const pacificDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      return {
        latitude: e.latitude!,
        longitude: e.longitude!,
        date: format(pacificDate, 'MMM dd, yyyy'),
      }
    })

  // Total contacts
  const totalContacts = allPersons.reduce((sum, p) => sum + (p.contact_count || 0), 0)

  // Recently contacted (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDayCutoff = thirtyDaysAgo.toISOString().split('T')[0]
  const recentlyContacted = allPersons.filter(p => p.last_contact && p.last_contact >= thirtyDayCutoff)

  // Build date range display text
  let dateRangeText = ''
  if (startDate && endDate) {
    dateRangeText = `Showing data from ${format(new Date(startDate + 'T00:00:00'), 'MMM dd, yyyy')} to ${format(new Date(endDate + 'T00:00:00'), 'MMM dd, yyyy')}`
  } else if (startDate) {
    dateRangeText = `Showing data from ${format(new Date(startDate + 'T00:00:00'), 'MMM dd, yyyy')} onwards`
  } else if (endDate) {
    dateRangeText = `Showing data up to ${format(new Date(endDate + 'T00:00:00'), 'MMM dd, yyyy')}`
  }

  // Service interaction types for breakdown
  const serviceTypes = {
    caseManagement: filteredEncounters.filter(e => e.case_management_notes).length,
    harmReduction: filteredEncounters.filter(e => e.harm_reduction_education).length,
    matReferrals: filteredEncounters.filter(e => e.mat_referral).length,
    detoxReferrals: filteredEncounters.filter(e => e.detox_referral).length,
    naloxone: filteredEncounters.filter(e => e.naloxone_distributed).length,
    transportation: filteredEncounters.filter(e => e.transportation_provided).length,
    showerTrailer: filteredEncounters.filter(e => e.shower_trailer).length,
  }

  // Referral breakdowns
  const matByProvider: Record<string, number> = {}
  const detoxByProvider: Record<string, number> = {}
  filteredEncounters.forEach(e => {
    if (e.mat_referral && e.mat_provider) {
      matByProvider[e.mat_provider] = (matByProvider[e.mat_provider] || 0) + 1
    }
    if (e.detox_referral && e.detox_provider) {
      detoxByProvider[e.detox_provider] = (detoxByProvider[e.detox_provider] || 0) + 1
    }
  })

  // Placements breakdown
  const placementsByLocation: Record<string, number> = {}
  filteredEncounters.filter(e => e.placement_made).forEach(e => {
    const location = e.placement_location || e.placement_location_other || 'Unknown'
    placementsByLocation[location] = (placementsByLocation[location] || 0) + 1
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Blue Header Bar */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="https://www.sdrescue.org/wp-content/uploads/2021/06/SDRMLogo2016.svg"
                alt="San Diego Rescue Mission"
                width={180}
                height={60}
                className="h-12 w-auto bg-white p-2 rounded"
              />
              <div className="border-l-2 border-blue-500 pl-4">
                <h1 className="text-2xl font-bold text-white">
                  Vista Street Reach
                </h1>
                <p className="text-blue-200 text-sm">
                  By-name list & service tracking
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with navigation */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <Link
              href="/"
              className="text-blue-700 hover:text-blue-800 font-medium mb-4 inline-flex items-center"
            >
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Client List
            </Link>
            <h2 className="text-3xl font-bold text-gray-900 mt-4">
              Admin Dashboard
            </h2>
            <p className="text-gray-600 mt-1">
              Client overview and program analytics
            </p>
          </div>
          <div>
            <Link
              href="/dashboard/users"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Manage Users
            </Link>
          </div>
        </div>

        {/* Date Range Filter */}
        <DashboardClient
          initialStartDate={startDate}
          initialEndDate={endDate}
          dateRangeText={dateRangeText}
          metrics={metrics}
          demographics={demographics}
          serviceTypes={serviceTypes}
          matByProvider={matByProvider}
          detoxByProvider={detoxByProvider}
          placementsByLocation={placementsByLocation}
          detoxPlacementDetails={detoxPlacementDetails}
          locations={locations}
          allPersons={allPersons.map(p => ({
            id: p.id,
            client_id: p.client_id,
            first_name: p.first_name,
            last_name: p.last_name || '',
            nickname: p.nickname,
            date_of_birth: p.date_of_birth || '',
            gender: p.gender || 'Unknown',
            race: p.race || 'Unknown',
            ethnicity: p.ethnicity || 'Unknown',
            sexual_orientation: p.sexual_orientation,
            living_situation: p.living_situation || 'Unknown',
            length_of_time_homeless: null,
            veteran_status: p.veteran_status,
            chronic_homeless: p.chronic_homeless,
            enrollment_date: p.enrollment_date,
            case_manager: null,
            referral_source: null,
            disability_status: p.disability_status,
            disability_type: p.disability_type,
            exit_date: p.exit_date,
            exit_destination: p.exit_destination,
            exit_notes: p.exit_notes,
          }))}
          allEncounters={allEncounters.map(e => ({
            id: e.id,
            service_date: e.service_date,
            person_id: e.person_id,
            outreach_location: e.outreach_location,
            latitude: e.latitude || 0,
            longitude: e.longitude || 0,
            outreach_worker: e.outreach_worker,
            language_preference: null,
            co_occurring_mh_sud: e.co_occurring_mh_sud,
            co_occurring_type: e.co_occurring_type,
            mat_referral: e.mat_referral,
            mat_type: e.mat_type,
            mat_provider: e.mat_provider,
            detox_referral: e.detox_referral,
            detox_provider: e.detox_provider,
            fentanyl_test_strips_count: e.fentanyl_test_strips_count,
            harm_reduction_education: e.harm_reduction_education || false,
            transportation_provided: e.transportation_provided,
            shower_trailer: e.shower_trailer || false,
            other_services: null,
            placement_made: e.placement_made,
            placement_location: e.placement_location,
            placement_location_other: e.placement_location_other,
            refused_shelter: e.refused_shelter,
            refused_services: e.refused_services,
            shelter_unavailable: e.shelter_unavailable,
            high_utilizer_contact: e.high_utilizer_contact,
            case_management_notes: e.case_management_notes,
            support_services: e.support_services || [],
          }))}
          filteredPersons={filteredPersons.map(p => ({
            id: p.id,
            client_id: p.client_id,
            first_name: p.first_name,
            last_name: p.last_name || '',
            nickname: p.nickname,
            date_of_birth: p.date_of_birth || '',
            gender: p.gender || 'Unknown',
            race: p.race || 'Unknown',
            ethnicity: p.ethnicity || 'Unknown',
            sexual_orientation: p.sexual_orientation,
            living_situation: p.living_situation || 'Unknown',
            length_of_time_homeless: null,
            veteran_status: p.veteran_status,
            chronic_homeless: p.chronic_homeless,
            enrollment_date: p.enrollment_date,
            case_manager: null,
            referral_source: null,
            disability_status: p.disability_status,
            disability_type: p.disability_type,
            exit_date: p.exit_date,
            exit_destination: p.exit_destination,
            exit_notes: p.exit_notes,
          }))}
          filteredEncounters={filteredEncounters.map(e => ({
            id: e.id,
            service_date: e.service_date,
            person_id: e.person_id,
            outreach_location: e.outreach_location,
            latitude: e.latitude || 0,
            longitude: e.longitude || 0,
            outreach_worker: e.outreach_worker,
            language_preference: null,
            co_occurring_mh_sud: e.co_occurring_mh_sud,
            co_occurring_type: e.co_occurring_type,
            mat_referral: e.mat_referral,
            mat_type: e.mat_type,
            mat_provider: e.mat_provider,
            detox_referral: e.detox_referral,
            detox_provider: e.detox_provider,
            fentanyl_test_strips_count: e.fentanyl_test_strips_count,
            harm_reduction_education: e.harm_reduction_education || false,
            transportation_provided: e.transportation_provided,
            shower_trailer: e.shower_trailer || false,
            other_services: null,
            placement_made: e.placement_made,
            placement_location: e.placement_location,
            placement_location_other: e.placement_location_other,
            refused_shelter: e.refused_shelter,
            refused_services: e.refused_services,
            shelter_unavailable: e.shelter_unavailable,
            high_utilizer_contact: e.high_utilizer_contact,
            case_management_notes: e.case_management_notes,
            support_services: e.support_services || [],
          }))}
          statusChanges={statusChanges}
          activeClients={activeClients.length}
          inactiveClients={inactiveClients.length}
          fellOffClients={fellOffClients.length}
          exitedClients={exitedClients.length}
          totalContacts={totalContacts}
          recentlyContacted={recentlyContacted.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name || '',
            last_contact: p.last_contact,
          }))}
          personsWithExits={personsWithExits.map(p => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name || '',
            exit_date: p.exit_date,
            exit_destination: p.exit_destination,
          }))}
        />

        {/* Duplicate Detection */}
        <div className="mt-6">
          <DuplicateManagerWrapper />
        </div>
      </div>
    </div>
  )
}
