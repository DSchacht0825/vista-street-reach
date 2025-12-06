'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fuzzySearchPersons } from '@/lib/utils/duplicate-detection'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'

interface Person {
  id: string
  client_id: string
  first_name: string
  middle_name?: string | null
  last_name: string | null
  nickname: string | null
  aka: string | null
  age: number | null
  date_of_birth: string | null
  gender: string | null
  ethnicity: string | null
  last_contact: string | null
  contact_count: number
  exit_date?: string | null
  exit_destination?: string | null
  notes?: string | null
  last_encounter?: {
    service_date: string
    outreach_location: string
  }
}

type TabType = 'active' | 'inactive' | 'exited' | 'all'

// Calculate days since last contact
function getDaysSinceContact(lastContact: string | null): number | null {
  if (!lastContact) return null
  return differenceInDays(new Date(), new Date(lastContact))
}

// Check if person is active (contacted within 90 days)
function isActive(person: Person): boolean {
  if (person.exit_date) return false
  if (!person.last_contact) return false
  const days = getDaysSinceContact(person.last_contact)
  return days !== null && days <= 90
}

// Check if person is inactive (not contacted in 90+ days, not exited)
function isInactive(person: Person): boolean {
  if (person.exit_date) return false
  if (!person.last_contact) return true
  const days = getDaysSinceContact(person.last_contact)
  return days !== null && days > 90
}

