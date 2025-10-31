import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRankings, saveRankingsToDatabase } from '@/lib/rankings'

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
    const projectId = searchParams.get('project_id')

    let query = supabase
      .from('keywords')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function checkRankingsForKeyword(keywordId: string, keywordText: string, supabaseClient: any) {
  try {
    const redditPosts = await checkRankings(keywordText)
    await saveRankingsToDatabase(keywordId, keywordText, redditPosts, supabaseClient)
    return { success: true, postsCount: redditPosts.length }
  } catch (error) {
    console.error(`Error checking rankings for keyword ${keywordText}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
    const { keyword, keywords } = body

    // Handle bulk insert
    if (keywords && Array.isArray(keywords)) {
      if (keywords.length === 0) {
        return NextResponse.json(
          { data: null, error: 'No keywords provided' },
          { status: 400 }
        )
      }

      // Clean and validate keywords
      const validKeywords = keywords
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .filter((k: string, index: number, self: string[]) => self.indexOf(k) === index) // Remove duplicates

      if (validKeywords.length === 0) {
        return NextResponse.json(
          { data: null, error: 'No valid keywords provided' },
          { status: 400 }
        )
      }

      // Validate project_id
      const { project_id } = body
      if (!project_id) {
        return NextResponse.json(
          { data: null, error: 'Project ID is required' },
          { status: 400 }
        )
      }

      // Insert keywords (ignore duplicates)
      const keywordObjects = validKeywords.map((k: string) => ({ 
        keyword: k,
        project_id 
      }))
      let { data, error } = await supabase
        .from('keywords')
        .insert(keywordObjects)
        .select()

      if (error) {
        // If some keywords already exist, try inserting them one by one
        if (error.code === '23505' || error.message.includes('duplicate')) {
          // Get existing keywords for this project to skip duplicates
          const { data: existing } = await supabase
            .from('keywords')
            .select('keyword')
            .eq('project_id', project_id)
            .in('keyword', validKeywords)

          const existingKeywords = existing?.map((e) => e.keyword) || []
          const newKeywords = validKeywords.filter((k: string) => !existingKeywords.includes(k))

          if (newKeywords.length === 0) {
            return NextResponse.json(
              { data: existing, error: 'All keywords already exist' },
              { status: 400 }
            )
          }

          const { data: insertedData, error: insertError } = await supabase
            .from('keywords')
            .insert(newKeywords.map((k: string) => ({ 
              keyword: k,
              project_id 
            })))
            .select()

          if (insertError) throw insertError

          // Auto-check rankings for newly added keywords (sequentially to avoid parallel Apify calls)
          if (insertedData && insertedData.length > 0) {
            for (const kw of insertedData) {
              try {
                await checkRankingsForKeyword(kw.id, kw.keyword, supabase)
              } catch (error) {
                console.error(`Error checking rankings for keyword ${kw.keyword}:`, error)
              }
            }
          }

          return NextResponse.json({
            data: insertedData,
            error: null,
            skipped: existingKeywords.length,
            added: newKeywords.length,
          }, { status: 201 })
        }
        throw error
      }

      // Auto-check rankings for newly added keywords (sequentially to avoid parallel Apify calls)
      if (data && data.length > 0) {
        for (const kw of data) {
          try {
            await checkRankingsForKeyword(kw.id, kw.keyword, supabase)
          } catch (error) {
            console.error(`Error checking rankings for keyword ${kw.keyword}:`, error)
          }
        }
      }

      return NextResponse.json({
        data,
        error: null,
        added: validKeywords.length,
      }, { status: 201 })
    }

    // Handle single keyword insert
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { data: null, error: 'Keyword is required' },
        { status: 400 }
      )
    }

    const { project_id } = body
    if (!project_id) {
      return NextResponse.json(
        { data: null, error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('keywords')
      .insert([{ 
        keyword: keyword.trim(),
        project_id 
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { data: null, error: 'Keyword already exists' },
          { status: 400 }
        )
      }
      throw error
    }

    // Auto-check rankings for newly added keyword (sequential processing)
    if (data) {
      try {
        await checkRankingsForKeyword(data.id, data.keyword, supabase)
      } catch (error) {
        console.error(`Error checking rankings for keyword ${data.keyword}:`, error)
      }
    }

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (error) {
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
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    // Handle bulk deletion
    if (ids) {
      try {
        const idsArray = JSON.parse(ids)
        if (!Array.isArray(idsArray) || idsArray.length === 0) {
          return NextResponse.json(
            { data: null, error: 'Invalid IDs array' },
            { status: 400 }
          )
        }

        const { error } = await supabase
          .from('keywords')
          .delete()
          .in('id', idsArray)

        if (error) throw error

        return NextResponse.json({ 
          data: { success: true, deletedCount: idsArray.length }, 
          error: null 
        })
      } catch (parseError) {
        return NextResponse.json(
          { data: null, error: 'Invalid IDs format' },
          { status: 400 }
        )
      }
    }

    // Handle single deletion
    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Keyword ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
