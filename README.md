# 🇬🇪 Georgia Trip Planner 2026

Collaborative trip planning app for our Georgia adventure (Aug 8–20, 2026).  
Vote, rate, and comment on 38+ experiences across 7 regions to build the perfect itinerary together.

## Features

- **🗺️ Browse Regions** — Tbilisi, Mtskheta, Kakheti, Kazbegi, Borjomi, Kutaisi, Uplistsikhe
- **🗳️ Vote** — Want to go / Maybe / Skip on every experience
- **⭐ Rate** — 1–5 stars on how appealing each place sounds
- **💬 Comment** — Add notes, tips, or concerns
- **📊 Consensus** — See group favorites ranked by popularity, filter by region/tag
- **📋 Day Plan** — Read-only locked itinerary
- **🔄 Real-time** — Everyone sees each other's votes live via Supabase

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Realtime)
- **Vanilla CSS** (custom design system)
- **Vercel** (deployment)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In the SQL Editor, paste and run the contents of `supabase/schema.sql`
3. Copy your **Project URL** and **anon/public key** from Settings > API

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

## Updating User Names

Edit the `USERS` array in `src/lib/data.js` to set real names and emojis for each trip member.  
Then re-run the SQL `INSERT INTO users ...` in `supabase/schema.sql` (or update directly in Supabase Table Editor).

## Currency

All prices shown in ₾ (Georgian Lari), ₹ (Indian Rupee), and AED.  
Rate: ₾1 ≈ ₹36 ≈ AED 1.37 — reconfirm before the trip.
