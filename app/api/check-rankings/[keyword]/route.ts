import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkRankings, saveRankingsToDatabase } from '@/lib/rankings'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  try {
    const { keyword: keywordParam } = await params
    const keyword = decodeURIComponent(keywordParam)

    if (!keyword) {
      return NextResponse.json(
        { data: null, error: 'Keyword is required' },
        { status: 400 }
      )
    }

    // Find keyword in database
    const { data: keywordData, error: keywordError } = await supabase
      .from('keywords')
      .select('id')
      .eq('keyword', keyword)
      .single()

    if (keywordError || !keywordData) {
      return NextResponse.json(
        { data: null, error: 'Keyword not found' },
        { status: 404 }
      )
    }

    // Just fetch existing posts from database (fast)
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('*')
      .eq('keyword_id', keywordData.id)
      .order('rank_position', { ascending: true })

    if (postsError) throw postsError

    return NextResponse.json({ data: posts || [], error: null })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ keyword: string }> }
) {
  try {
    const { keyword: keywordParam } = await params
    const keyword = decodeURIComponent(keywordParam)

    if (!keyword) {
      return NextResponse.json(
        { data: null, error: 'Keyword is required' },
        { status: 400 }
      )
    }

    // Find keyword in database
    const { data: keywordData, error: keywordError } = await supabase
      .from('keywords')
      .select('id')
      .eq('keyword', keyword)
      .single()

    if (keywordError || !keywordData) {
      return NextResponse.json(
        { data: null, error: 'Keyword not found' },
        { status: 404 }
      )
    }

    // Check rankings (this calls external APIs - slow)
    const redditPosts = await checkRankings(keyword)

    // Save rankings to database
    await saveRankingsToDatabase(keywordData.id, keyword, redditPosts)

    // Fetch updated posts
    const { data: posts, error: postsError } = await supabase
      .from('reddit_posts')
      .select('*')
      .eq('keyword_id', keywordData.id)
      .order('rank_position', { ascending: true })

    if (postsError) throw postsError

    return NextResponse.json({ data: posts || [], error: null })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
