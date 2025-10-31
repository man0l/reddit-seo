-- Create keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reddit_posts table
CREATE TABLE IF NOT EXISTS reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  post_title TEXT NOT NULL,
  subreddit TEXT NOT NULL,
  rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 10),
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(keyword_id, post_url)
);

-- Create rankings_history table
CREATE TABLE IF NOT EXISTS rankings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_post_id UUID NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 10),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_keyword_id ON reddit_posts(keyword_id);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_rank_position ON reddit_posts(rank_position);
CREATE INDEX IF NOT EXISTS idx_rankings_history_reddit_post_id ON rankings_history(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_rankings_history_checked_at ON rankings_history(checked_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for keywords table
CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for now (no auth)
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (no auth, so allow all)
CREATE POLICY "Allow all operations on keywords" ON keywords
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on reddit_posts" ON reddit_posts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on rankings_history" ON rankings_history
  FOR ALL USING (true) WITH CHECK (true);

