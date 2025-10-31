-- Add column to store Apify scraped data
ALTER TABLE reddit_posts 
ADD COLUMN IF NOT EXISTS apify_scraped_data JSONB,
ADD COLUMN IF NOT EXISTS apify_scraped_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_reddit_posts_apify_scraped_at ON reddit_posts(apify_scraped_at);

