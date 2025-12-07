import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkWeekdaysOnly() {
  const startDate = '2025-11-19'
  const endDate = '2025-11-25'

  const { data: encounters } = await supabase
    .from('encounters')
    .select('person_id, service_date')
    .gte('service_date', startDate + 'T00:00:00')
    .lte('service_date', endDate + 'T23:59:59')

  // Filter to weekdays only (Mon-Fri)
  const weekdayEncounters = encounters.filter(e => {
    const date = new Date(e.service_date)
    const day = date.getDay() // 0=Sun, 6=Sat
    return day !== 0 && day !== 6
  })

  const uniqueWeekday = [...new Set(weekdayEncounters.map(e => e.person_id))].length

  console.log('=== Weekday vs All Days Comparison ===')
  console.log('')
  console.log('All days (Nov 19-25):')
  console.log('  Total encounters:', encounters.length)
  console.log('  Unduplicated clients:', [...new Set(encounters.map(e => e.person_id))].length)
  console.log('')
  console.log('Weekdays only (Mon-Fri):')
  console.log('  Total encounters:', weekdayEncounters.length)
  console.log('  Unduplicated clients:', uniqueWeekday)
  console.log('')

  // Show what days had data
  const byDay = {}
  encounters.forEach(e => {
    const date = new Date(e.service_date)
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    const dateStr = e.service_date.split('T')[0]
    const key = `${dateStr} (${dayName})`
    if (!byDay[key]) byDay[key] = new Set()
    byDay[key].add(e.person_id)
  })

  console.log('Breakdown by day:')
  Object.entries(byDay).sort().forEach(([day, persons]) => {
    const isWeekend = day.includes('Sat') || day.includes('Sun')
    console.log(`  ${day}: ${persons.size} unique clients${isWeekend ? ' (WEEKEND)' : ''}`)
  })
}

checkWeekdaysOnly()
