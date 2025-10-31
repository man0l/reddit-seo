import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface DataForSEOResult {
  location_code: number;
  language_code: string;
  check_url: string;
  datetime: string;
  items_count: number;
  items: Array<{
    type: string;
    rank_group: number;
    rank_absolute: number;
    position: string;
    xpath: string;
    title?: string;
    domain?: string;
    url?: string;
    breadcrumb?: string;
    website_name?: string;
    is_featured_snippet?: boolean;
    is_paid?: boolean;
    is_malicious?: boolean;
    is_web_story?: boolean;
    description?: string;
  }>;
}

interface RedditPostData {
  post_url: string;
  post_title: string;
  subreddit: string;
  rank_position: number;
}

interface ApifyScrapedData {
  [key: string]: any;
}

async function scrapeRedditPostWithApify(postUrl: string): Promise<ApifyScrapedData | null> {
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  
  if (!apifyToken) {
    console.warn("[scrapeRedditPostWithApify] Apify API token not configured, skipping scraping");
    return null;
  }

  try {
    // Use the endpoint pattern provided by the user
    const apiUrl = `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${apifyToken}`;
    
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
        apifyProxyGroups: ["RESIDENTIAL"],
      },
      scrollTimeout: 40,
      searchComments: false,
      searchCommunities: false,
      searchPosts: true,
      searchUsers: false,
      skipComments: true,
      skipCommunity: false,
      skipUserPosts: false,
      sort: "new",
      startUrls: [
        {
          url: postUrl,
        },
      ],
    };

    console.log(`[scrapeRedditPostWithApify] Scraping: ${postUrl}`);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[scrapeRedditPostWithApify] API error for ${postUrl}: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Return the first item if available, or the whole dataset
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[scrapeRedditPostWithApify] Successfully scraped ${postUrl}, got ${data.length} items`);
      return data[0] as ApifyScrapedData;
    }
    
    console.log(`[scrapeRedditPostWithApify] Successfully scraped ${postUrl}`);
    return data as ApifyScrapedData;
  } catch (error) {
    console.error(`[scrapeRedditPostWithApify] Error scraping Reddit post ${postUrl} with Apify:`, error);
    return null;
  }
}

function extractRedditData(url: string, title: string): { subreddit: string; postTitle: string } | null {
  const redditMatch = url.match(/reddit\.com\/r\/([^\/]+)/);
  if (!redditMatch) return null;

  const subreddit = redditMatch[1];
  const postTitle = title.replace(/^\[.*?\]\s*/, "").trim();

  return { subreddit, postTitle };
}

async function checkRankings(keyword: string): Promise<RedditPostData[]> {
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const password = Deno.env.get("DATAFORSEO_PASSWORD");

  if (!login || !password) {
    console.error("[checkRankings] Missing DataForSEO credentials");
    throw new Error("DataForSEO credentials not configured");
  }

  const searchQuery = keyword;
  console.log(`[checkRankings] Checking rankings for: "${searchQuery}"`);

  const response = await fetch(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${login}:${password}`)}`,
      },
      body: JSON.stringify([
        {
          keyword: searchQuery,
          location_code: 2840,
          language_code: "en",
          depth: 10,
          device: "desktop",
          os: "windows",
        },
      ]),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data || !data.tasks || data.tasks.length === 0) {
    throw new Error("No results from DataForSEO API");
  }

  const task = data.tasks[0];
  if (task.status_code !== 20000) {
    throw new Error(
      `DataForSEO API error: ${task.status_message || "Unknown error"}`
    );
  }

  const results: DataForSEOResult[] = task.result || [];
  if (results.length === 0) {
    return [];
  }

  const result = results[0];
  const redditPosts: RedditPostData[] = [];

  for (const item of result.items || []) {
    if (item.type === "organic" && item.url && item.title) {
      if (item.url.includes("reddit.com")) {
        const redditData = extractRedditData(item.url, item.title);

        if (redditData) {
          const rankPosition = item.rank_absolute || parseInt(item.position) || 0;

          if (rankPosition >= 1 && rankPosition <= 10) {
            redditPosts.push({
              post_url: item.url,
              post_title: redditData.postTitle,
              subreddit: redditData.subreddit,
              rank_position: rankPosition,
            });
          }
        }
      }
    }
  }

  return redditPosts;
}

async function saveRankingsToDatabase(
  supabase: any,
  keywordId: string,
  keywordText: string,
  redditPosts: RedditPostData[]
): Promise<void> {
  const now = new Date().toISOString();

  for (const post of redditPosts) {
    // Scrape post with Apify if not already scraped
    let apifyData: ApifyScrapedData | null = null;
    let apifyScrapedAt: string | null = null;
    
    // Check if post already exists to see if we need to scrape
    const { data: existingPost } = await supabase
      .from("reddit_posts")
      .select("id, first_seen_at, apify_scraped_at")
      .eq("keyword_id", keywordId)
      .eq("post_url", post.post_url)
      .single();

    // Scrape with Apify if post is new or hasn't been scraped recently (e.g., scraped more than 24 hours ago)
    const shouldScrape = !existingPost || !existingPost.apify_scraped_at || 
      (new Date().getTime() - new Date(existingPost.apify_scraped_at).getTime()) > 24 * 60 * 60 * 1000;
    
    if (shouldScrape) {
      console.log(`[saveRankingsToDatabase] Scraping Reddit post with Apify: ${post.post_url}`);
      apifyData = await scrapeRedditPostWithApify(post.post_url);
      if (apifyData) {
        apifyScrapedAt = now;
      }
      // Add delay between Apify calls to avoid rate limiting and parallel execution issues
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
    }

    if (existingPost) {
      // Update existing post
      const updateData: any = {
        rank_position: post.rank_position,
        post_title: post.post_title,
        subreddit: post.subreddit,
        last_checked_at: now,
      };
      
      if (apifyData && apifyScrapedAt) {
        updateData.apify_scraped_data = apifyData;
        updateData.apify_scraped_at = apifyScrapedAt;
      }
      
      await supabase
        .from("reddit_posts")
        .update(updateData)
        .eq("id", existingPost.id);

      await supabase.from("rankings_history").insert({
        reddit_post_id: existingPost.id,
        rank_position: post.rank_position,
        checked_at: now,
      });
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
      };
      
      if (apifyData && apifyScrapedAt) {
        insertData.apify_scraped_data = apifyData;
        insertData.apify_scraped_at = apifyScrapedAt;
      }
      
      const { data: newPost } = await supabase
        .from("reddit_posts")
        .insert(insertData)
        .select()
        .single();

      if (newPost) {
        await supabase.from("rankings_history").insert({
          reddit_post_id: newPost.id,
          rank_position: post.rank_position,
          checked_at: now,
        });
      }
    }
  }

  if (redditPosts.length > 0) {
    const { data: allPosts } = await supabase
      .from("reddit_posts")
      .select("id, post_url")
      .eq("keyword_id", keywordId);

    if (allPosts) {
      const currentUrls = redditPosts.map((p) => p.post_url);
      const postsToDelete = allPosts
        .filter((post) => !currentUrls.includes(post.post_url))
        .map((post) => post.id);

      if (postsToDelete.length > 0) {
        await supabase.from("reddit_posts").delete().in("id", postsToDelete);
      }
    }
  } else {
    await supabase.from("reddit_posts").delete().eq("keyword_id", keywordId);
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log("[refresh-rankings] Function started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dataforseoLogin = Deno.env.get("DATAFORSEO_LOGIN");
    const dataforseoPassword = Deno.env.get("DATAFORSEO_PASSWORD");

    console.log("[refresh-rankings] Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      hasDataForSEOLogin: !!dataforseoLogin,
      hasDataForSEOPassword: !!dataforseoPassword,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[refresh-rankings] Fetching keywords...");
    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, keyword");

    if (keywordsError) {
      console.error("[refresh-rankings] Error fetching keywords:", keywordsError);
      throw keywordsError;
    }

    console.log(`[refresh-rankings] Found ${keywords?.length || 0} keywords`);

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No keywords to check",
          checked: 0,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];
    let processedCount = 0;

    for (const keyword of keywords) {
      try {
        console.log(`[refresh-rankings] Processing keyword ${processedCount + 1}/${keywords.length}: "${keyword.keyword}"`);
        const keywordStartTime = Date.now();
        
        const redditPosts = await checkRankings(keyword.keyword);
        console.log(`[refresh-rankings] Found ${redditPosts.length} Reddit posts for "${keyword.keyword}"`);
        
        await saveRankingsToDatabase(
          supabase,
          keyword.id,
          keyword.keyword,
          redditPosts
        );
        
        const keywordDuration = Date.now() - keywordStartTime;
        console.log(`[refresh-rankings] Completed "${keyword.keyword}" in ${keywordDuration}ms`);
        
        results.push({
          keyword: keyword.keyword,
          success: true,
          postsCount: redditPosts.length,
          durationMs: keywordDuration,
        });
      } catch (error) {
        console.error(`[refresh-rankings] Error processing keyword "${keyword.keyword}":`, error);
        results.push({
          keyword: keyword.keyword,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
        });
      }
      processedCount++;
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const totalDuration = Date.now() - startTime;

    console.log(`[refresh-rankings] Completed in ${totalDuration}ms. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({
        message: "Cron job completed",
        checked: keywords.length,
        successful: successCount,
        failed: failureCount,
        totalDurationMs: totalDuration,
        results,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[refresh-rankings] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

