'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import MetricsGrid from '@/components/MetricsGrid'
import EncounterHeatMap from '@/components/EncounterHeatMap'
import CustomReportBuilder from '@/components/CustomReportBuilder'
import ProgramExitsSection from '@/components/ProgramExitsSection'
import ExportButton from '@/components/ExportButton'

interface Person {
  id: string
  client_id: string
  first_name: string
  last_name: string
  nickname?: string | null
  date_of_birth: string
  gender: string
  race: string
  ethnicity: string
  sexual_orientation?: string | null
  living_situation: string
  length_of_time_homeless?: string | null
  veteran_status: boolean
  chronic_homeless: boolean
  enrollment_date: string
  case_manager?: string | null
  referral_source?: string | null
  disability_status?: boolean
  disability_type?: string | null
  exit_date?: string | null
  exit_destination?: string | null
  exit_notes?: string | null
}

interface Encounter {
  id?: string
  service_date: string
  person_id: string
  outreach_location: string
  latitude: number
  longitude: number
  outreach_worker: string
  language_preference?: string | null
  co_occurring_mh_sud: boolean
  co_occurring_type?: string | null
  mat_referral: boolean
  mat_type?: string | null
  mat_provider?: string | null
  detox_referral: boolean
  detox_provider?: string | null
  fentanyl_test_strips_count?: number | null
  harm_reduction_education: boolean
  transportation_provided: boolean
  shower_trailer: boolean
  other_services?: string | null
  placement_made?: boolean
  placement_location?: string | null
  placement_location_other?: string | null
  refused_shelter?: boolean
  shelter_unavailable?: boolean
  high_utilizer_contact?: boolean
  case_management_notes?: string | null
  support_services?: string[]
}

interface StatusChange {
  id: string
  person_id: string
  change_type: 'exit' | 'return_to_active'
  change_date: string
  exit_destination?: string | null
  notes?: string | null
  created_by?: string | null
  created_at: string
}

interface Location {
  latitude: number
  longitude: number
  date: string
}

interface RecentPerson {
  id: string
  first_name: string
  last_name: string
  last_contact?: string | null
}

interface ExitedPerson {
  id: string
  first_name: string
  last_name: string
  exit_date?: string | null
  exit_destination?: string | null
}

interface DashboardClientProps {
  initialStartDate: string
  initialEndDate: string
  dateRangeText: string
  metrics: {
    unduplicatedIndividuals: number
    totalInteractions: number
    matDetoxReferrals: number
    coOccurringConditions: number
    fentanylTestStrips: number
    transportationProvided: number
    exitsFromHomelessness: number
    naloxoneDistributed: number
    placementsMade: number
    showerTrailer: number
    harmReduction: number
    caseManagement: number
    refusedShelter: number
    shelterUnavailable: number
    highUtilizer: number
    // Support services
    birthCertificate: number
    ssCard: number
    foodStamps: number
    mediCal: number
    foodProvided: number
    // Placement breakdown
    bridgeHousing: number
    familyReunification: number
    detoxPlacements: number
  }
  demographics: {
    byGender: Record<string, number>
    byRace: Record<string, number>
    byEthnicity: Record<string, number>
    veterans: number
    chronicallyHomeless: number
    withPhone: number
    withIncome: number
    totalIncome: number
  }
  serviceTypes: {
    caseManagement: number
    harmReduction: number
    matReferrals: number
    detoxReferrals: number
    naloxone: number
    transportation: number
    showerTrailer: number
  }
  matByProvider: Record<string, number>
  detoxByProvider: Record<string, number>
  placementsByLocation: Record<string, number>
  detoxPlacementDetails: Record<string, number>
  locations: Location[]
  allPersons: Person[]
  allEncounters: Encounter[]
  filteredPersons: Person[]
  filteredEncounters: Encounter[]
  statusChanges: StatusChange[]
  activeClients: number
  inactiveClients: number
  exitedClients: number
  totalContacts: number
  recentlyContacted: RecentPerson[]
  personsWithExits: ExitedPerson[]
}

