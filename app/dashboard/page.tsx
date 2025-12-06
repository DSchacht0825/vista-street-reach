import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all persons
  const { data: persons, error: personsError } = await supabase
    .from('persons')
    .select('*')

  if (personsError) {
    console.error('Dashboard data fetch error:', personsError)
  }

  // Type assertion for Vista-specific person data
  type PersonData = {
    id: string
    first_name: string
    middle_name?: string | null
    last_name?: string | null
    nickname?: string | null
    aka?: string | null
    gender?: string | null
    ethnicity?: string | null
    age?: number | null
    height?: string | null
    weight?: string | null
    hair_color?: string | null
    eye_color?: string | null
    physical_description?: string | null
    notes?: string | null
    last_contact?: string | null
    contact_count?: number | null
    enrollment_date: string
    veteran_status: boolean
    chronic_homeless: boolean
  }

  const allPersons = (persons || []) as PersonData[]

  // Calculate 90-day cutoff for active status
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0]

  // Separate active and inactive clients
  const activeClients = allPersons.filter(p => p.last_contact && p.last_contact >= cutoffDate)
  const inactiveClients = allPersons.filter(p => !p.last_contact || p.last_contact < cutoffDate)

  // Calculate total contacts
  const totalContacts = allPersons.reduce((sum, p) => sum + (p.contact_count || 0), 0)

  // Demographics breakdown
  const demographics = {
    byGender: allPersons.reduce((acc, p) => {
      const gender = p.gender || 'Unknown'
      acc[gender] = (acc[gender] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byEthnicity: allPersons.reduce((acc, p) => {
      const ethnicity = p.ethnicity || 'Unknown'
      acc[ethnicity] = (acc[ethnicity] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byHairColor: allPersons.reduce((acc, p) => {
      if (p.hair_color) {
        acc[p.hair_color] = (acc[p.hair_color] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>),
    veterans: allPersons.filter(p => p.veteran_status).length,
    chronicallyHomeless: allPersons.filter(p => p.chronic_homeless).length,
    withNotes: allPersons.filter(p => p.notes).length,
  }

  // Age breakdown
  const ageGroups = allPersons.reduce((acc, p) => {
    if (!p.age) {
      acc['Unknown'] = (acc['Unknown'] || 0) + 1
    } else if (p.age < 25) {
      acc['Under 25'] = (acc['Under 25'] || 0) + 1
    } else if (p.age < 35) {
      acc['25-34'] = (acc['25-34'] || 0) + 1
    } else if (p.age < 45) {
      acc['35-44'] = (acc['35-44'] || 0) + 1
    } else if (p.age < 55) {
      acc['45-54'] = (acc['45-54'] || 0) + 1
    } else if (p.age < 65) {
      acc['55-64'] = (acc['55-64'] || 0) + 1
    } else {
      acc['65+'] = (acc['65+'] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // Recently contacted (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDayCutoff = thirtyDaysAgo.toISOString().split('T')[0]
  const recentlyContacted = allPersons.filter(p => p.last_contact && p.last_contact >= thirtyDayCutoff)

  // Never contacted
  const neverContacted = allPersons.filter(p => !p.last_contact || p.contact_count === 0)

  // Average contacts per client
  const avgContacts = allPersons.length > 0
    ? Math.round(totalContacts / allPersons.length * 10) / 10
    : 0

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

        {/* Key Metrics Summary */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
          <div className="flex items-center mb-4">
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
              Program Summary
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-sm text-gray-600 font-medium">Total Clients</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{allPersons.length}</p>
              <p className="text-xs text-gray-500 mt-1">In the system</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-sm text-gray-600 font-medium">Active Clients</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{activeClients.length}</p>
              <p className="text-xs text-gray-500 mt-1">Contacted in last 90 days</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-sm text-gray-600 font-medium">Inactive Clients</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{inactiveClients.length}</p>
              <p className="text-xs text-gray-500 mt-1">No contact in 90+ days</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <p className="text-sm text-gray-600 font-medium">Total Contacts</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{totalContacts.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">All-time interactions</p>
            </div>
          </div>
        </div>

        {/* Contact Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Activity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {recentlyContacted.length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Contacted Last 30 Days</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {neverContacted.length}
                </p>
                <p className="text-sm text-gray-600 mt-1">Never Contacted</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {avgContacts}
                </p>
                <p className="text-sm text-gray-600 mt-1">Avg Contacts/Client</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">
                  {demographics.withNotes}
                </p>
                <p className="text-sm text-gray-600 mt-1">Clients with Notes</p>
              </div>
            </div>
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
            </dl>
          </div>
        </div>

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
                    <dd className="font-medium">{count} <span className="text-gray-400 text-sm">({Math.round(count / allPersons.length * 100)}%)</span></dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Ethnicity Distribution</h3>
            <dl className="space-y-2">
              {Object.entries(demographics.byEthnicity)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([ethnicity, count]) => (
                  <div key={ethnicity} className="flex justify-between items-center">
                    <dt className="text-gray-600">{ethnicity}</dt>
                    <dd className="font-medium">{count} <span className="text-gray-400 text-sm">({Math.round(count / allPersons.length * 100)}%)</span></dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Age Distribution</h3>
            <dl className="space-y-2">
              {['Under 25', '25-34', '35-44', '45-54', '55-64', '65+', 'Unknown']
                .filter(group => ageGroups[group])
                .map((group) => (
                  <div key={group} className="flex justify-between items-center">
                    <dt className="text-gray-600">{group}</dt>
                    <dd className="font-medium">{ageGroups[group]} <span className="text-gray-400 text-sm">({Math.round((ageGroups[group] || 0) / allPersons.length * 100)}%)</span></dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>

        {/* Hair Color Distribution */}
        {Object.keys(demographics.byHairColor).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Hair Color Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(demographics.byHairColor)
                .sort(([, a], [, b]) => b - a)
                .map(([color, count]) => (
                  <div key={color} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-700">{count}</p>
                    <p className="text-sm text-gray-600">{color}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Active/Inactive Client Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recently Active */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Recently Active Clients
              <span className="ml-2 text-sm font-normal text-gray-500">({recentlyContacted.length})</span>
            </h3>
            <div className="max-h-64 overflow-y-auto">
              {recentlyContacted.length > 0 ? (
                <ul className="space-y-2">
                  {recentlyContacted
                    .sort((a, b) => new Date(b.last_contact!).getTime() - new Date(a.last_contact!).getTime())
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

          {/* Needs Outreach */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
              Needs Outreach (Inactive 90+ days)
              <span className="ml-2 text-sm font-normal text-gray-500">({inactiveClients.length})</span>
            </h3>
            <div className="max-h-64 overflow-y-auto">
              {inactiveClients.length > 0 ? (
                <ul className="space-y-2">
                  {inactiveClients
                    .sort((a, b) => {
                      if (!a.last_contact) return -1
                      if (!b.last_contact) return 1
                      return new Date(a.last_contact).getTime() - new Date(b.last_contact).getTime()
                    })
                    .slice(0, 10)
                    .map((person) => (
                      <li key={person.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                        <Link href={`/client/${person.id}`} className="text-blue-600 hover:underline">
                          {person.first_name} {person.last_name}
                        </Link>
                        <span className="text-sm text-gray-500">
                          {person.last_contact
                            ? format(new Date(person.last_contact), 'MMM dd, yyyy')
                            : 'Never'}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">All clients are active</p>
              )}
            </div>
          </div>
        </div>

        {/* Data Export */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Data Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{allPersons.length}</p>
              <p className="text-sm text-gray-600">Total Clients</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{totalContacts.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Contacts</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">
                {Math.round(activeClients.length / allPersons.length * 100)}%
              </p>
              <p className="text-sm text-gray-600">Active Rate</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{avgContacts}</p>
              <p className="text-sm text-gray-600">Avg Contacts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
