// Scan the persons (by-name list) table for duplicate clients and merge
// each group into the most-complete record.
//
// Usage:
//   node scripts/merge-duplicates.mjs           # dry run, no writes
//   node scripts/merge-duplicates.mjs --execute # actually merge + delete
//
// "Most complete" = most non-empty descriptive fields filled in, tie-broken
// by encounter count, then by earliest enrollment_date.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXECUTE = process.argv.includes('--execute')

// Booleans default to FALSE in the schema, so "false" doesn't mean someone
// entered data - exclude them (and housekeeping columns) from the
// completeness score to avoid rewarding untouched defaults.
const SCORE_EXCLUDE = new Set([
  'id', 'client_id', 'created_at', 'updated_at',
  'veteran_status', 'disability_status', 'chronic_homeless',
  'release_of_information', 'domestic_violence_victim', 'chronic_health',
  'mental_health', 'placement_made', 'refused_shelter',
  'high_utilizer_contact', 'shelter_unavailable',
])

function isFilled(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

function completenessScore(person) {
  let score = 0
  for (const [key, value] of Object.entries(person)) {
    if (SCORE_EXCLUDE.has(key)) continue
    if (isFilled(value)) score++
  }
  return score
}

function calculateSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase()
  const s2 = (str2 || '').toLowerCase()
  const costs = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  const maxLength = Math.max(s1.length, s2.length)
  return maxLength === 0 ? 1 : 1 - costs[s2.length] / maxLength
}

async function fetchAll(table, select) {
  let all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Fetching ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    all = all.concat(data)
    from += pageSize
    if (from > 100000) break
  }
  return all
}

