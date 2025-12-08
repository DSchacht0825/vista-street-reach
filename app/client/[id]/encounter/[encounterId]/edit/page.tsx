import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import EditServiceInteractionForm from '@/components/EditServiceInteractionForm'

export default async function EditEncounterPage({
  params,
}: {
  params: Promise<{ id: string; encounterId: string }>
}) {
  const { id, encounterId } = await params
  const supabase = await createClient()

  // Fetch person details
  const { data: personData, error: personError } = await supabase
    .from('persons')
    .select('id, first_name, last_name, nickname')
    .eq('id', id)
    .single()

  if (personError || !personData) {
    notFound()
  }

  // Fetch encounter details
  const { data: encounterData, error: encounterError } = await supabase
    .from('encounters')
    .select('*')
    .eq('id', encounterId)
    .eq('person_id', id)
    .single()

  if (encounterError || !encounterData) {
    notFound()
  }

  const person = personData as {
    id: string
    first_name: string
    last_name: string | null
    nickname: string | null
  }

  const encounter = encounterData as {
    id: string
    person_id: string
    service_date: string
    outreach_location: string
    latitude: number
    longitude: number
    outreach_worker: string
    referral_source: string | null
    language_preference: string | null
    cultural_notes: string | null
    co_occurring_mh_sud: boolean
    co_occurring_type: string | null
    transportation_provided: boolean
    shower_trailer: boolean
    support_services: string[] | null
    other_services: string | null
    placement_made: boolean
    placement_location: string | null
    placement_location_other: string | null
    placement_detox_name: string | null
    refused_shelter: boolean
    shelter_unavailable: boolean
    high_utilizer_contact: boolean
    case_management_notes: string | null
  }

  const personName = `${person.first_name} ${person.last_name || ''}`.trim()

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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/client/${id}`}
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
            Back to {personName}&apos;s Profile
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-4">
            Edit Service Interaction
          </h2>
          <p className="text-gray-600 mt-1">
            Editing interaction for {personName}
          </p>
        </div>

        {/* Form */}
        <EditServiceInteractionForm
          personId={id}
          personName={personName}
          encounter={encounter}
        />
      </div>
    </div>
  )
}
