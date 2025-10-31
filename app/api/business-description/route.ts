import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's business description
    const { data, error } = await supabase
      .from('business_descriptions')
      .select('description')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return NextResponse.json({ 
      data: { description: data?.description || '' }, 
      error: null 
    })
  } catch (error) {
    console.error('Error fetching business description:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { description } = body

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Description is required' },
        { status: 400 }
      )
    }

    // Upsert business description (insert or update)
    const { data, error } = await supabase
      .from('business_descriptions')
      .upsert({
        user_id: user.id,
        description: description.trim(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      data: { description: data.description }, 
      error: null 
    })
  } catch (error) {
    console.error('Error saving business description:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

