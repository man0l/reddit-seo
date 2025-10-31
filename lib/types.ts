export interface Project {
  id: string
  name: string
  description?: string
  prompt_template?: string
  subreddit_exclusions?: string[]
  created_at: string
  updated_at: string
}

export interface Keyword {
  id: string
  keyword: string
  project_id: string
  created_at: string
  updated_at: string
}

export interface RedditPost {
  id: string
  keyword_id: string
  post_url: string
  post_title: string
  subreddit: string
  rank_position: number
  first_seen_at: string
  last_checked_at: string
  apify_scraped_data?: any
  apify_scraped_at?: string
}

export interface RankingHistory {
  id: string
  reddit_post_id: string
  rank_position: number
  checked_at: string
}

export interface RedditPostWithKeyword extends RedditPost {
  keyword: string
}

export type ReplyStyle = 'casual' | 'laconic'

export interface ReplyStyleConfig {
  tone: string
  temperature: number
  maxTokens: number
}

export const REPLY_STYLES: Record<ReplyStyle, ReplyStyleConfig> = {
  casual: {
    tone: 'Be friendly, natural, and conversational. Straight on the point.',
    temperature: 0.3,
    maxTokens: 400,
  },
  laconic: {
    tone: 'Be short, minimal, helpful, and direct.',
    temperature: 0.3,
    maxTokens: 400,
  },
}

