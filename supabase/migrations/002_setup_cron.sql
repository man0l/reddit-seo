-- Enable pg_cron extension (if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: Vault extension should already be enabled in Supabase
-- If not, enable it via Dashboard > Database > Extensions

-- Create a function to call the refresh rankings Edge Function
CREATE OR REPLACE FUNCTION refresh_all_keyword_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT;
  anon_key TEXT;
  function_url TEXT;
  response_id BIGINT;
BEGIN
  -- Get project URL from Vault
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';
  
  IF project_url IS NULL THEN
    RAISE EXCEPTION 'Secret "project_url" not found in Vault. Please create it first.';
  END IF;
  
  -- Get anon key from Vault
  SELECT decrypted_secret INTO anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key';
  
  IF anon_key IS NULL THEN
    RAISE EXCEPTION 'Secret "anon_key" not found in Vault. Please create it first.';
  END IF;
  
  -- Construct Edge Function URL
  function_url := project_url || '/functions/v1/refresh-rankings';
  
  -- Make HTTP POST request to Edge Function
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  -- Log the request ID (optional)
  RAISE NOTICE 'Refresh rankings request sent to Edge Function with ID: %', response_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_all_keyword_rankings() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_keyword_rankings() TO anon;

-- Schedule cron job to run daily at 2 AM UTC
SELECT cron.schedule(
  'refresh-reddit-rankings',
  '0 2 * * *', -- Daily at 2 AM UTC (cron format: minute hour day month weekday)
  $$SELECT refresh_all_keyword_rankings();$$
);

-- To update the schedule later:
-- SELECT cron.alter_job('refresh-reddit-rankings', schedule := '0 2 * * *');

-- To remove the job:
-- SELECT cron.unschedule('refresh-reddit-rankings');

-- To list all cron jobs:
-- SELECT * FROM cron.job;

