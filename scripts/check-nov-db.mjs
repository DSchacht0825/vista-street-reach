import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  let allNov = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('encounters')
      .select('id, log_id, service_date')
      .gte('service_date', '2025-11-01')
      .lt('service_date', '2025-12-01')
      .range(from, from + 999)

    if (error) {
      console.error('Error:', error)
      break
    }
    if (!data || data.length === 0) break
    allNov = allNov.concat(data)
    from += 1000
  }

  console.log('Total November encounters in DB:', allNov.length)
  console.log('With log_id:', allNov.filter(e => e.log_id).length)

  const logIds = new Set(allNov.map(e => e.log_id).filter(Boolean))
  console.log('Unique log_ids:', logIds.size)
}
check()
