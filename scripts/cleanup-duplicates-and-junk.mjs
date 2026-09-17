import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

// 8 confident duplicate pairs: [keepId, deleteId, label]
// Encounters get transferred to keepId first, then deleteId's person row is removed.
const mergePairs = [
  ['7d1b7b80-9cbf-49bc-b4bb-2bb66b9a2153', 'b690e9f7-5a42-4c24-98cc-6250b738f0f6', 'Michael Washington'],
  ['1dd21d9c-7f01-4a45-8cd4-f2aaf402b871', '0388c09b-c8dd-4f9e-a892-312d92227d23', 'Alisha Carroll'],
  ['ced3cc83-198c-45a6-9336-64babdadbedd', '871a6a29-ab72-4478-9692-bc8570390b58', 'Scott Coletti'],
  ['925f9ca7-0005-4885-a995-2f0053111131', '0c907857-d4ad-4735-8b92-5cdc993fe7c4', 'Donna Deaniello/Deniello'],
  ['73b91687-10ce-4a47-ab74-1e20fed669a3', 'e3dec05c-a9b7-4813-b9d0-8cacaf9dd6e6', 'Rogelio Baca/Vaca'],
  ['704e572c-dc10-4e55-a8f4-895568db288a', '53fb6815-c0b2-4989-834f-7d57fbfd15be', 'Adonis Wakegigig/Wikigigig'],
  ['8d4486a2-00a8-4b16-b882-5c22a1f241fd', '7a26e79b-a400-4576-9f2a-7b51091e755c', 'Dean Lopes/Lopez'],
  ['9b07f9e3-619d-4649-b747-a0efd4f1b635', '195406ff-c5fa-45cc-9293-3577d1237783', 'Pascual Soria/Sofia'],
]

console.log('=== MERGING 8 CONFIDENT DUPLICATE PAIRS ===')
for (const [keepId, deleteId, label] of mergePairs) {
  const { error: updateError } = await supabase
    .from('encounters')
    .update({ person_id: keepId })
    .eq('person_id', deleteId)
  if (updateError) { console.log(`FAIL transfer ${label}:`, updateError.message); continue }

  const { error: delError } = await supabase
    .from('persons')
    .delete()
    .eq('id', deleteId)
  if (delError) { console.log(`FAIL delete ${label}:`, delError.message); continue }

  console.log(`OK merged: ${label} (kept ${keepId}, removed ${deleteId})`)
}