export default function ClientSearch() {
  const [searchTerm, setSearchTerm] = useState('')
  const [allPersons, setAllPersons] = useState<Person[]>([])
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('active')

  // Counts for tabs
  const activeCount = allPersons.filter(isActive).length
  const inactiveCount = allPersons.filter(isInactive).length
  const exitedCount = allPersons.filter(p => p.exit_date).length
  const totalCount = allPersons.length

  // Load all persons on component mount
  useEffect(() => {
    loadPersons()
  }, [])

  // Filter persons when search term or tab changes
  useEffect(() => {
    // First apply tab filter
    let baseList: Person[]
    switch (activeTab) {
      case 'active':
        baseList = allPersons.filter(isActive)
        break
      case 'inactive':
        baseList = allPersons.filter(isInactive)
        break
      case 'exited':
        baseList = allPersons.filter(p => p.exit_date)
        break
      case 'all':
      default:
        baseList = allPersons
    }

    if (!searchTerm || searchTerm.trim() === '') {
      // Sort by last_contact descending (most recent first)
      const sorted = [...baseList].sort((a, b) => {
        if (!a.last_contact && !b.last_contact) return 0
        if (!a.last_contact) return 1
        if (!b.last_contact) return -1
        return new Date(b.last_contact).getTime() - new Date(a.last_contact).getTime()
      })
      setFilteredPersons(sorted.slice(0, 50))
      setIsSearching(false)
    } else {
      setIsSearching(true)
      const results = fuzzySearchPersons(searchTerm, baseList)
      setFilteredPersons(results.slice(0, 50))
      setIsSearching(false)
    }
  }, [searchTerm, allPersons, activeTab])

  const loadPersons = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Get all persons with pagination to bypass 1000 row limit
      let allPersonsData: Record<string, unknown>[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('persons')
          .select(`
            id,
            client_id,
            first_name,
            middle_name,
            last_name,
            nickname,
            aka,
            age,
            date_of_birth,
            gender,
            ethnicity,
            last_contact,
            contact_count,
            exit_date,
            exit_destination,
            notes,
            encounters (
              service_date,
              outreach_location
            )
          `)
          .order('last_contact', { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allPersonsData = allPersonsData.concat(data)
        from += pageSize

        // Safety limit
        if (from > 50000) break
      }

      // Type definition for person data with encounters
      type PersonWithEncounters = {
        id: string
        client_id: string
        first_name: string
        middle_name?: string | null
        last_name: string | null
        nickname: string | null
        aka: string | null
        age: number | null
        date_of_birth: string | null
        gender: string | null
        ethnicity: string | null
        last_contact: string | null
        contact_count: number
        exit_date?: string | null
        exit_destination?: string | null
        notes?: string | null
        encounters?: Array<{ service_date: string; outreach_location: string }>
      }

      const persons = allPersonsData as PersonWithEncounters[]

      // Process the data to include only the most recent encounter
      const processedPersons = persons?.map((person) => ({
        ...person,
        last_encounter: person.encounters && person.encounters.length > 0
          ? person.encounters.sort((a, b) =>
              new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
            )[0]
          : undefined,
        encounters: undefined,
      })) || []

      setAllPersons(processedPersons)
      // Default filter will be applied by useEffect
    } catch (error) {
      console.error('Error loading persons:', error)
      alert('Error loading clients. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'active':
        return `Active (${activeCount})`
      case 'inactive':
        return `Inactive 90+ Days (${inactiveCount})`
      case 'exited':
        return `Exited (${exitedCount})`
      case 'all':
        return `All (${totalCount})`
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, AKA, or client ID..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
          autoFocus
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg
              className="h-5 w-5 text-gray-400 hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {(['active', 'inactive', 'exited', 'all'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? tab === 'active'
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : tab === 'inactive'
                  ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                  : tab === 'exited'
                  ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                  : 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Results Count & New Client Link */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          {isLoading
            ? 'Loading...'
            : isSearching
            ? 'Searching...'
            : `Showing ${filteredPersons.length} clients`}
        </span>
        <Link
          href="/client/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Client
        </Link>
      </div>

      {/* Results List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
        </div>
      ) : filteredPersons.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="mt-4 text-gray-600 font-medium">No clients found</p>
          <p className="text-sm text-gray-500 mt-1">
            {searchTerm
              ? 'Try a different search term'
              : activeTab === 'active'
              ? 'No clients have been contacted in the last 90 days'
              : activeTab === 'inactive'
              ? 'No inactive clients'
              : 'Get started by adding a new client'}
          </p>
          <Link
            href="/client/new"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add New Client
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPersons.map((person) => {
            const daysSinceContact = getDaysSinceContact(person.last_contact)
            const displayName = person.aka || person.nickname || ''

            return (
              <Link
                key={person.id}
                href={`/client/${person.id}`}
                className={`block border rounded-lg p-4 hover:shadow-md transition-all ${
                  person.exit_date
                    ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                    : isInactive(person)
                    ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'
                    : 'bg-white border-gray-200 hover:border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {person.first_name}
                        {person.middle_name && ` ${person.middle_name}`}
                        {person.last_name && ` ${person.last_name}`}
                      </h3>
                      {displayName && (
                        <span className="text-sm text-gray-600 font-normal">
                          (aka {displayName})
                        </span>
                      )}
                      {person.exit_date && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
                          Exited
                        </span>
                      )}
                      {!person.exit_date && isInactive(person) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800">
                          Inactive {daysSinceContact}+ days
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">ID:</span> {person.client_id}
                        {person.age && (
                          <> | <span className="font-medium">Age:</span> {person.age}</>
                        )}
                        {person.gender && (
                          <> | <span className="font-medium">Gender:</span> {person.gender}</>
                        )}
                        {person.ethnicity && (
                          <> | <span className="font-medium">Ethnicity:</span> {person.ethnicity}</>
                        )}
                      </p>
                      {person.exit_date ? (
                        <p className="text-amber-700">
                          <span className="font-medium">Exited:</span>{' '}
                          {format(new Date(person.exit_date), 'MM/dd/yyyy')}
                          {person.exit_destination && (
                            <span> - {person.exit_destination}</span>
                          )}
                        </p>
                      ) : person.last_contact ? (
                        <p className={isInactive(person) ? 'text-yellow-700' : 'text-green-700'}>
                          <span className="font-medium">Last Contact:</span>{' '}
                          {format(new Date(person.last_contact), 'MM/dd/yyyy')}
                          {daysSinceContact !== null && (
                            <span className="text-gray-500"> ({daysSinceContact} days ago)</span>
                          )}
                          {person.contact_count > 0 && (
                            <span className="ml-2">
                              | <span className="font-medium">Total Contacts:</span> {person.contact_count}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-gray-500 italic">Never contacted</p>
                      )}
                      {person.notes && (
                        <p className="text-gray-500 truncate max-w-lg">
                          <span className="font-medium">Notes:</span> {person.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.exit_date && (
                      <span className="text-xs text-amber-600 font-medium">
                        Click to reactivate
                      </span>
                    )}
                    {isInactive(person) && !person.exit_date && (
                      <span className="text-xs text-yellow-600 font-medium">
                        Make contact
                      </span>
                    )}
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
