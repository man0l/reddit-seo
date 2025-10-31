import { supabase } from '@/lib/supabase'

interface DataForSEOResult {
  location_code: number
  language_code: string
  check_url: string
  datetime: string
  items_count: number
  items: Array<{
    type: string
    rank_group: number
    rank_absolute: number
    position: string
    xpath: string
    title?: string
    domain?: string
    url?: string
    breadcrumb?: string
    website_name?: string
    is_featured_snippet?: boolean
    is_paid?: boolean
    is_malicious?: boolean
    is_web_story?: boolean
    description?: string
  }>
}

interface RedditPostData {
  post_url: string
  post_title: string
  subreddit: string
  rank_position: number
}

interface ApifyScrapedData {
  [key: string]: any
}

async function scrapeRedditPostWithApify(postUrl: string): Promise<ApifyScrapedData | null> {
  const apifyToken = process.env.APIFY_API_TOKEN
  
  if (!apifyToken) {
    console.warn('Apify API token not configured, skipping scraping')
    return null
  }

  try {
    // Use the endpoint pattern provided by the user
    const apiUrl = `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${apifyToken}`
    
    const requestBody = {
      debugMode: false,
      ignoreStartUrls: false,
      includeNSFW: true,
      maxComments: 10,
      maxCommunitiesCount: 2,
      maxItems: 10,
      maxPostCount: 10,
      maxUserCount: 2,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      },
      scrollTimeout: 40,
      searchComments: false,
      searchCommunities: false,
      searchPosts: true,
      searchUsers: false,
      skipComments: true,
      skipCommunity: false,
      skipUserPosts: false,
      sort: 'new',
      startUrls: [
        {
          url: postUrl
        }
      ]
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Apify API error for ${postUrl}: ${response.status} - ${errorText}`)
      return null
    }

    const data = await response.json()
    
    // Return the first item if available, or the whole dataset
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as ApifyScrapedData
    }
    
    return data as ApifyScrapedData
  } catch (error) {
    console.error(`Error scraping Reddit post ${postUrl} with Apify:`, error)
    return null
  }
}

function extractRedditData(url: string, title: string): { subreddit: string; postTitle: string } | null {
  // Reddit URL format: https://www.reddit.com/r/{subreddit}/comments/{post_id}/{slug}/
  const redditMatch = url.match(/reddit\.com\/r\/([^\/]+)/)
  if (!redditMatch) return null

  const subreddit = redditMatch[1]
  // Clean up title - remove [subreddit] prefix if present
  const postTitle = title.replace(/^\[.*?\]\s*/, '').trim()

  return { subreddit, postTitle }
}

export async function checkRankings(keyword: string): Promise<RedditPostData[]> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    throw new Error('DataForSEO credentials not configured')
  }

  // Use keyword directly without site filter to check first Reddit post in SERP
  const searchQuery = keyword

  const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
    },
    body: JSON.stringify([
      {
        keyword: searchQuery,
        location_code: 2840, // United States
        language_code: 'en',
        depth: 10, // First page only (10 results)
        device: 'desktop',
        os: 'windows',
      },
    ]),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  if (!data || !data.tasks || data.tasks.length === 0) {
    throw new Error('No results from DataForSEO API')
  }

  const task = data.tasks[0]
  if (task.status_code !== 20000) {
    throw new Error(`DataForSEO API error: ${task.status_message || 'Unknown error'}`)
  }

  const results: DataForSEOResult[] = task.result || []
  if (results.length === 0) {
    return []
  }

  const result = results[0]
  const redditPosts: RedditPostData[] = []

  // Parse organic results
  for (const item of result.items || []) {
    if (item.type === 'organic' && item.url && item.title) {
      // Check if URL is a Reddit URL
      if (item.url.includes('reddit.com')) {
        const redditData = extractRedditData(item.url, item.title)
        
        if (redditData) {
          const rankPosition = item.rank_absolute || parseInt(item.position) || 0
          
          // Only include first page results (positions 1-10)
          if (rankPosition >= 1 && rankPosition <= 10) {
            redditPosts.push({
              post_url: item.url,
              post_title: redditData.postTitle,
              subreddit: redditData.subreddit,
              rank_position: rankPosition,
            })
          }
        }
      }
    }
  }

  return redditPosts
}

export async function saveRankingsToDatabase(keywordId: string, keywordText: string, redditPosts: RedditPostData[], supabaseClient?: any): Promise<void> {
  // Use provided client or fallback to default (for Edge Functions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseClient || (await import('@/lib/supabase')).supabase
  const now = new Date().toISOString()
  
  if (redditPosts.length === 0) {
    console.log(`No Reddit posts found for keyword: ${keywordText}`)
    return
  }
  
  console.log(`Saving ${redditPosts.length} Reddit posts for keyword: ${keywordText}`)
  
  for (const post of redditPosts) {
    // Scrape post with Apify if not already scraped
    let apifyData: ApifyScrapedData | null = null
    let apifyScrapedAt: string | null = null
    
    // Check if post already exists to see if we need to scrape
    const { data: existingPost, error: checkError } = await supabase
      .from('reddit_posts')
      .select('id, first_seen_at, apify_scraped_at')
      .eq('keyword_id', keywordId)
      .eq('post_url', post.post_url)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error(`Error checking existing post: ${checkError.message}`)
    }

    // Scrape with Apify if post is new or hasn't been scraped recently (e.g., scraped more than 24 hours ago)
    const shouldScrape = !existingPost || !existingPost.apify_scraped_at || 
      (new Date().getTime() - new Date(existingPost.apify_scraped_at).getTime()) > 24 * 60 * 60 * 1000
    
    if (shouldScrape) {
      console.log(`Scraping Reddit post with Apify: ${post.post_url}`)
      apifyData = await scrapeRedditPostWithApify(post.post_url)
      if (apifyData) {
        apifyScrapedAt = now
        console.log(`✓ Successfully scraped Reddit post: ${post.post_url}`)
      } else {
        console.warn(`⚠ Failed to scrape Reddit post (or no data returned): ${post.post_url}`)
      }
      // Add delay between Apify calls to avoid rate limiting and parallel execution issues
      await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 second delay
    }

    if (existingPost) {
      // Update existing post
      const updateData: any = {
        rank_position: post.rank_position,
        post_title: post.post_title,
        subreddit: post.subreddit,
        last_checked_at: now,
      }
      
      if (apifyData && apifyScrapedAt) {
        updateData.apify_scraped_data = apifyData
        updateData.apify_scraped_at = apifyScrapedAt
      }
      
      const { error: updateError } = await supabase
        .from('reddit_posts')
        .update(updateData)
        .eq('id', existingPost.id)

      if (updateError) {
        console.error(`Error updating post ${post.post_url}:`, updateError)
      } else {
        console.log(`✓ Updated post: ${post.post_url}`)
      }

      // Add to history
      await supabase
        .from('rankings_history')
        .insert({
          reddit_post_id: existingPost.id,
          rank_position: post.rank_position,
          checked_at: now,
        })
    } else {
      // Insert new post
      const insertData: any = {
        keyword_id: keywordId,
        post_url: post.post_url,
        post_title: post.post_title,
        subreddit: post.subreddit,
        rank_position: post.rank_position,
        first_seen_at: now,
        last_checked_at: now,
      }
      
      if (apifyData && apifyScrapedAt) {
        insertData.apify_scraped_data = apifyData
        insertData.apify_scraped_at = apifyScrapedAt
      }
      
      const { data: newPost, error: insertError } = await supabase
        .from('reddit_posts')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error(`Error inserting post ${post.post_url}:`, insertError)
        console.error(`Insert data:`, JSON.stringify(insertData, null, 2))
      } else if (newPost) {
        console.log(`✓ Inserted new post: ${post.post_url}`)
        // Add to history
        await supabase
          .from('rankings_history')
          .insert({
            reddit_post_id: newPost.id,
            rank_position: post.rank_position,
            checked_at: now,
          })
      }
    }
  }

  // Remove posts that are no longer ranking (not in current results)
  if (redditPosts.length > 0) {
    const { data: allPosts } = await supabase
      .from('reddit_posts')
      .select('id, post_url')
      .eq('keyword_id', keywordId)

    if (allPosts) {
      const currentUrls = redditPosts.map((p) => p.post_url)
      const postsToDelete = allPosts
        .filter((post: { post_url: string }) => !currentUrls.includes(post.post_url))
        .map((post: { id: string }) => post.id)

      if (postsToDelete.length > 0) {
        await supabase
          .from('reddit_posts')
          .delete()
          .in('id', postsToDelete)
      }
    }
  } else {
    // If no posts found, remove all existing posts for this keyword
    await supabase
      .from('reddit_posts')
      .delete()
      .eq('keyword_id', keywordId)
  }
}

