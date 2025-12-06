'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DuplicateManager from './DuplicateManager'

interface Person {
  id: string
  client_id: string
  first_name: string
  last_name: string
  nickname?: string | null
  aka?: string | null
  date_of_birth?: string | null
  age?: number | null
  gender?: string | null
  race?: string | null
  ethnicity?: string | null
  hair_color?: string | null
  eye_color?: string | null
  height?: string | null
  weight?: string | null
  living_situation?: string | null
  veteran_status?: boolean
  chronic_homeless?: boolean
  enrollment_date?: string | null
  case_manager?: string | null
  last_contact?: string | null
  contact_count?: number | null
}

export default function DuplicateManagerWrapper() {
  const [persons, setPersons] = useState<Person[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPersons()
  }, [])

  const loadPersons = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Fetch all persons with pagination
      let allPersonsData: Record<string, unknown>[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('persons')
          .select('id, client_id, first_name, last_name, nickname, aka, date_of_birth, age, gender, race, ethnicity, hair_color, eye_color, height, weight, living_situation, veteran_status, chronic_homeless, enrollment_date, case_manager, last_contact, contact_count')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error loading persons:', error)
          break
        }

        if (!data || data.length === 0) break
        allPersonsData = allPersonsData.concat(data)
        from += pageSize

        if (from > 50000) break
      }

      // Filter to only include persons with required fields for duplicate detection
      const validPersons = (allPersonsData as unknown as Person[]).filter(p =>
        p.first_name && p.last_name
      )

      setPersons(validPersons)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-lg p-6 border-2 border-orange-200">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mr-3"></div>
          <span className="text-gray-600">Loading duplicate scanner...</span>
        </div>
      </div>
    )
  }

  return <DuplicateManager persons={persons} />
}
