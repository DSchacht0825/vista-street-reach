// Re-labels placement locations for encounters recorded as "Other" or blank, using the
// free-text "other" field and the case notes. Dry run by default; --apply writes.
// Canonical dropdown values go in placement_location; everything else stays
// placement_location = 'Other' with a cleaned-up label in placement_location_other.
// Writes scripts/placements-backup-<timestamp>.json (original values) before applying.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'fs'

config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY = process.argv.includes('--apply')

const PERM = 'Permanent Housing'
const ECTLC = 'El Cajon Transitional Living Center (ECTLC)'
const VISTAY = 'Vistay Urban Angels'
const C4C = 'Convicted 4 Christ Ministries'

const canon = (loc, why, conf = 'high') => ({ loc, other: null, why, conf })
const other = (label, why, conf = 'high') => ({ loc: 'Other', other: label, why, conf })

// Explicit calls (keyed by first 8 chars of encounter id) where text and notes disagree,
// or the notes show the client was not actually placed (null = leave untouched).
const OVERRIDES = {
  '9b3856bf': null, // declined the room offered; not placed
  '5a1e6e57': null, // couch surfing, only waitlisted for BCNC / La Posada
  '223f41f2': null, // staying at a hotel; Green Oaks Ranch only suggested
  'ff938a03': null, // referred to BCNC but no beds available
  '05ed0386': other('FRC program', 'notes: on her way to the FRC program', 'medium'),
  '9d6c57b4': other('Serenity House', 'notes: transported to Serenity House to detox'),
  '551017d1': canon('BCNC', 'typed Casa de Amparo, notes say successfully placed at BCNC'),
  '4636400d': other(C4C, 'typed Bridge Housing, notes say got into Convicted 4 Christ'),
  '460dc5f7': canon('Bridge Housing', 'typed Housed, notes describe hotel stay'),
  '0add2abf': other('Zypher House (San Diego)', 'housed at Zypher House'),
  '67c87606': canon('Operation Hope', 'notes: going to Operation Hope', 'medium'),
  '1c76d2af': canon('Victory Outreach', 'notes: Victory Outreach accepted client'),
}

// Destinations that can be recognised in free text (used for both the "other" text and the notes)
const DEST = [
  [/bridge housing|days inn|hotel|motel/, () => canon('Bridge Housing', 'bridge/hotel')],
  [/family reunification/, () => canon('Family Reunification', 'family reunification')],
  [/ectl|ec tlc|el cajon trans/, () => other(ECTLC, 'ECTLC')],
  [/urban (street )?angels|vistay|vistay/, () => other(VISTAY, 'Vistay/Urban Angels')],
  [/serenity/, () => other('Serenity House', 'Serenity House')],
  [/green oaks/, () => other('Green Oaks Ranch', 'Green Oaks Ranch')],
  [/casa (de )?amparo/, () => other('Casa de Amparo', 'Casa de Amparo')],
  [/south county light|country light/, () => canon('South County Lighthouse', 'SC Lighthouse')],
  [/victory outreach/, () => canon('Victory Outreach', 'Victory Outreach')],
  [/la posada/, () => canon('La Posada', 'La Posada')],
  [/operation\.? hope/, () => canon('Operation Hope', 'Operation Hope')],
  [/mission academy/, () => canon('Mission Academy', 'Mission Academy')],
  [/\bbcnc\b/, () => canon('BCNC', 'BCNC')],
  [/\bonc\b/, () => canon('ONC', 'ONC')],
  [/interfaith detox/, () => ({ loc: 'Detox', other: null, detox: 'Interfaith', why: 'Interfaith detox', conf: 'high' })],
  [/convicted 4 christ|convictions for christ|c4c/, () => other(C4C, 'C4C')],
  [/salvation army/, () => other('Salvation Army', 'Salvation Army')],
  [/wrc/, () => other("WRC Oceanside (Women's Resource Center)", 'WRC')],
  [/safe parking/, () => other('Safe Parking', 'Safe Parking')],
  [/mcallister/, () => other('Sober Living (McAllister)', 'sober living')],
  [/revival house/, () => other('Revival House (San Diego)', 'Revival House')],
  [/recuperative/, () => other('Recuperative Care', 'recuperative care')],
  [/rhap/, () => other('RHAP (San Marcos)', 'RHAP')],
  [/esperanza/, () => other('Esperanza House', 'Esperanza House')],
  [/zypher|zephyr/, () => other('Zypher House (San Diego)', 'Zypher House')],
  [/not allowed to disclose/, () => other('Undisclosed shelter', 'client would not disclose', 'medium')],
]
const HOUSING = /lease|apartment|housed|^housing\s*$|voucher|\bhud\b|rent|independent living|psh|path placement|permanent housing|own place|shared housing|la sabila|las palmas/

