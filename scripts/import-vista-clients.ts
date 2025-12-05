/**
 * Vista Street Reach Client Import Script
 *
 * This script imports clients from the Excel file (All_People_97_20251205.xls)
 * into the Supabase database.
 *
 * Usage: npx ts-node scripts/import-vista-clients.ts
 *
 * Make sure to set your Supabase credentials in .env.local
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ExcelRow {
  'First Name': string
  'Middle': string | null
  'Last Name': string | null
  'AKA': string | null
  'Gender': string | null
  'Ethnicity': string | null
  'Age': string | number | null
  'Height': number | null
  'Weight': string | null
  'Hair': string | null
  'Eyes': number | null
  'Description': number | null
  'Notes': string | null
  'Last Contact': string | null
  'Contacts': number
  'Date Created': string
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === 'Never') return null

  // Try parsing as Excel date or string
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

function parseAge(age: string | number | null): number | null {
  if (age === null || age === undefined) return null
  const parsed = typeof age === 'string' ? parseInt(age, 10) : age
  return isNaN(parsed) ? null : parsed
}

async function importClients() {
  console.log('Starting Vista Street Reach client import...\n')

  // Read the Excel file
  const filePath = path.join(__dirname, '../public/All_People_97_20251205.xls')
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

  console.log(`Found ${data.length} clients to import\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

  // Calculate date 90 days ago for active status
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  for (const row of data) {
    try {
      // Skip rows without a first name
      if (!row['First Name'] || row['First Name'].toString().trim() === '') {
        skipped++
        continue
      }

      const firstName = row['First Name'].toString().trim()
      const lastContact = parseDate(row['Last Contact'])
      const dateCreated = parseDate(row['Date Created'])
      const age = parseAge(row['Age'])

      // Generate client_id
      const clientId = `VS-${String(imported + 1).padStart(6, '0')}`

      const personData = {
        client_id: clientId,
        first_name: firstName,
        middle_name: row['Middle']?.toString().trim() || null,
        last_name: row['Last Name']?.toString().trim() || null,
        nickname: row['AKA']?.toString().trim() || null,
        aka: row['AKA']?.toString().trim() || null,
        gender: row['Gender']?.toString().trim() || null,
        ethnicity: row['Ethnicity']?.toString().trim() || null,
        age: age,
        height: row['Height']?.toString() || null,
        weight: row['Weight']?.toString().trim() || null,
        hair_color: row['Hair']?.toString().trim() || null,
        eye_color: row['Eyes']?.toString() || null,
        physical_description: row['Description']?.toString() || null,
        notes: row['Notes']?.toString() || null,
        last_contact: lastContact,
        contact_count: row['Contacts'] || 0,
        enrollment_date: dateCreated || new Date().toISOString().split('T')[0],
        // Set defaults for required fields
        race: 'Unknown',
        living_situation: 'Unknown',
        veteran_status: false,
        disability_status: false,
        chronic_homeless: false,
      }

      const { error } = await supabase
        .from('persons')
        .insert(personData)

      if (error) {
        console.error(`Error importing "${firstName}": ${error.message}`)
        errors++
      } else {
        imported++
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} clients...`)
        }
      }
    } catch (err) {
      console.error(`Error processing row:`, err)
      errors++
    }
  }

  console.log('\n=== Import Complete ===')
  console.log(`Total rows: ${data.length}`)
  console.log(`Imported: ${imported}`)
  console.log(`Skipped (no name): ${skipped}`)
  console.log(`Errors: ${errors}`)

  // Show active vs inactive stats
  const { data: activeCount } = await supabase
    .from('persons')
    .select('id', { count: 'exact' })
    .gte('last_contact', ninetyDaysAgo.toISOString().split('T')[0])

  const { data: inactiveCount } = await supabase
    .from('persons')
    .select('id', { count: 'exact' })
    .or(`last_contact.lt.${ninetyDaysAgo.toISOString().split('T')[0]},last_contact.is.null`)

  console.log('\n=== Status Breakdown ===')
  console.log(`Active (contacted in last 90 days): ${activeCount?.length || 0}`)
  console.log(`Inactive (90+ days or never contacted): ${inactiveCount?.length || 0}`)
}

importClients().catch(console.error)