async function main() {
  console.log(EXECUTE ? 'Running in EXECUTE mode (will write/delete).' : 'Running in DRY RUN mode (no writes). Pass --execute to apply.')

  const persons = (await fetchAll('persons', '*')).filter(p => p.first_name && p.last_name)
  const encounters = await fetchAll('encounters', 'id, person_id')
  const statusChanges = await fetchAll('status_changes', 'id, person_id').catch(() => [])

  const encounterCounts = {}
  encounters.forEach(e => { encounterCounts[e.person_id] = (encounterCounts[e.person_id] || 0) + 1 })

  console.log(`Loaded ${persons.length} persons, ${encounters.length} encounters, ${statusChanges.length} status changes.`)

  // Group duplicates using the same fuzzy-match rule as the in-app scanner.
  const groups = []
  const processed = new Set()

  for (let i = 0; i < persons.length; i++) {
    if (processed.has(persons[i].id)) continue
    const p1 = persons[i]
    const matches = [p1]

    for (let j = i + 1; j < persons.length; j++) {
      if (processed.has(persons[j].id)) continue
      const p2 = persons[j]

      const firstSim = calculateSimilarity(p1.first_name, p2.first_name)
      const lastSim = calculateSimilarity(p1.last_name || '', p2.last_name || '')
      const avgSim = (firstSim + lastSim) / 2
      const sameDOB = p1.date_of_birth && p2.date_of_birth && p1.date_of_birth === p2.date_of_birth
      const isDup = (sameDOB && avgSim > 0.6) || avgSim > 0.85

      if (isDup) {
        matches.push(p2)
        processed.add(p2.id)
      }
    }

    if (matches.length > 1) {
      processed.add(p1.id)
      groups.push(matches)
    }
  }

  console.log(`\nFound ${groups.length} duplicate group(s) covering ${groups.reduce((n, g) => n + g.length, 0)} records.\n`)

  let mergedCount = 0
  const highConfidence = []
  const needsReview = []

  for (const group of groups) {
    // Rank: completeness score desc, then encounter count desc, then earliest enrollment_date.
    const ranked = [...group].sort((a, b) => {
      const scoreDiff = completenessScore(b) - completenessScore(a)
      if (scoreDiff !== 0) return scoreDiff
      const encDiff = (encounterCounts[b.id] || 0) - (encounterCounts[a.id] || 0)
      if (encDiff !== 0) return encDiff
      return new Date(a.enrollment_date || 0) - new Date(b.enrollment_date || 0)
    })

    const keeper = ranked[0]
    const losers = ranked.slice(1)

    for (const loser of losers) {
      // Recompute confidence against the actual keeper (not whichever
      // group member it originally chained-matched against).
      const firstSim = calculateSimilarity(keeper.first_name, loser.first_name)
      const lastSim = calculateSimilarity(keeper.last_name || '', loser.last_name || '')
      const avgSim = (firstSim + lastSim) / 2
      const sameDOB = keeper.date_of_birth && loser.date_of_birth && keeper.date_of_birth === loser.date_of_birth
      const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const exactNameMatch = norm(keeper.first_name) === norm(loser.first_name) && norm(keeper.last_name) === norm(loser.last_name)
      // Confident only when corroborated by DOB, or the name is exactly
      // identical (not just similar-looking - e.g. Jose Hernandez vs Jose
      // Fernandez, or Dillian vs Gillian Watson, are plausibly different
      // people and must not be auto-merged on spelling similarity alone).
      const confident = (sameDOB && avgSim > 0.6) || exactNameMatch

      const fillIns = {}
      for (const [key, value] of Object.entries(loser)) {
        if (SCORE_EXCLUDE.has(key)) continue
        if (!isFilled(keeper[key]) && isFilled(value)) {
          fillIns[key] = value
        }
      }

      const entry = { keeper, loser, fillIns, avgSim, sameDOB }
      if (confident) {
        highConfidence.push(entry)
      } else {
        needsReview.push(entry)
      }
      mergedCount++
    }
  }

  const describe = ({ keeper, loser, avgSim, sameDOB }) =>
    `${loser.first_name} ${loser.last_name} (${loser.client_id}) -> ${keeper.first_name} ${keeper.last_name} (${keeper.client_id})` +
    `  [name sim ${avgSim.toFixed(2)}${sameDOB ? ', same DOB' : ''}]`

  console.log(`\nHIGH CONFIDENCE (DOB-confirmed or near-identical spelling): ${highConfidence.length}`)
  highConfidence.forEach(e => console.log('  ' + describe(e)))

  console.log(`\nNEEDS REVIEW (name-similarity only, no corroborating DOB/details - likely includes false positives): ${needsReview.length}`)
  needsReview.forEach(e => console.log('  ' + describe(e)))

  if (!EXECUTE) {
    console.log(`\nDRY RUN complete. ${mergedCount} duplicate record(s) found across ${groups.length} group(s): ${highConfidence.length} high-confidence, ${needsReview.length} need manual review.`)
    console.log('Re-run with --execute to merge ONLY the high-confidence records. Needs-review records are never auto-merged by this script.')
    return
  }

  for (const { keeper, loser, fillIns } of highConfidence) {
    if (Object.keys(fillIns).length > 0) {
      const { error } = await supabase.from('persons').update(fillIns).eq('id', keeper.id)
      if (error) throw new Error(`Backfilling ${keeper.client_id}: ${error.message}`)
    }

    const { error: encErr } = await supabase.from('encounters').update({ person_id: keeper.id }).eq('person_id', loser.id)
    if (encErr) throw new Error(`Transferring encounters for ${loser.client_id}: ${encErr.message}`)

    const { error: statusErr } = await supabase.from('status_changes').update({ person_id: keeper.id }).eq('person_id', loser.id)
    if (statusErr && !/relation .* does not exist/i.test(statusErr.message)) {
      throw new Error(`Transferring status changes for ${loser.client_id}: ${statusErr.message}`)
    }

    const { error: delErr } = await supabase.from('persons').delete().eq('id', loser.id)
    if (delErr) throw new Error(`Deleting ${loser.client_id}: ${delErr.message}`)
  }

  console.log(`\nDone. Merged and deleted ${highConfidence.length} duplicate record(s). ${needsReview.length} record(s) left untouched pending manual review.`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