function classify(e) {
  const t = (e.placement_location_other || '').trim().toLowerCase()
  const n = (e.case_management_notes || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const ov = OVERRIDES[e.id.slice(0, 8)]
  if (ov === null) return null
  if (ov) return { ...ov, why: 'override', conf: 'reviewed' }

  // 1) The typed "other" text names the destination
  if (t) {
    if (/^housed\b/.test(t) && /arizona/.test(n) && /family/.test(n)) return { ...canon('Family Reunification', 'moved to family in Arizona'), conf: 'medium' }
    for (const [re, f] of DEST) if (re.test(t)) return f()
    if (HOUSING.test(t)) return { ...other(PERM, `text "${t}"`), loc: 'Other' }
  }
  // 2) Otherwise look for a named destination in the notes (earliest mention wins)
  let best = null
  for (const [re, f] of DEST) {
    const m = re.exec(n)
    if (m && (best === null || m.index < best.idx)) best = { idx: m.index, f }
  }
  if (best) return { ...best.f(), conf: 'medium', why: 'notes: ' + best.f().why }
  if (HOUSING.test(n)) return { ...other(PERM, 'notes mention housing/lease'), conf: 'low' }
  return null
}

let all = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('encounters')
    .select('id, service_date, placement_made, placement_location, placement_location_other, placement_detox_name, case_management_notes')
    .eq('placement_made', true)
    .range(from, from + 999)
  if (error) { console.error(error); process.exit(1) }
  if (!data.length) break
  all = all.concat(data)
}
const targets = all.filter(e => e.placement_location === 'Other' || !e.placement_location)

const results = targets.map(e => ({ e, r: classify(e) }))
const changes = results.filter(x => x.r)
const unresolved = results.filter(x => !x.r)

if (process.env.SHOW) {
  for (const { e, r } of changes.filter(x => process.env.SHOW === 'all' || x.r.conf !== 'high')) {
    const now = `${e.placement_location || 'null'}|${(e.placement_location_other || '').trim()}`
    const to = r.loc === 'Other' ? `Other|${r.other}` : r.loc + (r.detox ? `(${r.detox})` : '')
    console.log(`${e.id.slice(0, 8)} [${r.conf}] ${now}  =>  ${to}  :: ${(e.case_management_notes || '').replace(/\s+/g, ' ').slice(0, 130)}`)
  }
  console.log('--- unresolved ---')
  for (const { e } of unresolved) console.log(`${e.id.slice(0, 8)} ${e.placement_location || 'null'}|${(e.placement_location_other || '').trim()} :: ${(e.case_management_notes || '(no notes)').replace(/\s+/g, ' ').slice(0, 130)}`)
}

if (process.env.FULL) {
  for (const pre of process.env.FULL.split(',')) {
    const e = all.find(x => x.id.startsWith(pre))
    console.log(`\n### ${pre} [${e.placement_location || 'null'}|${e.placement_location_other || ''}]\n${(e.case_management_notes || '(no notes)').replace(/\s+/g, ' ')}`)
  }
}
if (process.env.CONFLICTS) {
  for (const { e, r } of changes.filter(x => x.r.conf === 'high')) {
    const n = (e.case_management_notes || '').replace(/\s+/g, ' ').toLowerCase()
    const hits = DEST.filter(([re]) => re.test(n)).map(([, f]) => f()).filter(f => (f.loc === 'Other' ? f.other : f.loc) !== (r.loc === 'Other' ? r.other : r.loc))
    if (hits.length) console.log(`${e.id.slice(0, 8)} typed "${(e.placement_location_other || '').trim()}" => ${r.loc === 'Other' ? r.other : r.loc} | notes also mention: ${hits.map(h => h.loc === 'Other' ? h.other : h.loc).join(', ')} :: ${(e.case_management_notes || '').replace(/\s+/g, ' ').slice(0, 170)}`)
  }
}
const tally = {}
for (const { r } of changes) { const k = r.loc === 'Other' ? `Other: ${r.other}` : r.loc; tally[k] = (tally[k] || 0) + 1 }
console.log(`\nTarget records (Other/blank): ${targets.length}  ->  re-labelled: ${changes.length}, left as-is: ${unresolved.length}`)
console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(3)}  ${k}`).join('\n'))

if (!APPLY) { console.log('\nDry run. Re-run with --apply to write.'); process.exit(0) }

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `scripts/placements-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify(changes.map(({ e }) => ({ id: e.id, placement_location: e.placement_location, placement_location_other: e.placement_location_other, placement_detox_name: e.placement_detox_name })), null, 2))
console.log(`Backup written: ${backup}`)
let n = 0
for (const { e, r } of changes) {
  const update = { placement_location: r.loc, placement_location_other: r.loc === 'Other' ? r.other : e.placement_location_other }
  if (r.detox) update.placement_detox_name = r.detox
  const { error } = await supabase.from('encounters').update(update).eq('id', e.id)
  if (error) { console.error(e.id, error.message); process.exit(1) }
  n++
}
console.log(`Updated ${n} encounters.`)
