import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deepDive() {
  const startDate = '2025-11-19'
  const endDate = '2025-11-25'

  const { data: encounters } = await supabase
    .from('encounters')
    .select('person_id, service_date, outreach_location, outreach_worker')
    .gte('service_date', startDate + 'T00:00:00')
    .lte('service_date', endDate + 'T23:59:59')

  const uniquePersonIds = [...new Set(encounters.map(e => e.person_id))]

  const { data: persons } = await supabase
    .from('persons')
    .select('id, first_name, last_name, client_id, enrollment_date, last_contact')
    .in('id', uniquePersonIds)

  console.log('=== All 80 Unique Clients in Date Range ===\n')

  const sorted = persons.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

  sorted.forEach((p, i) => {
    const encounterCount = encounters.filter(e => e.person_id === p.id).length
    console.log(`${i+1}. ${p.first_name} ${p.last_name || ''} - ${encounterCount} encounters`)
  })

  console.log('\n=== Potential Duplicate Names ===')
  const firstNames = {}
  persons.forEach(p => {
    const name = (p.first_name || '').toLowerCase()
    if (!firstNames[name]) firstNames[name] = []
    firstNames[name].push(p)
  })

  Object.entries(firstNames)
    .filter(([, arr]) => arr.length > 1)
    .forEach(([name, arr]) => {
      console.log(`\n"${name}" appears ${arr.length} times:`)
      arr.forEach(p => {
        console.log(`  - ${p.first_name} ${p.last_name || ''} (ID: ${p.client_id})`)
      })
    })

  console.log('\n=== Encounters by Date ===')
  const byDate = {}
  encounters.forEach(e => {
    const date = e.service_date.split('T')[0]
    if (!byDate[date]) byDate[date] = { total: 0, uniquePersons: new Set() }
    byDate[date].total++
    byDate[date].uniquePersons.add(e.person_id)
  })

  Object.entries(byDate).sort().forEach(([date, data]) => {
    console.log(`${date}: ${data.total} encounters, ${data.uniquePersons.size} unique clients`)
  })

  // Sum of daily unique (this is likely how previous system counted)
  const sumOfDaily = Object.values(byDate).reduce((sum, data) => sum + data.uniquePersons.size, 0)
  console.log(`\nSum of daily unique clients: ${sumOfDaily}`)
  console.log(`True unduplicated across week: ${uniquePersonIds.length}`)
  console.log(`\nDifference explained: Previous system may have counted unique clients PER DAY`)
  console.log(`and then shown the highest daily count, not the week total.`)
}

deepDive()
