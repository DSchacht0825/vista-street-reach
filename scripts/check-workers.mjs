import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkWorkers() {
  let all = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('encounters')
      .select('outreach_worker')
      .not('log_id', 'is', null)
      .range(from, from + 999)

    if (error || !data || data.length === 0) break
    all = all.concat(data)
    from += 1000
  }

  const workerCounts = {}
  all.forEach(e => {
    const worker = e.outreach_worker || 'Unknown'
    workerCounts[worker] = (workerCounts[worker] || 0) + 1
  })

  console.log('Outreach workers from imported data (with log_id):')
  console.log('================================================')
  Object.entries(workerCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([worker, count]) => {
      console.log(`  ${worker}: ${count}`)
    })
  console.log('\nTotal imported encounters:', all.length)
}
checkWorkers()
