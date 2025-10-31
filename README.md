# Reddit SEO Keyword Tracker

A microsaas application that tracks which Reddit posts rank on Google's first page for specific keywords using DataForSEO API.

## Features

- Add and manage keywords (single or bulk)
- **Automatically check rankings** when keywords are added
- Manually refresh rankings for any keyword
- **Daily automatic refresh** via cron job
- Track ranking positions over time
- View rankings history
- Clean, modern UI

## How It Works

1. **Add Keywords**: When you add keywords (single or bulk), the system automatically queues them for ranking checks
2. **Automatic Checking**: Rankings are fetched in the background using DataForSEO API
3. **Manual Refresh**: You can manually refresh rankings anytime using the "Refresh" button
4. **Daily Cron**: A cron job runs daily to refresh all keyword rankings automatically

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **API**: DataForSEO API for SERP analysis
- **Scraping**: Apify Reddit Scraper for detailed post data

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Run the migration file: `supabase/migrations/001_initial_schema.sql`
4. Copy your project URL and anon key from Settings > API

### 3. Set Up DataForSEO

1. Sign up at [dataforseo.com](https://dataforseo.com)
2. Get your login credentials from your account dashboard

### 4. Set Up Apify (Optional)

1. Sign up at [apify.com](https://apify.com)
2. Get your API token from your account settings
3. The app will automatically scrape Reddit posts using Apify when found in SERP results

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

DATAFORSEO_LOGIN=your_dataforseo_login
DATAFORSEO_PASSWORD=your_dataforseo_password

# Optional: Apify API token for Reddit post scraping
APIFY_API_TOKEN=your_apify_api_token
```

### 6. Run Database Migrations

Run the migration files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/003_add_apify_scraped_data.sql` (adds Apify scraping support)

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/
│   ├── page.tsx                 # Dashboard homepage
│   ├── keywords/
│   │   ├── page.tsx            # Keyword management page
│   │   └── [keyword]/page.tsx  # Rankings view for a keyword
│   ├── api/
│   │   ├── keywords/route.ts   # Keyword CRUD API
│   │   └── check-rankings/     # DataForSEO integration API
│   └── layout.tsx
├── components/
│   ├── KeywordForm.tsx         # Add keyword form
│   ├── KeywordList.tsx         # Display keywords list
│   └── RankingsList.tsx        # Display rankings
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── types.ts               # TypeScript types
│   └── rankings.ts            # Shared ranking utilities
└── supabase/
    ├── functions/
    │   └── refresh-rankings/   # Edge Function for cron job
    └── migrations/
        ├── 001_initial_schema.sql
        └── 002_setup_cron.sql
```

## Database Schema

- **keywords**: Stores tracked keywords
- **reddit_posts**: Stores Reddit posts that rank for keywords (includes `apify_scraped_data` JSONB column for scraped post data)
- **rankings_history**: Historical tracking of rank positions

## Usage

1. **Add Keywords**: Navigate to `/keywords` and add keywords you want to track
2. **View Rankings**: Click on any keyword to see which Reddit posts rank on Google's first page
3. **Refresh Rankings**: Use the "Refresh Rankings" button to check current positions

## API Endpoints

- `GET /api/keywords` - Get all keywords
- `POST /api/keywords` - Add a new keyword (auto-checks rankings)
- `DELETE /api/keywords?id={id}` - Delete a keyword
- `GET /api/check-rankings/[keyword]` - Manually check rankings for a keyword
- Edge Function: `refresh-rankings` - Cron endpoint to refresh all keyword rankings (called by pg_cron)

## Cron Job Setup

See [CRON_SETUP.md](./CRON_SETUP.md) for detailed instructions on setting up automatic daily ranking refreshes using Supabase Edge Functions and pg_cron.

## License

MIT
