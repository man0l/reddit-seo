import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkRankings, saveRankingsToDatabase } from '@/lib/rankings'

// Cron job endpoint to refresh all keyword rankings daily
export async function GET(request: NextRequest) {
  try {
    // Check if this is a cron request (you can add authentication here)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch all keywords
    const { data: keywords, error: keywordsError } = await supabase
      .from('keywords')
      .select('id, keyword')

    if (keywordsError) throw keywordsError

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({
        message: 'No keywords to check',
        checked: 0,
      })
    }

    // Check rankings for each keyword
    const results = []
    for (const keyword of keywords) {
      try {
        const redditPosts = await checkRankings(keyword.keyword)
        await saveRankingsToDatabase(keyword.id, keyword.keyword, redditPosts)
        results.push({
          keyword: keyword.keyword,
          success: true,
          postsCount: redditPosts.length,
        })
      } catch (error) {
        results.push({
          keyword: keyword.keyword,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      message: 'Cron job completed',
      checked: keywords.length,
      successful: successCount,
      failed: failureCount,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

