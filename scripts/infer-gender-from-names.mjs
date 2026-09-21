// Fills in gender for persons currently 'N/A' when the first name is clearly gendered.
// Unisex/unknown names are left as 'N/A'. Dry run by default; pass --apply to write.
// Writes a backup of original values to scripts/gender-backup-<timestamp>.json before applying.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'fs'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const set = (s) => new Set(s.split(/\s+/).filter(Boolean))

const MALE = set(`aaron adam adonis adrian ahmed aiden albert alejandro alejandrino alexandre alfonzo alvaro
andre andres andrew anothony anthony antonio arnold arron arthur aurelio austin benjamin bill bob bobby brad
bradley brandon brayden brett brian bruce bruno bryant caleb carl carlos cesar chad charles chris christian
christopher chrystian cisco clarence clayton corey cory craig curtis dale daniel danny dareious darian darry
darryl dave david dean demario demetrio denis dennis devonte dion don donald donovan doug dustin dwayne eddie
edgar eduardo edwardo edwin elias elijah emanuel emmanuel eric ernest ernie ezekiel filadelfo florencio
francisco frank fred freddy gabino gabriel garett garret gary george geronimo gerald gerardo gilbert glenn
gorge gregory griffin guy hector hedieberto henry humberto ian isaiah isaih ismael israel isrrael issac jacob
jaime jamal james jason jayden jeff jeffery jeffrey jefrey jeremiah jeremy jerome jerry jesse jesus jevin jhony
joaquin joe joel john johnny jonathan jorge jose joseph josh joshua juan julio justin ken kenneth kevin keith
kody kurt lafayette lance larry leon leonard lewis lucas luigi luis manny manuel marco marcos mario mark martin
mathew matthew maximo melchor melvin micah michael micheal miguel mike mikey mitchell moises monte nathan
nathaniel nico nicolas nikolas noe norm octavio omar oscar osiah paul pedro pete phillip rahman ramon randal
randall randy raul raymond reginald ricardo richard rick ricky robert rodney rodolfo rodrigo rogelio ron
ronald ronnie ruben rudy russell ryan sam sammy samuel scott sean sebastian sergio shaun shawn stanley stephan
stephen steven tanner ted thomas timothy tobias todd tomas tommy tony travis trevion trevor troy tyler tyshon
uriel valentino vernon vicente victor virgil walter william zachary zayden`)

const FEMALE = set(`adria adriana afton alicia alina alissa allissandra alma alexandria alexus amanda amber amy
analicia angela angelica angelique april aretina ariana arnishia artisha ashley aubree audrey azalea barbara
beatrice beatriz becca bernadette bertha beverly blanca brandi brandy brenda candace candy carlyne carmela
carmen caroline casandra cassandra kassandra charlene charsa chasity cherish cherri christen christi christina
christine christy clarlynda cristina cristine cynthia daisy damietra danielle dawn deanna deborah delma denise
desiree destynie deysi dianne donna dorothy dottie elaine eliza elizabeth emilia emily erika esmeralda estefani
esther eva evelyn genevieve gennie georgina gillian gillie ginalyn gissel haleigh helena herlinda ilene isabel
jael janae janelle janet janiqua jasmin jasmine jeanette jennifer jessica jill joanna joanne joyce judith judy
julie juliette kandy kara karen karla katherine kathleen kathy katrina kayla kaye kharissa kimber kimberly kizzy
kristen kristi kristin kristina kristine kristy ladonna lacey lani latrice laura lauren libusa linda lisa lois
lizbeth lorena lori lorita louise luana ludia margaret margarita maria mariana marci marilyn marisa maritza
marjorie martha martina mary mayra megan melissa mercedes merri mia michele michelle midori miranda miyuki molly
monica monisa murieal myniesha nanako nancy nicole olita pamela paola patricia piper rachael rachel raineesha
rebecca renee rhiana rosa samantha sara sarah sebrina selina shanelle shanna shawna shaynay shelley shelly
sheree sherry shirlanne siobhan sierra silvia sofia sonya stacey staci stacy stephanie sue susan susana suzanne
svetlana tamala tamara tammie tamula tasha tenea teresa territa tess theresa tiffany tolanda tracey tracy
vanessa veronica victoria vivian wendy yolanda zakia liliana`)

const APPLY = process.argv.includes('--apply')

let all = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('persons')
    .select('id, client_id, first_name, last_name, gender')
    .eq('gender', 'N/A')
    .range(from, from + 999)
  if (error) { console.error(error); process.exit(1) }
  if (!data.length) break
  all = all.concat(data)
}

const changes = []
const skipped = []
for (const p of all) {
  const first = (p.first_name || '').trim().split(/\s+/)[0].toLowerCase()
  const g = MALE.has(first) ? 'Male' : FEMALE.has(first) ? 'Female' : null
  if (g) changes.push({ ...p, newGender: g })
  else skipped.push(p)
}

console.log(`N/A records: ${all.length}`)
console.log(`  -> Male:   ${changes.filter(c => c.newGender === 'Male').length}`)
console.log(`  -> Female: ${changes.filter(c => c.newGender === 'Female').length}`)
console.log(`  left as N/A: ${skipped.length}`)

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `scripts/gender-backup-${stamp}.json`
writeFileSync(backup, JSON.stringify(changes.map(({ id, client_id, first_name, last_name, gender, newGender }) =>
  ({ id, client_id, first_name, last_name, oldGender: gender, newGender })), null, 2))
console.log(`Backup written: ${backup}`)

let done = 0
for (const g of ['Male', 'Female']) {
  const ids = changes.filter(c => c.newGender === g).map(c => c.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('persons').update({ gender: g }).in('id', ids.slice(i, i + 200)).eq('gender', 'N/A')
    if (error) { console.error(error); process.exit(1) }
    done += Math.min(200, ids.length - i)
  }
}
console.log(`Updated ${done} records.`)
