import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditIntakeForm from '@/components/EditIntakeForm'

export default async function EditIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch person details
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const person = data as {
    id: string
    first_name: string
    middle_name?: string | null
    last_name?: string | null
    nickname?: string | null
    aka?: string | null
    photo_url?: string | null
    date_of_birth?: string | null
    age?: number | null
    gender?: string | null
    race?: string | null
    ethnicity?: string | null
    sexual_orientation?: string | null
    height?: string | null
    weight?: string | null
    hair_color?: string | null
    eye_color?: string | null
    notes?: string | null
    phone_number?: string | null
    living_situation?: string | null
    length_of_time_homeless?: string | null
    veteran_status: boolean
    disability_status: boolean
    disability_type?: string | null
    chronic_homeless: boolean
    domestic_violence_victim: boolean
    chronic_health: boolean
    mental_health: boolean
    addictions?: string[] | null
    evictions?: number | null
    income?: string | null
    income_amount?: number | null
    support_system?: string | null
    enrollment_date: string
    case_manager?: string | null
    referral_source?: string | null
    release_of_information: boolean
    preferred_language?: string | null
  }

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
            className="text-blue-700 hover:text-blue-800 font-medium mb-3 inline-flex items-center text-sm"
          >
            <svg
              className="w-4 h-4 mr-1"
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
            Back to Profile
          </Link>

          <h2 className="text-2xl font-bold text-gray-900 mt-2">
            Edit Intake: {person.first_name} {person.last_name}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Update client intake information
          </p>
        </div>

        {/* Edit Form */}
        <EditIntakeForm person={person} />
      </div>
    </div>
  )
}
