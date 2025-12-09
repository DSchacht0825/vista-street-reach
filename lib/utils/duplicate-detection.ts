import { createClient } from '@/lib/supabase/client'
import Fuse from 'fuse.js'

export interface SimilarPerson {
  id: string
  client_id: string
  first_name: string
  last_name: string
  nickname: string | null
  date_of_birth: string
  similarity_score: number
  last_encounter_date: string | null
}

export interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean
  similarPersons: SimilarPerson[]
}

/**
 * Check for potential duplicate persons using fuzzy matching
 * @param firstName - First name to search for
 * @param lastName - Last name to search for
 * @param dateOfBirth - Optional date of birth for exact match
 * @param threshold - Similarity threshold (0-1, default 0.3)
 * @returns Promise with duplicate check results
 */
export async function checkForDuplicates(
  firstName: string,
  lastName: string,
  dateOfBirth?: string,
  threshold: number = 0.3
): Promise<DuplicateCheckResult> {
  const supabase = createClient()

  try {
    // Fetch all persons and do client-side fuzzy matching
    // This is more reliable than RPC and handles missing functions
    let allPersons: Array<{
      id: string
      client_id: string
      first_name: string
      last_name: string | null
      nickname: string | null
      date_of_birth: string | null
      last_contact: string | null
    }> = []

    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('persons')
        .select('id, client_id, first_name, last_name, nickname, date_of_birth, last_contact')
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Error fetching persons:', error)
        break
      }

      if (!data || data.length === 0) break
      allPersons = allPersons.concat(data)
      from += pageSize

      if (from > 50000) break
    }

    // Find similar persons using fuzzy matching
    const similarPersons: SimilarPerson[] = []

    for (const person of allPersons) {
      const firstNameSim = calculateSimilarity(firstName.toLowerCase(), person.first_name.toLowerCase())
      const lastNameSim = calculateSimilarity(lastName.toLowerCase(), (person.last_name || '').toLowerCase())
      const avgSimilarity = (firstNameSim + lastNameSim) / 2

      // Check for match: high name similarity OR same DOB with moderate similarity
      // Raised threshold from 0.7 to 0.85 to reduce false positives (e.g., Steven/Stanley)
      const hasSameDOB = dateOfBirth && person.date_of_birth && dateOfBirth === person.date_of_birth
      const isMatch = avgSimilarity > 0.85 || (hasSameDOB && avgSimilarity > 0.6)

      if (isMatch) {
        similarPersons.push({
          id: person.id,
          client_id: person.client_id,
          first_name: person.first_name,
          last_name: person.last_name || '',
          nickname: person.nickname,
          date_of_birth: person.date_of_birth || '',
          similarity_score: avgSimilarity,
          last_encounter_date: person.last_contact,
        })
      }
    }

    // Sort by similarity score descending
    similarPersons.sort((a, b) => b.similarity_score - a.similarity_score)

    return {
      hasPotentialDuplicates: similarPersons.length > 0,
      similarPersons: similarPersons.slice(0, 5), // Return top 5 matches
    }
  } catch (error) {
    console.error('Exception checking for duplicates:', error)
    return {
      hasPotentialDuplicates: false,
      similarPersons: [],
    }
  }
}

/**
 * Client-side fuzzy search for real-time search as user types
 * @param searchTerm - The search term
 * @param persons - Array of persons to search through
 * @returns Filtered and sorted array of persons
 */
export function fuzzySearchPersons<T extends {
  id: string
  client_id: string
  first_name: string
  last_name?: string | null
  nickname?: string | null
  aka?: string | null
  date_of_birth?: string | null
}>(
  searchTerm: string,
  persons: T[]
): T[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return persons
  }

  const fuse = new Fuse(persons, {
    keys: [
      { name: 'first_name', weight: 0.4 },
      { name: 'last_name', weight: 0.4 },
      { name: 'nickname', weight: 0.3 },
      { name: 'aka', weight: 0.3 },
      { name: 'client_id', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  })

  const results = fuse.search(searchTerm)
  return results.map((result) => result.item)
}

/**
 * Calculate similarity score between two strings
 * Simple implementation of Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue
    }
  }

  const maxLength = Math.max(s1.length, s2.length)
  return maxLength === 0 ? 1 : 1 - costs[s2.length] / maxLength
}
