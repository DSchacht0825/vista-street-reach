/**
 * Vista Street Reach Client Import Script
 *
 * Usage: node scripts/import-vista-clients.mjs
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

function parseDate(dateStr) {
  if (!dateStr || dateStr === 'Never') return null
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

function parseAge(age) {
  if (age === null || age === undefined) return null
  const parsed = typeof age === 'string' ? parseInt(age, 10) : age
  return isNaN(parsed) ? null : parsed
}

async function importClients() {
  console.log('Starting Vista Street Reach client import...\n')

  // Read the Excel file
  const filePath = join(__dirname, '../public/All_People_97_20251205.xls')
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet)

  console.log(`Found ${data.length} clients to import\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

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

      const personData = {
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

  // Count active/inactive
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0]

  const { count: activeCount } = await supabase
    .from('persons')
    .select('*', { count: 'exact', head: true })
    .gte('last_contact', cutoffDate)

  const { count: totalCount } = await supabase
    .from('persons')
    .select('*', { count: 'exact', head: true })

  console.log('\n=== Status Breakdown ===')
  console.log(`Active (contacted in last 90 days): ${activeCount || 0}`)
  console.log(`Inactive (90+ days or never): ${(totalCount || 0) - (activeCount || 0)}`)
  console.log(`Total in database: ${totalCount || 0}`)
}

importClients().catch(console.error)
