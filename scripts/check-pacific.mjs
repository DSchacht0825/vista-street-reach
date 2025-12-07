import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to get Pacific time date string from UTC timestamp
const getPacificDateString = (dateStr) => {
  const date = new Date(dateStr)
  const pacificDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const year = pacificDate.getFullYear()
  const month = String(pacificDate.getMonth() + 1).padStart(2, '0')
  const day = String(pacificDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function checkPacificTime() {
  const startDate = '2025-11-19'
  const endDate = '2025-11-25'

  // Get all encounters
  const { data: allEncounters } = await supabase
    .from('encounters')
    .select('person_id, service_date')

  // Filter using Pacific timezone
  const filteredEncounters = allEncounters.filter(e => {
    const serviceDate = getPacificDateString(e.service_date)
    return serviceDate >= startDate && serviceDate <= endDate
  })

  const uniquePersonIds = [...new Set(filteredEncounters.map(e => e.person_id))]

  console.log('=== Pacific Timezone Filtering ===')
  console.log('Date range:', startDate, 'to', endDate, '(Pacific Time)')
  console.log('')
  console.log('Total encounters in range:', filteredEncounters.length)
  console.log('Unduplicated clients:', uniquePersonIds.length)
  console.log('')

  // Breakdown by Pacific date
  const byDate = {}
  filteredEncounters.forEach(e => {
    const pacificDate = getPacificDateString(e.service_date)
    if (!byDate[pacificDate]) byDate[pacificDate] = new Set()
    byDate[pacificDate].add(e.person_id)
  })

  console.log('Breakdown by date (Pacific Time):')
  Object.entries(byDate).sort().forEach(([date, persons]) => {
    const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'America/Los_Angeles'
    })
    console.log(`  ${date} (${dayOfWeek}): ${persons.size} unique clients`)
  })
}

checkPacificTime()