// 78 junk location/business/vehicle records (no real person name, entered by mistake).
// These have no last_name, and their first_name field contains a location, business,
// vehicle, or intersection instead of a person's name. Deleting cascades to their
// (typically 0-3, one case 55) attached encounters per the encounters.person_id
// ON DELETE CASCADE FK.
const junkIds = [
'ae7dc1a6-5426-42be-b673-93d551f1a162','ab81f82a-3e78-4c8d-bd28-e432a636951d','6d37dd89-e694-4766-95e0-094d4e0c52fa',
'ff7bdf07-3ee8-4fef-a92d-003430302338','e024ca64-2151-4b76-9e17-789156630102','120ac154-ecba-423d-b15e-0817f775353c',
'aefc155c-5932-4a40-9474-696fde99db0e','7eaf092d-dd6c-4e7b-be56-5d0622447bd1','3a7553a8-8a82-4ef7-9364-b48478f7a734',
'c5b46b05-7315-447f-a2ad-e7e816dff3b7','da891899-51c9-4322-a08e-e38cbaa52083','e5c714bf-ece2-4a30-a5e8-98b211572858',
'c9fef594-77ac-4d0f-977c-c5cdf05963de','56165200-0a68-4cb1-81cd-29644147f443','81da923f-087f-4a0f-af84-36013570f643',
'36c3af6b-197e-47b2-9561-e4fee82e7a34','7b078cfe-8d3e-4e63-92b5-aa45b8e5f5c3','c4b0beb8-fa52-4739-a585-caf2bd28bd9c',
'a5fba4a3-1878-40de-8e86-eb4beb35154c','2de62d12-de26-44ef-b397-482af6ecb6b1','b47b0a2e-6cef-44cd-b3fa-15d3cdc190c5',
'a655a881-a703-4f19-b4ca-55693f8b5660','7557aad8-2ce4-4ea1-b35f-cea1f549de45','be5877ee-6daa-43af-a6f7-6f866516433f',
'ebbb22b4-a512-4e1c-864d-56131c3712f8','eb3c378a-1e8d-45f1-95d3-2b65d397afd6','ed070950-8e1a-4474-93bc-eb2afe5bb56d',
'bbaf408b-5cfd-4427-9912-8dbbb8084a81','d54424d4-6ee4-4da7-8143-90b5b0a32e50','7cdb6168-4fff-4066-8be3-0668b21600da',
'95fe5b93-767e-487f-8176-6e875a2e1007','6798dfde-91c5-4795-ad2e-607c91a32996','901c5932-10e2-4167-82aa-79964fa76506',
'0c1305d0-def5-46bc-9d8d-67e118ef4190','1726d860-7965-4ce6-86b2-b9861773d735','150563de-7bfe-4274-8256-8ce772af2113',
'cb842883-107f-4f1c-96e2-cd46b7edfef1','aa141811-bf93-499f-ad9f-ab29c2c78c55','b9ea946f-af22-4525-88eb-0d4eccf408df',
'5f6a1430-9759-4d5e-997f-1f610dbde4de','21403cae-738d-4311-91d2-f01de7823aca','45b96e83-4e61-4dfc-87df-16a4b8c59ebb',
'c5368755-39d7-4eda-941b-04c595806e07','3e36b977-4dc0-486b-b483-b036b93cc7d9','d4dd83f5-0270-4b88-9169-b4941f48f437',
'2b591138-18ef-47c6-8c35-63472d0a3d73','4215a457-28a8-4f9b-a921-64af3c53ab99','e6953da7-0caf-4d21-a673-39fc9df38971',
'2adf30df-56c3-465c-9c2e-5bc8cefb6fd8','6681e9c4-bfdb-4265-a1a1-4a55eed893cd','db0ef23a-1b22-4cb3-b136-38fb1d0ee525',
'bb7a17b1-94f2-4224-beb6-38d61f590c3c','734e28cc-4331-4a36-9b19-6df4020a6bc8','e0ae2935-6b4b-48dc-84f3-3549ac536c9f',
'48552d01-9423-4e18-867c-b1139347f782','e3ea273b-d67f-4edb-868b-9ac30d5e4a8b','0cc6d453-0033-427c-8dc4-7db269181837',
'c74670ce-1bf1-41c3-b5ea-099ffe8b2f2a','d6010c04-672c-47e4-b274-ea2d5e0b8af3','a26c3fd1-7829-4aa2-b103-ddc9dba0ce4c',
'b7ffe94f-058e-4665-8d44-ac98467fa0d8','7b20995d-9dca-450f-8282-eb0d292e306e','2c923b61-41ca-4a21-8b78-dd5a445f2736',
'ad5eb2d7-4659-40ce-9289-f3c62e2484bf','63085518-aec4-44ec-b267-3ee97a146253','d42cea6d-95ca-4019-b798-98376f70088f',
'8211ae30-e1c3-406a-a3e3-1e03d2b6bd3e','7b580606-eb2d-4aa5-8cf7-5b5e8b9df824','9e5306c5-6c35-4366-9231-59552a250341',
'cea4d5cc-9ab0-40e1-bfa2-626fddb3bbc1','e167eb0b-680e-45a0-a536-b7a2ed50ca3a','03dc8573-dd45-4888-8536-dd70a252f946',
'8a011272-7c6f-4a0b-9ff1-41c55827ab76','67f7a412-c34f-403c-b2c3-9e664386dcdf','ef836b78-0819-4118-ae31-281a03d4872b',
'802b9192-5a65-4aa3-9cf6-2b085e384dc5','d93f64c2-4fe8-437e-92ce-5a2c4b55109e','6d7f1b06-3d69-40b3-a5e5-6f573b0d004f'
]

console.log(`\n=== DELETING ${junkIds.length} JUNK LOCATION/BUSINESS RECORDS ===`)
const { data: delData, error: delErr } = await supabase
  .from('persons')
  .delete()
  .in('id', junkIds)
  .select('id')

if (delErr) console.log('FAIL:', delErr.message)
else console.log('Deleted count:', delData?.length)

const { count: totalPersons } = await supabase.from('persons').select('*', { count: 'exact', head: true })
console.log('\n=== FINAL TOTAL PERSONS ===', totalPersons)
