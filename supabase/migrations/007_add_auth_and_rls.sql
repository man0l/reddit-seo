-- Add user_id to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Update RLS policies for projects to require authentication and user ownership
DROP POLICY IF EXISTS "Allow all operations on projects" ON projects;

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for keywords to require authentication through project ownership
DROP POLICY IF EXISTS "Allow all operations on keywords" ON keywords;

CREATE POLICY "Users can view keywords from own projects" ON keywords
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = keywords.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert keywords to own projects" ON keywords
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = keywords.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update keywords in own projects" ON keywords
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = keywords.project_id 
      AND projects.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = keywords.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete keywords from own projects" ON keywords
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = keywords.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Update RLS policies for reddit_posts to require authentication through project ownership
DROP POLICY IF EXISTS "Allow all operations on reddit_posts" ON reddit_posts;

CREATE POLICY "Users can view posts from own projects" ON reddit_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM keywords
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE keywords.id = reddit_posts.keyword_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert posts to own projects" ON reddit_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM keywords
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE keywords.id = reddit_posts.keyword_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update posts in own projects" ON reddit_posts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM keywords
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE keywords.id = reddit_posts.keyword_id
      AND projects.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM keywords
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE keywords.id = reddit_posts.keyword_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete posts from own projects" ON reddit_posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM keywords
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE keywords.id = reddit_posts.keyword_id
      AND projects.user_id = auth.uid()
    )
  );

-- Update RLS policies for rankings_history to require authentication through project ownership
DROP POLICY IF EXISTS "Allow all operations on rankings_history" ON rankings_history;

CREATE POLICY "Users can view rankings history from own projects" ON rankings_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reddit_posts
      INNER JOIN keywords ON keywords.id = reddit_posts.keyword_id
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE reddit_posts.id = rankings_history.reddit_post_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert rankings history to own projects" ON rankings_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reddit_posts
      INNER JOIN keywords ON keywords.id = reddit_posts.keyword_id
      INNER JOIN projects ON projects.id = keywords.project_id
      WHERE reddit_posts.id = rankings_history.reddit_post_id
      AND projects.user_id = auth.uid()
    )
  );

