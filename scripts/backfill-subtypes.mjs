/**
 * Backfill service_subtype from original Excel data
 *
 * This script reads the original logreport-2.xls and updates encounters
 * with the correct service_subtype value.
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Normalize string for comparison
function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')
}

// Parse date from Excel format to ISO string
function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    const parts = dateStr.split(' ')
    const datePart = parts[0]
    const [month, day, year] = datePart.split('/')
    const fullYear = year.length === 2 ? '20' + year : year
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  } catch (e) {
    return null
  }
}

async function backfillSubtypes() {
  console.log('Starting service_subtype backfill...\n')

  // Read the Excel file
  const workbook = XLSX.readFile('public/logreport-2.xls')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const logs = XLSX.utils.sheet_to_json(sheet)

  console.log(`Found ${logs.length} log entries in Excel\n`)

  // Fetch all persons for name matching
  let allPersons = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('persons')
      .select('id, first_name, middle_name, last_name, aka, nickname')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    allPersons = allPersons.concat(data)
    from += 1000
  }
  console.log(`Found ${allPersons.length} persons in database\n`)

  // Build a map of normalized name -> person id
  const nameToPersonId = new Map()
  allPersons.forEach(p => {
    const fullName = normalize([p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '))
    const firstLast = normalize([p.first_name, p.last_name].filter(Boolean).join(' '))
    nameToPersonId.set(fullName, p.id)
    nameToPersonId.set(firstLast, p.id)
    if (p.nickname) nameToPersonId.set(normalize(p.nickname), p.id)
    if (p.aka) nameToPersonId.set(normalize(p.aka), p.id)
  })

  // Fetch all encounters
  let allEncounters = []
  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('encounters')
      .select('id, person_id, service_date, outreach_location, outreach_worker')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    allEncounters = allEncounters.concat(data)
    from += 1000
  }
  console.log(`Found ${allEncounters.length} encounters in database\n`)

  // Create a map to match encounters: person_id + date + worker -> encounter id
  const encounterMap = new Map()
  allEncounters.forEach(e => {
    const dateStr = e.service_date.split('T')[0]
    const key = `${e.person_id}|${dateStr}|${normalize(e.outreach_worker)}`
    if (!encounterMap.has(key)) {
      encounterMap.set(key, e.id)
    }
  })

  // Process each log entry and update encounters
  let updated = 0
  let notFound = 0
  let noSubtype = 0

  for (const log of logs) {
    if (!log.People || !log['Sub Type']) {
      noSubtype++
      continue
    }

    const subType = log['Sub Type']
    const dateStr = parseDate(log.Date)
    const worker = normalize(log.User || '')

    // Handle multiple people in one log entry
    const peopleNames = log.People.split(/[,|]/).map(n => n.trim()).filter(Boolean)

    for (const personName of peopleNames) {
      const normalizedName = normalize(personName)
      const personId = nameToPersonId.get(normalizedName)

      if (!personId) {
        notFound++
        continue
      }

      // Find matching encounter
      const key = `${personId}|${dateStr}|${worker}`
      const encounterId = encounterMap.get(key)

      if (!encounterId) {
        // Try without worker match
        const keyNoWorker = `${personId}|${dateStr}`
        for (const [k, v] of encounterMap) {
          if (k.startsWith(keyNoWorker)) {
            // Update this encounter
            const { error } = await supabase
              .from('encounters')
              .update({ service_subtype: subType })
              .eq('id', v)

            if (!error) {
              updated++
              if (updated % 500 === 0) {
                console.log(`Updated ${updated} encounters...`)
              }
            }
            break
          }
        }
      } else {
        // Update encounter with subtype
        const { error } = await supabase
          .from('encounters')
          .update({ service_subtype: subType })
          .eq('id', encounterId)

        if (!error) {
          updated++
          if (updated % 500 === 0) {
            console.log(`Updated ${updated} encounters...`)
          }
        }
      }
    }
  }

  console.log('\n=== Backfill Complete ===')
  console.log(`Updated: ${updated} encounters`)
  console.log(`Not found: ${notFound} (person not matched)`)
  console.log(`No subtype: ${noSubtype} (missing data)`)

  // Verify Nov 2025 counts
  console.log('\n=== Verifying Nov 2025 ===')
  const { data: novEncounters } = await supabase
    .from('encounters')
    .select('service_subtype')
    .gte('service_date', '2025-11-01')
    .lt('service_date', '2025-12-01')
    .not('service_subtype', 'is', null)

  const subtypeCounts = {}
  novEncounters?.forEach(e => {
    subtypeCounts[e.service_subtype] = (subtypeCounts[e.service_subtype] || 0) + 1
  })

  console.log('Service subtypes after backfill:')
  Object.entries(subtypeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
}

backfillSubtypes().catch(console.error)
