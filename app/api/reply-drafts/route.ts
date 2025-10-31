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

    const { searchParams } = new URL(request.url)
    const postUrl = searchParams.get('postUrl')

    if (!postUrl) {
      return NextResponse.json(
        { data: null, error: 'Post URL is required' },
        { status: 400 }
      )
    }

    // Get draft for this user and post
    const { data, error } = await supabase
      .from('reply_drafts')
      .select('draft_content')
      .eq('user_id', user.id)
      .eq('post_url', postUrl)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return NextResponse.json({ 
      data: { draft_content: data?.draft_content || '' }, 
      error: null 
    })
  } catch (error) {
    console.error('Error fetching reply draft:', error)
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
    const { postUrl, draftContent } = body

    if (!postUrl || typeof postUrl !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Post URL is required' },
        { status: 400 }
      )
    }

    if (!draftContent || typeof draftContent !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Draft content is required' },
        { status: 400 }
      )
    }

    // Upsert draft (insert or update)
    // Use insert with ON CONFLICT handling
    const { data: existing } = await supabase
      .from('reply_drafts')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_url', postUrl)
      .maybeSingle()

    let data, error
    if (existing) {
      // Update existing draft
      const result = await supabase
        .from('reply_drafts')
        .update({
          draft_content: draftContent.trim(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // Insert new draft
      const result = await supabase
        .from('reply_drafts')
        .insert({
          user_id: user.id,
          post_url: postUrl,
          draft_content: draftContent.trim(),
        })
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) throw error

    return NextResponse.json({ 
      data: { draft_content: data.draft_content }, 
      error: null 
    })
  } catch (error) {
    console.error('Error saving reply draft:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const postUrl = searchParams.get('postUrl')

    if (!postUrl) {
      return NextResponse.json(
        { data: null, error: 'Post URL is required' },
        { status: 400 }
      )
    }

    // Delete draft for this user and post
    const { error } = await supabase
      .from('reply_drafts')
      .delete()
      .eq('user_id', user.id)
      .eq('post_url', postUrl)

    if (error) throw error

    return NextResponse.json({ 
      data: { success: true }, 
      error: null 
    })
  } catch (error) {
    console.error('Error deleting reply draft:', error)
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

