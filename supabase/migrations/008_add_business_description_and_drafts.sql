-- Create table for user business descriptions
CREATE TABLE IF NOT EXISTS business_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_business_descriptions_user_id ON business_descriptions(user_id);

-- Create table for reply drafts
CREATE TABLE IF NOT EXISTS reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_url TEXT NOT NULL,
  draft_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_url)
);

-- Create index for user_id and post_url lookups
CREATE INDEX IF NOT EXISTS idx_reply_drafts_user_id ON reply_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_post_url ON reply_drafts(post_url);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_user_post ON reply_drafts(user_id, post_url);

-- Enable RLS
ALTER TABLE business_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies for business_descriptions
CREATE POLICY "Users can view own business description" ON business_descriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business description" ON business_descriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business description" ON business_descriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own business description" ON business_descriptions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for reply_drafts
CREATE POLICY "Users can view own reply drafts" ON reply_drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reply drafts" ON reply_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reply drafts" ON reply_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reply drafts" ON reply_drafts
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_business_descriptions_updated_at
  BEFORE UPDATE ON business_descriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_drafts_updated_at
  BEFORE UPDATE ON reply_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

