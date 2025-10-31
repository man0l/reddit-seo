-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop the unique constraint on keywords.keyword since we want uniqueness per project
ALTER TABLE keywords DROP CONSTRAINT IF EXISTS keywords_keyword_key;

-- Add project_id to keywords table
ALTER TABLE keywords 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Create unique constraint on (project_id, keyword) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_keywords_project_keyword_unique 
ON keywords(project_id, keyword) 
WHERE project_id IS NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_keywords_project_id ON keywords(project_id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no auth, so allow all)
CREATE POLICY "Allow all operations on projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for projects table
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a default project for existing keywords (optional)
-- This allows existing keywords to work without breaking
INSERT INTO projects (name, description) 
VALUES ('Default Project', 'Default project for existing keywords')
ON CONFLICT (name) DO NOTHING;

-- Update existing keywords to belong to the default project
UPDATE keywords 
SET project_id = (SELECT id FROM projects WHERE name = 'Default Project' LIMIT 1)
WHERE project_id IS NULL;

