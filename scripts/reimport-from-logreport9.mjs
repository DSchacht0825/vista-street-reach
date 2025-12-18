/**
 * Vista Street Reach - Re-import from logreport 9
 *
 * This script:
 * 1. Deletes ALL existing encounters
 * 2. Imports all interactions from logreport (9).xlsx
 * 3. Stores log_id and service_subtype for each encounter
 * 4. Updates person contact counts
 *
 * Usage: node scripts/reimport-from-logreport9.mjs
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

// Known spelling corrections (Excel name -> DB name)
const SPELLING_FIXES = {
  'lauran white': 'lauren white',
}

// Find exact matching person for a log name
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

// Parse Excel serial date to ISO string
function parseExcelDate(value) {
  if (!value) return null

  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    // Excel serial date: days since 1900-01-01 (with Excel's leap year bug)
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString()
  }

  // If it's a string like "7/1/25 7:32 AM"
  if (typeof value === 'string') {
    try {
      const parts = value.split(' ')
      const datePart = parts[0]
      const timePart = parts.slice(1).join(' ')

      const [month, day, year] = datePart.split('/')
      const fullYear = year.length === 2 ? '20' + year : year

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
      console.error('Date parse error:', value, e)
      return null
    }
  }

  return null
}

// Normalize service subtype values
function normalizeSubtype(subType) {
  if (!subType) return null

  // Map variations to standard names
  const subtypeMap = {
    'chronic/ high utilizer': 'Chronic/High Utilizer',
    'chronic/high utilizer': 'Chronic/High Utilizer',
    'no shelter available': 'No Shelter Available',
    'in the process for qualifying for housing': 'In Process for Housing',
    'vital documents (id)': 'Vital Documents',
    'health appointment (mental & physical)': 'Health Appointment',
    'benefits (health/income)': 'Benefits',
    'emergency services (pert, hospital)': 'Emergency Services',
    'basic needs (food, clothes)': 'Basic Needs (Food, Clothes)',
    'street case management': 'Street Case Management',
    'transportation': 'Transportation',
    'phone assistance': 'Phone Assistance',
    'phone assessment': 'Phone Assessment',
    'refused shelter': 'Refused Shelter',
    'refused services': 'Refused Services',
    'referral': 'Referral',
    'bcnc': 'BCNC',
    'shelter': 'Shelter',
    'bridge housing': 'Bridge Housing',
    'relocate': 'Relocate',
    'housed': 'Housed',
    'veteran services': 'Veteran Services',
    'family reunification': 'Family Reunification',
    'animal services': 'Animal Services',
    'aod services': 'AOD Services',
    'return to residence': 'Return to Residence',
  }

  const normalized = subType.toLowerCase().trim()
  return subtypeMap[normalized] || subType.trim()
}

// Map sub type to encounter fields (legacy mapping for backwards compatibility)
function mapSubType(subType) {
  const mapping = {
    'Street Case Management': { case_management: true },
    'Basic Needs (Food, Clothes)': { other_services: 'Food/Clothes provided' },
    'Chronic/High Utilizer': { high_utilizer_contact: true },
    'No Shelter Available': { refused_shelter: false, placement_made: false, shelter_unavailable: true },
    'Transportation': { transportation_provided: true },
    'Phone Assistance': { other_services: 'Phone assistance' },
    'In Process for Housing': { other_services: 'Housing qualification in process' },
    'Refused Shelter': { refused_shelter: true, refused_services: false },
    'Refused Services': { refused_services: true, refused_shelter: false },
    'Referral': { other_services: 'Referral provided' },
    'Vital Documents': { other_services: 'ID/vital documents assistance' },
    'BCNC': { placement_made: true, placement_location: 'BCNC' },
    'Shelter': { placement_made: true },
    'Bridge Housing': { placement_made: true, placement_location: 'Other', placement_location_other: 'Bridge Housing' },
    'Phone Assessment': { other_services: 'Phone assessment' },
    'Relocate': { transportation_provided: true, other_services: 'Relocation assistance' },
    'Housed': { placement_made: true, placement_location: 'Other', placement_location_other: 'Housed' },
    'Benefits': { other_services: 'Benefits assistance' },
    'Emergency Services': { other_services: 'Emergency services' },
    'Health Appointment': { other_services: 'Health appointment', co_occurring_mh_sud: true },
    'Veteran Services': { other_services: 'Veteran services' },
    'Family Reunification': { other_services: 'Family reunification' },
    'Animal Services': { other_services: 'Animal services' },
    'AOD Services': { other_services: 'AOD services' },
    'Return to Residence': { placement_made: true, placement_location: 'Other', placement_location_other: 'Return to residence' },
  }

  return mapping[subType] || {}
}

async function deleteAllEncounters() {
  console.log('Deleting all existing encounters...')

  // Delete in batches to avoid timeout
  let totalDeleted = 0

  while (true) {
    // Fetch a batch of IDs
    const { data: batch, error: fetchError } = await supabase
      .from('encounters')
      .select('id')
      .limit(100)

    if (fetchError) {
      console.error('Error fetching encounters:', fetchError)
      return false
    }

    if (!batch || batch.length === 0) {
      break
    }

    // Delete one at a time to avoid issues
    for (const enc of batch) {
      const { error: deleteError } = await supabase
        .from('encounters')
        .delete()
        .eq('id', enc.id)

      if (deleteError) {
        console.error('Error deleting encounter:', deleteError)
        continue
      }
      totalDeleted++
    }

    if (totalDeleted % 500 === 0) {
      console.log(`Deleted ${totalDeleted} encounters...`)
    }
  }

  console.log(`Total deleted: ${totalDeleted} encounters\n`)
  return true
}

async function importFromLogreport9() {
  console.log('=== Vista Street Reach Re-Import from Logreport 9 ===\n')

  // Step 1: Delete all existing encounters
  const deleted = await deleteAllEncounters()
  if (!deleted) {
    console.error('Failed to delete existing encounters. Aborting.')
    return
  }

  // Step 2: Read the Excel file
  console.log('Reading logreport (9).xlsx...')
  const filePath = join(__dirname, '../public/logreport (9).xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const logs = XLSX.utils.sheet_to_json(worksheet)

  console.log(`Found ${logs.length} log entries\n`)

  // Step 3: Fetch all persons from database
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

  // Step 4: Process and import each log entry
  console.log('Importing interactions...\n')

  const personMap = new Map()
  let imported = 0
  let skipped = 0
  let noMatch = 0
  let errors = 0
  const unmatchedNames = new Set()
  const subtypeCounts = {}

  // Track unique Log IDs to avoid duplicates within the file
  const processedLogIds = new Set()

  for (const log of logs) {
    // Skip logs without People
    if (!log.People) {
      skipped++
      continue
    }

    // Get Log ID
    const logId = log['Log ID']
    if (!logId) {
      console.warn('Log entry without Log ID:', log.Date)
    }

    // Skip if we've already processed this Log ID
    if (logId && processedLogIds.has(logId)) {
      continue
    }
    if (logId) {
      processedLogIds.add(logId)
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
      const serviceDate = parseExcelDate(log.Date)
      if (!serviceDate) {
        errors++
        continue
      }

      // Get and normalize service subtype
      const serviceSubtype = normalizeSubtype(log['Sub Type'])
      if (serviceSubtype) {
        subtypeCounts[serviceSubtype] = (subtypeCounts[serviceSubtype] || 0) + 1
      }

      // Map sub type to legacy fields
      const subTypeFields = mapSubType(serviceSubtype)

      // Create encounter record
      const encounter = {
        person_id: match.dbPerson.id,
        log_id: logId || null,
        service_date: serviceDate,
        service_subtype: serviceSubtype,
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
        shelter_unavailable: subTypeFields.shelter_unavailable || false,
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
  console.log(`Unique Log IDs processed: ${processedLogIds.size}`)
  console.log(`Interactions imported: ${imported}`)
  console.log(`Skipped (no people): ${skipped}`)
  console.log(`No match found: ${noMatch}`)
  console.log(`Errors: ${errors}`)

  console.log('\n=== Service Subtype Counts ===')
  Object.entries(subtypeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })

  if (unmatchedNames.size > 0) {
    console.log(`\n=== Unmatched Names (${unmatchedNames.size}) ===`)
    for (const name of [...unmatchedNames].slice(0, 20)) {
      console.log(` - ${name}`)
    }
    if (unmatchedNames.size > 20) {
      console.log(` ... and ${unmatchedNames.size - 20} more`)
    }
  }

  // Step 5: Update contact counts
  console.log('\nUpdating contact counts...')

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

  const countMap = new Map()
  const lastContactMap = new Map()

  for (const enc of allEncounters) {
    countMap.set(enc.person_id, (countMap.get(enc.person_id) || 0) + 1)
  }

  allEncounters.sort((a, b) => new Date(b.service_date) - new Date(a.service_date))

  for (const enc of allEncounters) {
    if (!lastContactMap.has(enc.person_id)) {
      lastContactMap.set(enc.person_id, enc.service_date.split('T')[0])
    }
  }

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

  // Step 6: Verify November counts
  console.log('\n=== Verifying November 2025 Data ===')
  const { data: novEncounters } = await supabase
    .from('encounters')
    .select('service_subtype, log_id')
    .gte('service_date', '2025-11-01')
    .lt('service_date', '2025-12-01')

  console.log(`November 2025 encounters: ${novEncounters?.length || 0}`)

  const novSubtypes = {}
  let novWithLogId = 0
  novEncounters?.forEach(e => {
    if (e.service_subtype) {
      novSubtypes[e.service_subtype] = (novSubtypes[e.service_subtype] || 0) + 1
    }
    if (e.log_id) novWithLogId++
  })

  console.log(`With log_id: ${novWithLogId}`)
  console.log('\nNovember subtypes:')
  Object.entries(novSubtypes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
}

importFromLogreport9().catch(console.error)
