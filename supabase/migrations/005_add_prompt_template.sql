-- Add prompt_template column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS prompt_template TEXT;

-- Set default prompt template for existing projects
UPDATE projects 
SET prompt_template = 'You are writing a single Reddit comment as a customer used of a business service. Use this tone: {{tone}}

Business description: {{businessDescription}}

Thread URL: {{postUrl}}

{{postText}}

{{commentsText}}

Requirements:
- Avoid sounding salesy. Offer genuine help.
- Include concrete, actionable tips.
- If suggesting your product/service, disclose affiliation transparently in one short line.
- Keep formatting Reddit-friendly (short paragraphs, bullet points if useful).
- Never include tracking links. No emojis. No hashtags.
- Never mention an affiliation with the business in the reply.
- Never add call to action
- Never mention free. Paraphrase the word free.
- Don''t use markdown.
- Mention the business name not in the beggining of the reply. Prefrrably somewere naturally inside, otherwise at the end.

Return only the comment text.'
WHERE prompt_template IS NULL;

