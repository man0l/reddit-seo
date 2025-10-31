# Cron Job Setup Instructions - Using Supabase Edge Functions

This setup uses Supabase Edge Functions with pg_cron to automatically refresh rankings daily.

## Step 1: Deploy the Edge Function

1. Install Supabase CLI if you haven't already:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Set Edge Function secrets:
```bash
supabase secrets set DATAFORSEO_LOGIN=your_dataforseo_login
supabase secrets set DATAFORSEO_PASSWORD=your_dataforseo_password
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set APIFY_API_TOKEN=your_apify_api_token  # Optional: for Reddit post scraping
```

5. Deploy the Edge Function:
```bash
supabase functions deploy refresh-rankings
```

## Step 2: Enable Required Extensions

1. Go to your Supabase Dashboard
2. Navigate to Database > Extensions
3. Enable the following extensions:
   - `pg_cron`
   - `pg_net`
   - `vault` (for secrets management)

## Step 3: Store Secrets in Vault

Before running the migration, you need to store your Supabase project URL and anon key in Vault:

1. Go to Database > Vault in your Supabase Dashboard
2. Click "Create Secret" and add:
   - **Name**: `project_url`
   - **Value**: `https://your-project-ref.supabase.co` (replace with your actual project URL)
   - **Description**: Supabase project URL

3. Click "Create Secret" again and add:
   - **Name**: `anon_key`
   - **Value**: Your Supabase anon key (found in Settings > API)
   - **Description**: Supabase anon key for Edge Function authentication

Alternatively, you can use SQL to create secrets:

```sql
-- Store project URL in Vault
SELECT vault.create_secret(
  'https://your-project-ref.supabase.co',
  'project_url',
  'Supabase project URL'
);

-- Store anon key in Vault
SELECT vault.create_secret(
  'your-anon-key-here',
  'anon_key',
  'Supabase anon key'
);
```

## Step 4: Run the Migration

Run the migration file `002_setup_cron.sql` in your Supabase SQL Editor. This will:
- Enable required extensions
- Create the `refresh_all_keyword_rankings()` function that reads secrets from Vault
- Set up the cron job structure

## Step 5: Schedule the Cron Job

Once the secrets are stored in Vault and the migration is run, schedule the cron job:

```sql
SELECT cron.schedule(
  'refresh-reddit-rankings',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$SELECT refresh_all_keyword_rankings();$$
);
```

## Verify the Setup

1. Check if the cron job is scheduled:
```sql
SELECT * FROM cron.job;
```

2. Manually test the Edge Function:
```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/refresh-rankings \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"
```

## Managing the Cron Job

### Update the schedule:
```sql
SELECT cron.alter_job('refresh-reddit-rankings', schedule := '0 3 * * *');
```

### Remove the job:
```sql
SELECT cron.unschedule('refresh-reddit-rankings');
```

### List all cron jobs:
```sql
SELECT * FROM cron.job;
```

## Troubleshooting

- **Edge Function not found**: Make sure you've deployed the function and the project ref is correct
- **pg_cron not available**: Check if your Supabase plan supports pg_cron (available on Pro plan and above)
- **pg_net errors**: Ensure pg_net extension is enabled
- **Function timeout**: Edge Functions have a timeout limit. If you have many keywords, consider batching them

## Alternative: Manual Testing

You can also manually trigger the Edge Function by calling it directly:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/refresh-rankings \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"
```

## Notes

- The cron job runs daily at 2 AM UTC by default
- You can adjust the schedule using cron syntax: `minute hour day month weekday`
- The Edge Function uses the service role key to access the database
- Make sure your DataForSEO credentials are set as Edge Function secrets
- **Optional**: Set `APIFY_API_TOKEN` secret to enable Reddit post scraping with Apify
- Secrets are stored encrypted in Vault and decrypted on-the-fly when needed
- The function will raise an exception if secrets are not found in Vault
- Reddit posts will be automatically scraped with Apify when found (if token is configured)
