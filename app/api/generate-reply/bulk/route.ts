import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReplyStyle, REPLY_STYLES } from '@/lib/types'
import { replaceTemplateVariables, buildTemplateVariables } from '@/lib/template'

interface ApifyScrapedItem {
  title?: string
  text?: string
  content?: string
  comments?: Array<{ text?: string }>
  numberOfComments?: number
}

async function scrapeReddit(postUrl: string, includeComments: boolean) {
  const apifyToken = process.env.APIFY_API_TOKEN
  if (!apifyToken) return { data: null, error: 'APIFY_API_TOKEN not configured' }

  const apiUrl = `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${apifyToken}`
  const requestBody = {
    debugMode: false,
    ignoreStartUrls: false,
    includeNSFW: true,
    maxComments: 25,
    maxCommunitiesCount: 1,
    maxItems: 1,
    maxPostCount: 1,
    maxUserCount: 0,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL']
    },
    scrollTimeout: 40,
    searchComments: false,
    searchCommunities: false,
    searchPosts: true,
    searchUsers: false,
    skipComments: !includeComments ? true : false,
    skipCommunity: true,
    skipUserPosts: true,
    sort: 'new',
    startUrls: [{ url: postUrl }],
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    return { data: null, error: `Apify error ${res.status}` }
  }
  const json = await res.json()
  const item: ApifyScrapedItem | null = Array.isArray(json) && json.length > 0 ? json[0] : json
  return { data: item as ApifyScrapedItem, error: null }
}

async function getProjectTemplate(postUrl: string, supabase: any): Promise<string | null> {
  try {
    const { data: { user }, error: authCheckError } = await supabase.auth.getUser()
    if (authCheckError || !user) {
      return null
    }

    const { data: postsData, error: postError } = await supabase
      .from('reddit_posts')
      .select('keyword_id')
      .eq('post_url', postUrl)
      .limit(1)

    if (postError || !postsData || postsData.length === 0 || !postsData[0]?.keyword_id) {
      return null
    }

    const { data: keywordData, error: keywordError } = await supabase
      .from('keywords')
      .select('project_id')
      .eq('id', postsData[0].keyword_id)
      .single()

    if (keywordError || !keywordData?.project_id) {
      return null
    }

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('prompt_template')
      .eq('id', keywordData.project_id)
      .single()

    if (projectError) {
      return null
    }

    return projectData?.prompt_template || null
  } catch (error) {
    return null
  }
}

async function checkDraftExists(postUrl: string, supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('reply_drafts')
      .select('draft_content')
      .eq('post_url', postUrl)
      .single()

    return !error && data && data.draft_content && data.draft_content.length > 0
  } catch {
    return false
  }
}