export default function DashboardClient({
  initialStartDate,
  initialEndDate,
  dateRangeText,
  metrics,
  demographics,
  serviceTypes,
  matByProvider,
  detoxByProvider,
  placementsByLocation,
  detoxPlacementDetails,
  locations,
  allPersons,
  allEncounters,
  filteredPersons,
  filteredEncounters,
  statusChanges,
  activeClients,
  inactiveClients,
  exitedClients,
  totalContacts,
  recentlyContacted,
  personsWithExits,
}: DashboardClientProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [showReportBuilder, setShowReportBuilder] = useState(false)

  const handleApplyFilter = () => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    router.push(`/dashboard?${params.toString()}`)
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    router.push('/dashboard')
  }

  const avgContacts = allPersons.length > 0
    ? Math.round(totalContacts / allPersons.length * 10) / 10
    : 0

  return (
    <>
      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleApplyFilter}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Apply Filter
          </button>
          {(initialStartDate || initialEndDate) && (
            <button
              onClick={handleClearFilter}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Clear
            </button>
          )}
        </div>
        {dateRangeText && (
          <p className="mt-3 text-sm text-blue-600 font-medium">{dateRangeText}</p>
        )}
      </div>

      {/* Quick Summary Cards */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-blue-600 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-bold text-gray-900">
              Quick Summary
            </h3>
          </div>
          <ExportButton
            persons={filteredPersons}
            encounters={filteredEncounters}
            dateRange={dateRangeText || 'All Time'}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-blue-600">{metrics.unduplicatedIndividuals}</p>
            <p className="text-sm text-gray-600 mt-1">Clients Served</p>
            <p className="text-xs text-gray-500">Unduplicated individuals</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-green-600">{metrics.totalInteractions}</p>
            <p className="text-sm text-gray-600 mt-1">Service Interactions</p>
            <p className="text-xs text-gray-500">Total encounters</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-teal-600">{metrics.exitsFromHomelessness}</p>
            <p className="text-sm text-gray-600 mt-1">Program Exits</p>
            <p className="text-xs text-gray-500">Clients exited from program</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-purple-600">{metrics.placementsMade}</p>
            <p className="text-sm text-gray-600 mt-1">Placements Made</p>
            <p className="text-xs text-gray-500">Housing placements</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-indigo-600">{metrics.transportationProvided}</p>
            <p className="text-sm text-gray-600 mt-1">Transportation</p>
            <p className="text-xs text-gray-500">Rides provided</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center">
            <p className="text-3xl font-bold text-orange-600">{metrics.matDetoxReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">Total Referrals</p>
            <p className="text-xs text-gray-500">MAT & Detox combined</p>
          </div>
        </div>

        {/* Shelter Status Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-red-500">
            <p className="text-3xl font-bold text-red-600">{metrics.refusedShelter}</p>
            <p className="text-sm text-gray-600 mt-1">Refused Shelter</p>
            <p className="text-xs text-gray-500">Client declined placement</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-orange-500">
            <p className="text-3xl font-bold text-orange-600">{metrics.shelterUnavailable}</p>
            <p className="text-sm text-gray-600 mt-1">Shelter Unavailable</p>
            <p className="text-xs text-gray-500">No beds available</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-yellow-500">
            <p className="text-3xl font-bold text-yellow-600">{metrics.highUtilizer}</p>
            <p className="text-sm text-gray-600 mt-1">High Utilizer</p>
            <p className="text-xs text-gray-500">Frequent service contacts</p>
          </div>
        </div>

        {/* Support Services Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-blue-500">
            <p className="text-3xl font-bold text-blue-600">{metrics.birthCertificate}</p>
            <p className="text-sm text-gray-600 mt-1">Birth Certificate</p>
            <p className="text-xs text-gray-500">Assistance provided</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-indigo-500">
            <p className="text-3xl font-bold text-indigo-600">{metrics.ssCard}</p>
            <p className="text-sm text-gray-600 mt-1">Social Security Card</p>
            <p className="text-xs text-gray-500">Assistance provided</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-green-500">
            <p className="text-3xl font-bold text-green-600">{metrics.foodStamps}</p>
            <p className="text-sm text-gray-600 mt-1">CalFresh/Food Stamps</p>
            <p className="text-xs text-gray-500">Enrollment help</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-teal-500">
            <p className="text-3xl font-bold text-teal-600">{metrics.mediCal}</p>
            <p className="text-sm text-gray-600 mt-1">Medi-Cal</p>
            <p className="text-xs text-gray-500">Enrollment help</p>
          </div>

          <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-amber-500">
            <p className="text-3xl font-bold text-amber-600">{metrics.foodProvided}</p>
            <p className="text-sm text-gray-600 mt-1">Food/Meals</p>
            <p className="text-xs text-gray-500">Provided to clients</p>
          </div>
        </div>

        {/* Special Placements Row */}
        {(metrics.bridgeHousing > 0 || metrics.familyReunification > 0 || metrics.detoxPlacements > 0) && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-purple-500">
              <p className="text-3xl font-bold text-purple-600">{metrics.bridgeHousing}</p>
              <p className="text-sm text-gray-600 mt-1">Bridge Housing</p>
              <p className="text-xs text-gray-500">Transitional placements</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-pink-500">
              <p className="text-3xl font-bold text-pink-600">{metrics.familyReunification}</p>
              <p className="text-sm text-gray-600 mt-1">Family Reunification</p>
              <p className="text-xs text-gray-500">Reconnected with family</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow text-center border-l-4 border-teal-500">
              <p className="text-3xl font-bold text-teal-600">{metrics.detoxPlacements}</p>
              <p className="text-sm text-gray-600 mt-1">Detox Placements</p>
              <p className="text-xs text-gray-500">Treatment facilities</p>
            </div>
          </div>
        )}

        {/* Detox Placement Details */}
        {Object.keys(detoxPlacementDetails).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <h4 className="text-md font-semibold mb-3 text-teal-700">Detox Placements by Facility</h4>
            <div className="space-y-2">
              {Object.entries(detoxPlacementDetails)
                .sort(([, a], [, b]) => b - a)
                .map(([facility, count]) => (
                  <div key={facility} className="flex justify-between items-center bg-teal-50 px-3 py-2 rounded">
                    <span className="text-gray-700">{facility}</span>
                    <span className="font-semibold text-teal-600">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Referral Breakdown */}
      {(Object.keys(matByProvider).length > 0 || Object.keys(detoxByProvider).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-purple-700">MAT Referrals by Provider</h3>
            {Object.keys(matByProvider).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(matByProvider)
                  .sort(([, a], [, b]) => b - a)
                  .map(([provider, count]) => (
                    <div key={provider} className="flex justify-between items-center bg-purple-50 px-3 py-2 rounded">
                      <span className="text-gray-700">{provider}</span>
                      <span className="font-semibold text-purple-600">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No MAT referrals in this period</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-700">Detox Referrals by Provider</h3>
            {Object.keys(detoxByProvider).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(detoxByProvider)
                  .sort(([, a], [, b]) => b - a)
                  .map(([provider, count]) => (
                    <div key={provider} className="flex justify-between items-center bg-red-50 px-3 py-2 rounded">
                      <span className="text-gray-700">{provider}</span>
                      <span className="font-semibold text-red-600">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No detox referrals in this period</p>
            )}
          </div>
        </div>
      )}

      {/* Placements by Location */}
      {Object.keys(placementsByLocation).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Placements by Location</h3>
            <span className="ml-3 text-2xl font-bold text-green-600">
              {metrics.placementsMade} total placements
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(placementsByLocation)
              .sort(([, a], [, b]) => b - a)
              .map(([location, count]) => (
                <div key={location} className="bg-green-50 px-4 py-3 rounded-lg">
                  <span className="text-gray-700">{location}</span>
                  <span className="float-right font-bold text-green-600">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Clickable Metrics Grid */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Detailed Metrics</h3>
        <MetricsGrid
          metrics={metrics}
          persons={filteredPersons}
          encounters={filteredEncounters}
          demographics={demographics}
        />
      </div>

      {/* Service Interaction Types */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Service Interaction Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{serviceTypes.caseManagement}</p>
            <p className="text-sm text-gray-600 mt-1">Case Management</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{serviceTypes.harmReduction}</p>
            <p className="text-sm text-gray-600 mt-1">Harm Reduction</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{serviceTypes.matReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">MAT Referrals</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{serviceTypes.detoxReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">Detox Referrals</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{serviceTypes.naloxone}</p>
            <p className="text-sm text-gray-600 mt-1">Naloxone</p>
          </div>
          <div className="text-center p-4 bg-indigo-50 rounded-lg">
            <p className="text-2xl font-bold text-indigo-600">{serviceTypes.transportation}</p>
            <p className="text-sm text-gray-600 mt-1">Transportation</p>
          </div>
          <div className="text-center p-4 bg-teal-50 rounded-lg">
            <p className="text-2xl font-bold text-teal-600">{serviceTypes.showerTrailer}</p>
            <p className="text-sm text-gray-600 mt-1">Shower Trailer</p>
          </div>
        </div>
      </div>

      {/* Program Exits Section */}
      <ProgramExitsSection persons={filteredPersons} />

      {/* Demographics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Gender Distribution</h3>
          <dl className="space-y-2">
            {Object.entries(demographics.byGender)
              .sort(([, a], [, b]) => b - a)
              .map(([gender, count]) => (
                <div key={gender} className="flex justify-between items-center">
                  <dt className="text-gray-600">{gender}</dt>
                  <dd className="font-medium">
                    {count}{' '}
                    <span className="text-gray-400 text-sm">
                      ({Math.round((count / filteredPersons.length) * 100)}%)
                    </span>
                  </dd>
                </div>
              ))}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Race Distribution</h3>
          <dl className="space-y-2">
            {Object.entries(demographics.byRace)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([race, count]) => (
                <div key={race} className="flex justify-between items-center">
                  <dt className="text-gray-600">{race}</dt>
                  <dd className="font-medium">
                    {count}{' '}
                    <span className="text-gray-400 text-sm">
                      ({Math.round((count / filteredPersons.length) * 100)}%)
                    </span>
                  </dd>
                </div>
              ))}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Special Populations</h3>
          <dl className="space-y-3">
            <div className="flex justify-between items-center bg-blue-50 px-4 py-3 rounded-lg">
              <dt className="text-gray-700 font-medium">Veterans</dt>
              <dd className="font-bold text-blue-600 text-xl">{demographics.veterans}</dd>
            </div>
            <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-lg">
              <dt className="text-gray-700 font-medium">Chronically Homeless</dt>
              <dd className="font-bold text-red-600 text-xl">{demographics.chronicallyHomeless}</dd>
            </div>
            <div className="flex justify-between items-center bg-emerald-50 px-4 py-3 rounded-lg">
              <dt className="text-gray-700 font-medium">With Phone Number</dt>
              <dd className="font-bold text-emerald-600 text-xl">{demographics.withPhone}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Contact Activity & Client Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Client Status Overview</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{activeClients}</p>
              <p className="text-sm text-gray-600 mt-1">Active</p>
              <p className="text-xs text-gray-500">Last 90 days</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{inactiveClients}</p>
              <p className="text-sm text-gray-600 mt-1">Inactive</p>
              <p className="text-xs text-gray-500">90+ days</p>
            </div>
            <div className="text-center p-4 bg-teal-50 rounded-lg">
              <p className="text-2xl font-bold text-teal-600">{exitedClients}</p>
              <p className="text-sm text-gray-600 mt-1">Exited</p>
              <p className="text-xs text-gray-500">Program exits</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Contact Activity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{totalContacts.toLocaleString()}</p>
              <p className="text-sm text-gray-600 mt-1">Total Contacts</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">{avgContacts}</p>
              <p className="text-sm text-gray-600 mt-1">Avg per Client</p>
            </div>
          </div>
        </div>
      </div>

      {/* Heat Map */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">
          Service Interaction Heat Map
          {dateRangeText && <span className="text-sm font-normal text-gray-500 ml-2">({locations.length} locations)</span>}
        </h3>
        <EncounterHeatMap key={`map-${initialStartDate}-${initialEndDate}`} locations={locations} />
      </div>

      {/* Recently Contacted & Program Exits Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Recently Contacted Clients
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({recentlyContacted.length})
            </span>
          </h3>
          <div className="max-h-64 overflow-y-auto">
            {recentlyContacted.length > 0 ? (
              <ul className="space-y-2">
                {recentlyContacted
                  .sort((a, b) => {
                    if (!a.last_contact) return 1
                    if (!b.last_contact) return -1
                    return new Date(b.last_contact).getTime() - new Date(a.last_contact).getTime()
                  })
                  .slice(0, 10)
                  .map((person) => (
                    <li key={person.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <Link href={`/client/${person.id}`} className="text-blue-600 hover:underline">
                        {person.first_name} {person.last_name}
                      </Link>
                      <span className="text-sm text-gray-500">
                        {person.last_contact && format(new Date(person.last_contact), 'MMM dd')}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No recent contacts</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-teal-500 rounded-full mr-2"></span>
            Recent Program Exits
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({personsWithExits.length})
            </span>
          </h3>
          <div className="max-h-64 overflow-y-auto">
            {personsWithExits.length > 0 ? (
              <ul className="space-y-2">
                {personsWithExits
                  .sort((a, b) => {
                    if (!a.exit_date) return 1
                    if (!b.exit_date) return -1
                    return new Date(b.exit_date).getTime() - new Date(a.exit_date).getTime()
                  })
                  .slice(0, 10)
                  .map((person) => (
                    <li key={person.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <Link href={`/client/${person.id}`} className="text-blue-600 hover:underline">
                          {person.first_name} {person.last_name}
                        </Link>
                        {person.exit_destination && (
                          <p className="text-xs text-gray-500">{person.exit_destination}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {person.exit_date && format(new Date(person.exit_date), 'MMM dd')}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No program exits in this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Custom Report Builder Toggle */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-indigo-600 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-bold text-gray-900">Custom Report Builder</h3>
          </div>
          <button
            onClick={() => setShowReportBuilder(!showReportBuilder)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {showReportBuilder ? 'Hide Report Builder' : 'Open Report Builder'}
          </button>
        </div>

        {showReportBuilder && (
          <CustomReportBuilder
            persons={allPersons}
            encounters={allEncounters}
            statusChanges={statusChanges}
          />
        )}
      </div>
    </>
  )
}
