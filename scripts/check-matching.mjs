import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function compare() {
  // Get unique names from Excel
  const workbook = XLSX.readFile('./public/logreport-2.xls')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet)

  const excelNames = new Set()
  data.filter(r => r.People).forEach(r => {
    r.People.split(/[,|]/).forEach(n => excelNames.add(n.trim()))
  })

  console.log('Unique names in Excel:', excelNames.size)

  // Get all persons from DB
  let allPersons = []
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from('persons')
      .select('first_name, middle_name, last_name, aka, nickname')
      .range(from, from + 999)
    if (!batch || batch.length === 0) break
    allPersons = allPersons.concat(batch)
    from += 1000
  }

  console.log('Persons in DB:', allPersons.length)

  // Build DB name set with multiple variations
  const dbNames = new Map()
  allPersons.forEach(p => {
    const normalize = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')

    // Full name with middle
    const full = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
    // First + Last only
    const firstLast = [p.first_name, p.last_name].filter(Boolean).join(' ')
    // First only
    const firstOnly = p.first_name || ''

    dbNames.set(normalize(full), p)
    dbNames.set(normalize(firstLast), p)
    if (!p.last_name) {
      dbNames.set(normalize(firstOnly), p)
    }
    // AKA and nickname
    if (p.aka) dbNames.set(normalize(p.aka), p)
    if (p.nickname) dbNames.set(normalize(p.nickname), p)
  })

  // Check matches
  let exactMatch = 0
  let noMatch = []

  for (const name of excelNames) {
    const normalized = name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')
    if (dbNames.has(normalized)) {
      exactMatch++
    } else {
      noMatch.push(name)
    }
  }

  console.log('\nExact matches:', exactMatch)
  console.log('No match:', noMatch.length)
  console.log('\nUnmatched names:')
  noMatch.forEach(n => console.log(' -', n))
}

compare().catch(console.error)
