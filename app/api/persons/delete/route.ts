import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { personId } = await request.json()

    if (!personId) {
      return NextResponse.json(
        { error: 'Missing personId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Delete encounters first (foreign key constraint)
    const { error: encountersError } = await supabase
      .from('encounters')
      .delete()
      .eq('person_id', personId)

    if (encountersError) {
      console.error('Error deleting encounters:', encountersError)
      return NextResponse.json(
        { error: 'Failed to delete encounters: ' + encountersError.message },
        { status: 500 }
      )
    }

    // Delete the person
    const { error: deleteError } = await supabase
      .from('persons')
      .delete()
      .eq('id', personId)

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
      .eq('id', personId)
      .single()

    if (checkPerson) {
      return NextResponse.json(
        { error: 'Delete failed - record still exists' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Server error during delete' },
      { status: 500 }
    )
  }
}
