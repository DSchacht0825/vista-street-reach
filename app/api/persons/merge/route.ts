import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { keepPersonId, deletePersonId } = await request.json()

    if (!keepPersonId || !deletePersonId) {
      return NextResponse.json(
        { error: 'Missing keepPersonId or deletePersonId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Transfer all encounters from deleted person to kept person
    const { error: updateError } = await supabase
      .from('encounters')
      .update({ person_id: keepPersonId })
      .eq('person_id', deletePersonId)

    if (updateError) {
      console.error('Error transferring encounters:', updateError)
      return NextResponse.json(
        { error: 'Failed to transfer encounters: ' + updateError.message },
        { status: 500 }
      )
    }

    // Delete the duplicate person
    const { error: deleteError } = await supabase
      .from('persons')
      .delete()
      .eq('id', deletePersonId)

    if (deleteError) {
      console.error('Error deleting person:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete person: ' + deleteError.message },
        { status: 500 }
      )
    }

    // Verify deletion
    const { data: checkPerson } = await supabase
      .from('persons')
      .select('id')
      .eq('id', deletePersonId)
      .single()

    if (checkPerson) {
      return NextResponse.json(
        { error: 'Delete failed - record still exists' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Merge error:', error)
    return NextResponse.json(
      { error: 'Server error during merge' },
      { status: 500 }
    )
  }
}
