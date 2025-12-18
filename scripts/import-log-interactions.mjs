/**
 * Vista Street Reach Log Interactions Import Script
 *
 * Imports service interactions from logreport-2.xls and matches them to persons in the database
 *
 * Usage: node scripts/import-log-interactions.mjs
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Normalize string for comparison
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')
}

// Get full name from person record
function getFullName(p) {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// Known spelling corrections (Excel name -> DB name)
const SPELLING_FIXES = {
  'lauran white': 'lauren white',
}

// Find exact matching person for a log name (no fuzzy matching)
function findExactMatch(logName, dbPersons) {
  let normalizedLogName = normalize(logName)

  // Apply spelling fixes
  if (SPELLING_FIXES[normalizedLogName]) {
    normalizedLogName = SPELLING_FIXES[normalizedLogName]
  }

  const logParts = normalizedLogName.split(' ').filter(Boolean)

  for (const dbPerson of dbPersons) {
    const fullName = normalize(getFullName(dbPerson))
    const firstName = normalize(dbPerson.first_name)
    const lastName = normalize(dbPerson.last_name || '')
    const aka = normalize(dbPerson.aka || '')
    const nickname = normalize(dbPerson.nickname || '')

    // Exact full name match (with middle name)
    if (fullName === normalizedLogName) {
      return { dbPerson, matchType: 'exact_full' }
    }

    // First + Last matches log name (handles middle name in DB but not in Excel)
    if (firstName && lastName && (firstName + ' ' + lastName) === normalizedLogName) {
      return { dbPerson, matchType: 'first_last' }
    }

    // Log has 2 parts that match first and last name
    if (logParts.length === 2 && firstName === logParts[0] && lastName === logParts[1]) {
      return { dbPerson, matchType: 'first_last_parts' }
    }

    // AKA or nickname exact match
    if (aka === normalizedLogName || nickname === normalizedLogName) {
      return { dbPerson, matchType: 'aka_nickname' }
    }

    // First name only match (if log has one part and DB has only first name)
    if (logParts.length === 1 && firstName === logParts[0] && !lastName) {
      return { dbPerson, matchType: 'first_only' }
    }
  }

  return null
}

// Parse date string from Excel
function parseDate(dateStr) {
  if (!dateStr) return null

  // Excel date format: "7/1/25 7:32 AM" or similar
  try {
    // Handle different formats
    const parts = dateStr.split(' ')
    const datePart = parts[0]
    const timePart = parts.slice(1).join(' ')

    const [month, day, year] = datePart.split('/')
    const fullYear = year.length === 2 ? '20' + year : year

    // Parse time
    let hours = 0, minutes = 0
    if (timePart) {
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)?/i)
      if (timeMatch) {
        hours = parseInt(timeMatch[1])
        minutes = parseInt(timeMatch[2])
        const ampm = timeMatch[3]
        if (ampm && ampm.toUpperCase() === 'PM' && hours !== 12) {
          hours += 12
        } else if (ampm && ampm.toUpperCase() === 'AM' && hours === 12) {
          hours = 0
        }
      }
    }

    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), hours, minutes)
    return date.toISOString()
  } catch (e) {
    console.error('Date parse error:', dateStr, e)
    return null
  }
}

// Map sub type to encounter fields
function mapSubType(subType) {
  const mapping = {
    'Street Case Management': { case_management: true },
    'Basic Needs (Food, Clothes)': { other_services: 'Food/Clothes provided' },
    'Chronic/ High Utilizer': { high_utilizer_contact: true },
    'No Shelter available': { refused_shelter: false, placement_made: false },
    'Transportation': { transportation_provided: true },
    'Phone Assistance': { other_services: 'Phone assistance' },
    'In the process for qualifying for housing': { other_services: 'Housing qualification in process' },
    'Refused Shelter': { refused_shelter: true, refused_services: false },
    'Referral': { other_services: 'Referral provided' },
    'Vital Documents (ID)': { other_services: 'ID/vital documents assistance' },
    'BCNC': { placement_made: true, placement_location: 'BCNC' },
    'Shelter': { placement_made: true },
    'Refused Services': { refused_services: true, refused_shelter: false },
    'Bridge Housing': { placement_made: true, placement_location: 'Other', placement_location_other: 'Bridge Housing' },
    'Phone Assessment': { other_services: 'Phone assessment' },
    'Relocate': { transportation_provided: true, other_services: 'Relocation assistance' },
    'Housed': { placement_made: true, placement_location: 'Other', placement_location_other: 'Housed' },
    'Benefits (health/Income)': { other_services: 'Benefits assistance' },
    'Emergency Services (PERT, Hospital)': { other_services: 'Emergency services' },
    'Health Appointment (Mental & Physical)': { other_services: 'Health appointment', co_occurring_mh_sud: true },
    'Veteran Services': { other_services: 'Veteran services' },
    'Family Reunification': { other_services: 'Family reunification' },
    'Animal services': { other_services: 'Animal services' },
    'AOD Services': { other_services: 'AOD services' },
    'Return to Residence': { placement_made: true, placement_location: 'Other', placement_location_other: 'Return to residence' },
  }

  return mapping[subType] || {}
}

async function importInteractions() {
  console.log('Starting Vista Street Reach interactions import...\n')

  // Read the Excel file
  const filePath = join(__dirname, '../public/logreport-2.xls')
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const logs = XLSX.utils.sheet_to_json(worksheet)

  console.log(`Found ${logs.length} log entries\n`)

  // Fetch all persons from database
  console.log('Fetching persons from database...')
  let allPersons = []
  let from = 0
  const batchSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('persons')
      .select('id, first_name, middle_name, last_name, aka, nickname')
      .range(from, from + batchSize - 1)

    if (error) {
      console.error('Error fetching persons:', error)
      return
    }

    allPersons = allPersons.concat(data)
    if (data.length < batchSize) break
    from += batchSize
  }

  console.log(`Found ${allPersons.length} persons in database\n`)

  // Build person lookup map
  const personMap = new Map()

  // Track stats
  let imported = 0
  let skipped = 0
  let noMatch = 0
  let errors = 0
  const unmatchedNames = new Set()

  // Process each log entry
  for (const log of logs) {
    // Skip logs without People
    if (!log.People) {
      skipped++
      continue
    }

    // People field can have multiple people separated by comma or pipe
    const peopleNames = log.People.split(/[,|]/).map(n => n.trim()).filter(Boolean)

    for (const personName of peopleNames) {
      // Find or lookup match
      let match = personMap.get(personName.toLowerCase())

      if (!match) {
        match = findExactMatch(personName, allPersons)
        if (match) {
          personMap.set(personName.toLowerCase(), match)
        }
      }

      if (!match) {
        unmatchedNames.add(personName)
        noMatch++
        continue
      }

      // Parse the date
      const serviceDate = parseDate(log.Date)
      if (!serviceDate) {
        errors++
        continue
      }

      // Map sub type to fields
      const subTypeFields = mapSubType(log['Sub Type'])

      // Create encounter record
      const encounter = {
        person_id: match.dbPerson.id,
        service_date: serviceDate,
        outreach_location: log.Location || 'Vista',
        latitude: log.Latitude || 0,
        longitude: log.Longitude || 0,
        outreach_worker: log.User || 'Unknown',
        case_management_notes: log.Notes || null,
        co_occurring_mh_sud: subTypeFields.co_occurring_mh_sud || false,
        transportation_provided: subTypeFields.transportation_provided || false,
        shower_trailer: false,
        other_services: subTypeFields.other_services || null,
        placement_made: subTypeFields.placement_made || false,
        placement_location: subTypeFields.placement_location || null,
        placement_location_other: subTypeFields.placement_location_other || null,
        refused_shelter: subTypeFields.refused_shelter || false,
        refused_services: subTypeFields.refused_services || false,
        high_utilizer_contact: subTypeFields.high_utilizer_contact || false,
      }

      try {
        const { error: insertError } = await supabase
          .from('encounters')
          .insert(encounter)

        if (insertError) {
          console.error(`Error inserting encounter for ${personName}:`, insertError.message)
          errors++
        } else {
          imported++
          if (imported % 500 === 0) {
            console.log(`Imported ${imported} interactions...`)
          }
        }
      } catch (err) {
        console.error(`Error processing ${personName}:`, err)
        errors++
      }
    }
  }

  console.log('\n=== Import Complete ===')
  console.log(`Total log entries: ${logs.length}`)
  console.log(`Interactions imported: ${imported}`)
  console.log(`Skipped (no people): ${skipped}`)
  console.log(`No match found: ${noMatch}`)
  console.log(`Errors: ${errors}`)

  if (unmatchedNames.size > 0) {
    console.log('\n=== Unmatched Names ===')
    for (const name of unmatchedNames) {
      console.log(` - ${name}`)
    }
  }

  // Update contact counts for all persons
  console.log('\nUpdating contact counts...')

  // Fetch ALL encounters (handle Supabase 1000 row limit)
  let allEncounters = []
  let encFrom = 0
  while (true) {
    const { data: batch } = await supabase
      .from('encounters')
      .select('person_id, service_date')
      .range(encFrom, encFrom + 999)
    if (!batch || batch.length === 0) break
    allEncounters = allEncounters.concat(batch)
    encFrom += 1000
  }

  console.log(`Fetched ${allEncounters.length} encounters for contact count update`)

  // Count encounters per person
  const countMap = new Map()
  const lastContactMap = new Map()

  for (const enc of allEncounters) {
    countMap.set(enc.person_id, (countMap.get(enc.person_id) || 0) + 1)
  }

  // Sort by service_date descending to get last contact
  allEncounters.sort((a, b) => new Date(b.service_date) - new Date(a.service_date))

  for (const enc of allEncounters) {
    if (!lastContactMap.has(enc.person_id)) {
      lastContactMap.set(enc.person_id, enc.service_date.split('T')[0])
    }
  }

  // Update each person
  let updated = 0
  for (const [personId, count] of countMap) {
    const lastContact = lastContactMap.get(personId)

    const { error: updateError } = await supabase
      .from('persons')
      .update({
        contact_count: count,
        last_contact: lastContact
      })
      .eq('id', personId)

    if (!updateError) {
      updated++
    }
  }

  console.log(`Updated contact counts for ${updated} persons`)
}

importInteractions().catch(console.error)
