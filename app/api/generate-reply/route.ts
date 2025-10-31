import { NextRequest, NextResponse } from 'next/server'

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

function buildPrompt(params: {
  postUrl: string
  businessDescription: string
  style: 'casual' | 'laconic'
  scraped?: ApifyScrapedItem | null
}) {
  const { postUrl, businessDescription, style, scraped } = params
  const tone = style === 'laconic' ? 'Be short, minimal, helpful, and direct.' : 'Be friendly, natural, and conversational.'
  const postText = scraped?.text || scraped?.content || ''
  const commentsText = Array.isArray(scraped?.comments)
    ? scraped!.comments!.map((c) => c.text || '').filter(Boolean).slice(0, 15).join('\n- ')
    : ''

  const commentsSection = commentsText
    ? `\nThese are some recent comments from the thread. Use them to tailor the reply (do not quote verbatim, paraphrase where needed):\n- ${commentsText}`
    : ''

  return [
    `You are writing a single Reddit comment as a brand representative. ${tone}`,
    `Business description: ${businessDescription}`,
    `Thread URL: ${postUrl}`,
    postText ? `Original post context: ${postText}` : '',
    commentsSection,
    'Requirements: 
- Avoid sounding salesy. Offer genuine help. 
- Include concrete, actionable tips.
- If suggesting your product/service, disclose affiliation transparently in one short line.
- Keep formatting Reddit-friendly (short paragraphs, bullet points if useful). 
- Never include tracking links. No emojis. No hashtags.',
    'Return only the comment text.'
  ].filter(Boolean).join('\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postUrl, businessDescription, style = 'casual', includeComments = false } = body as {
      postUrl: string
      businessDescription: string
      style?: 'casual' | 'laconic'
      includeComments?: boolean
    }

    if (!postUrl || !businessDescription) {
      return NextResponse.json({ data: null, error: 'postUrl and businessDescription are required' }, { status: 400 })
    }

    // Optionally scrape comments
    let scraped: ApifyScrapedItem | null = null
    if (includeComments) {
      const { data, error } = await scrapeReddit(postUrl, true)
      if (!error) scraped = data
    }

    const prompt = buildPrompt({ postUrl, businessDescription, style, scraped })

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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert Reddit community marketer.' },
          { role: 'user', content: prompt },
        ],
        temperature: style === 'laconic' ? 0.5 : 0.8,
        max_tokens: 400,
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