async function saveDraft(postUrl: string, reply: string, supabase: any): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('reply_drafts')
      .upsert({
        user_id: user.id,
        post_url: postUrl,
        draft_content: reply,
      }, {
        onConflict: 'user_id,post_url'
      })

    return !error
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 
      postUrls, 
      businessDescription, 
      style = 'casual', 
      includeComments = false 
    } = body as {
      postUrls: string[]
      businessDescription: string
      style?: ReplyStyle
      includeComments?: boolean
    }

    if (!Array.isArray(postUrls) || postUrls.length === 0) {
      return NextResponse.json({ data: null, error: 'postUrls array is required' }, { status: 400 })
    }

    if (!businessDescription) {
      return NextResponse.json({ data: null, error: 'businessDescription is required' }, { status: 400 })
    }

    // Validate style
    if (style && !REPLY_STYLES[style as ReplyStyle]) {
      return NextResponse.json({ data: null, error: `Invalid style. Must be one of: ${Object.keys(REPLY_STYLES).join(', ')}` }, { status: 400 })
    }

    const validatedStyle = (style || 'casual') as ReplyStyle
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const defaultTemplate = `You are writing a single Reddit comment as a customer used of a business service. Use this tone: {{tone}}

Business description: {{businessDescription}}

Thread URL: {{postUrl}}

{{postText}}

{{commentsText}}

Requirements:
- Avoid sounding salesy. Offer genuine help.
- Include concrete, actionable tips.
- If suggesting your product/service, disclose affiliation transparently in one short line.
- Keep formatting Reddit-friendly (short paragraphs, bullet points if useful).
- Never include tracking links. No emojis. No hashtags.
- Never mention an affiliation with the business in the reply.
- Never add call to action
- Never mention free. Paraphrase the word free.
- Don't use markdown.
- Mention the business name not in the beggining of the reply. Prefrrably somewere naturally inside, otherwise at the end.

Return only the comment text.`

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ data: null, error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const results: Array<{
      postUrl: string
      success: boolean
      reply?: string
      error?: string
      skipped?: boolean
    }> = []

    // Process sequentially
    for (const postUrl of postUrls) {
      try {
        // Check if draft already exists
        const hasDraft = await checkDraftExists(postUrl, supabase)
        if (hasDraft) {
          results.push({
            postUrl,
            success: false,
            skipped: true,
            error: 'Draft already exists'
          })
          continue
        }

        // Get project template
        const projectTemplate = await getProjectTemplate(postUrl, supabase)
        const template = projectTemplate || defaultTemplate

        // Get stored post data or scrape
        let scraped: ApifyScrapedItem | null = null
        const { data: dbPosts } = await supabase
          .from('reddit_posts')
          .select('apify_scraped_data')
          .eq('post_url', postUrl)
          .limit(1)
        
        const dbPost = dbPosts && dbPosts.length > 0 ? dbPosts[0] : null

        if (dbPost?.apify_scraped_data) {
          scraped = dbPost.apify_scraped_data as ApifyScrapedItem
          const hasComments = scraped.comments && 
                             Array.isArray(scraped.comments) && 
                             scraped.comments.length > 0
          
          if (includeComments && !hasComments) {
            const { data, error } = await scrapeReddit(postUrl, true)
            if (!error && data) {
              scraped = {
                ...scraped,
                comments: data.comments || scraped.comments,
                numberOfComments: data.numberOfComments || scraped.numberOfComments
              }
            }
          }
        } else {
          const { data, error } = await scrapeReddit(postUrl, includeComments)
          if (!error) scraped = data
        }

        // Build template variables
        const variables = buildTemplateVariables({
          businessDescription,
          style: validatedStyle,
          postUrl,
          scraped: scraped ? {
            text: scraped.text,
            content: scraped.content,
            comments: scraped.comments,
            title: scraped.title,
          } : null,
        })

        // Replace variables in template
        const prompt = replaceTemplateVariables(template, variables)

        // Generate reply with OpenAI
        const completion = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert Reddit community marketer.' },
              { role: 'user', content: prompt },
            ],
          }),
        })

        if (!completion.ok) {
          const err = await completion.text()
          results.push({
            postUrl,
            success: false,
            error: `OpenAI API error ${completion.status}`
          })
          continue
        }

        const result = await completion.json()
        const reply = result.choices?.[0]?.message?.content?.trim() || ''

        if (!reply) {
          results.push({
            postUrl,
            success: false,
            error: 'Empty reply generated'
          })
          continue
        }

        // Save draft
        const draftSaved = await saveDraft(postUrl, reply, supabase)
        if (!draftSaved) {
          console.warn('Failed to save draft for postUrl:', postUrl)
        }

        results.push({
          postUrl,
          success: true,
          reply
        })

        // Add delay between requests to avoid rate limiting (1.5 seconds)
        if (postUrls.indexOf(postUrl) < postUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      } catch (error) {
        results.push({
          postUrl,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const skippedCount = results.filter(r => r.skipped).length
    const errorCount = results.filter(r => !r.success && !r.skipped).length

    return NextResponse.json({
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          skipped: skippedCount,
          errors: errorCount
        }
      },
      error: null
    })
  } catch (e) {
    return NextResponse.json({ data: null, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

