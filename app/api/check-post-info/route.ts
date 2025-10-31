import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postUrl = searchParams.get('postUrl')

    if (!postUrl) {
      return NextResponse.json(
        { data: null, error: 'postUrl is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get post data with subreddit and project info
    const { data: postData, error: postError } = await supabase
      .from('reddit_posts')
      .select('subreddit, keywords!inner(project_id)')
      .eq('post_url', postUrl)
      .single()

    if (postError || !postData) {
      return NextResponse.json(
        { data: null, error: 'Post not found' },
        { status: 404 }
      )
    }

    const projectId = (postData as any).keywords.project_id
    const subreddit = postData.subreddit

    // Get project exclusions
    const { data: projectData } = await supabase
      .from('projects')
      .select('subreddit_exclusions')
      .eq('id', projectId)
      .single()

    const exclusions = projectData?.subreddit_exclusions || []
    // Normalize subreddit for case-insensitive comparison (same normalization as when storing exclusions)
    const normalizedSubreddit = subreddit.toLowerCase().replace(/^r\//, '')
    const isExcluded = exclusions.some(exclusion => exclusion.toLowerCase().replace(/^r\//, '') === normalizedSubreddit)

    return NextResponse.json({
      data: {
        subreddit,
        isExcluded,
        exclusions,
      },
      error: null,
    })
  } catch (e) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

