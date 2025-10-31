import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

async function getProjectTemplate(postUrl: string): Promise<string | null> {
  // Get project_id through keyword -> reddit_post relationship
  const { data: postData } = await supabase
    .from('reddit_posts')
    .select('keyword_id, keywords!inner(project_id)')
    .eq('post_url', postUrl)
    .single()

  if (!postData || !(postData as any).keywords) {
    return null
  }

  const projectId = (postData as any).keywords.project_id

  // Get project template
  const { data: projectData } = await supabase
    .from('projects')
    .select('prompt_template')
    .eq('id', projectId)
    .single()

  return projectData?.prompt_template || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postUrl, businessDescription, style = 'casual', includeComments = false } = body as {
      postUrl: string
      businessDescription: string
      style?: ReplyStyle
      includeComments?: boolean
    }

    // Validate style
    if (style && !REPLY_STYLES[style as ReplyStyle]) {
      return NextResponse.json({ data: null, error: `Invalid style. Must be one of: ${Object.keys(REPLY_STYLES).join(', ')}` }, { status: 400 })
    }
    
    const validatedStyle = (style || 'casual') as ReplyStyle
    const styleConfig = REPLY_STYLES[validatedStyle]

    if (!postUrl || !businessDescription) {
      return NextResponse.json({ data: null, error: 'postUrl and businessDescription are required' }, { status: 400 })
    }

    // Get project template
    const projectTemplate = await getProjectTemplate(postUrl)
    
    // Fallback to default template if no project template exists
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

    const template = projectTemplate || defaultTemplate

    // First, try to get stored post data from database
    let scraped: ApifyScrapedItem | null = null
    const { data: dbPost } = await supabase
      .from('reddit_posts')
      .select('apify_scraped_data')
      .eq('post_url', postUrl)
      .single()

    if (dbPost?.apify_scraped_data) {
      // Use stored data (includes post content like text/content)
      // Note: Ranking checks use skipComments: true, so stored data typically won't have comments
      scraped = dbPost.apify_scraped_data as ApifyScrapedItem
      
      // Check if comments exist in stored data (they won't if scraped with skipComments: true)
      const hasComments = scraped.comments && 
                         Array.isArray(scraped.comments) && 
                         scraped.comments.length > 0
      
      // If user wants comments but stored data doesn't have them, scrape fresh
      if (includeComments && !hasComments) {
        const { data, error } = await scrapeReddit(postUrl, true)
        if (!error && data) {
          // Merge fresh comments into stored data (keep stored post content)
          scraped = {
            ...scraped,
            comments: data.comments || scraped.comments,
            numberOfComments: data.numberOfComments || scraped.numberOfComments
          }
        }
      }
    } else {
      // No stored data - scrape fresh to get post content
      // Use includeComments flag to determine if we should fetch comments too
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

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ data: null, error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'You are an expert Reddit community marketer.' },
          { role: 'user', content: prompt },
        ],
        //temperature: styleConfig.temperature,
        //max_tokens: styleConfig.maxTokens,
      }),
    })

    if (!completion.ok) {
      const err = await completion.text()
      return NextResponse.json({ data: null, error: `OpenAI API error ${completion.status}: ${err}` }, { status: 500 })
    }

    const result = await completion.json()
    const reply = result.choices?.[0]?.message?.content?.trim() || ''

    return NextResponse.json({ data: { reply }, error: null })
  } catch (e) {
    return NextResponse.json({ data: null, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

