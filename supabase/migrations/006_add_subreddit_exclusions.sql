-- Add subreddit_exclusions column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS subreddit_exclusions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for better query performance (using GIN index for array searches)
CREATE INDEX IF NOT EXISTS idx_projects_subreddit_exclusions ON projects USING GIN(subreddit_exclusions);

