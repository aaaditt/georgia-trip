-- Georgia Trip Planner — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Users table (pre-seeded, no auth)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧑',
  is_adult BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Regions table
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📍',
  subtitle TEXT,
  sort_order INT DEFAULT 0
);

-- 3. Experiences table
CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  region_id TEXT REFERENCES regions(id),
  name TEXT NOT NULL,
  description TEXT,
  time_needed TEXT,
  price_lari TEXT,
  price_rupee TEXT,
  price_aed TEXT,
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0
);

-- 4. Votes table (one per user per experience)
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  experience_id TEXT REFERENCES experiences(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('go', 'maybe', 'skip')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, experience_id)
);

-- 5. Ratings table (one per user per experience)
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  experience_id TEXT REFERENCES experiences(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, experience_id)
);

-- 6. Comments table (multiple per user per experience)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  experience_id TEXT REFERENCES experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for all interactive tables
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Disable RLS (trusted friend group, no auth needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON regions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON experiences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON comments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Users
INSERT INTO users (id, name, emoji, is_adult) VALUES
  (1, 'Aadit', '😎', true),
  (2, 'Seema', '🌸', true),
  (3, 'Saugat', '🧔', true),
  (4, 'Sharvani', '✨', true),
  (5, 'Shivani', '💜', true),
  (6, 'Nandini', '🌻', false),
  (7, 'Aadya', '🦋', false),
  (8, 'Vyom', '🚀', false)
ON CONFLICT (id) DO NOTHING;

-- Regions
INSERT INTO regions (id, name, icon, subtitle, sort_order) VALUES
  ('tbilisi', 'Tbilisi', '🏙️', 'City, views, culture', 1),
  ('mtskheta', 'Mtskheta & The Drive North', '⛪', 'Ancient capital & gentle adventure', 2),
  ('kakheti', 'Kakheti', '🍇', 'Wine country', 3),
  ('gudauri-kazbegi', 'Gudauri & Kazbegi', '🏔️', 'Alpine, cool, glaciers', 4),
  ('borjomi', 'Borjomi & Bakuriani', '🌿', 'Cool spa mountains', 5),
  ('kutaisi-imereti', 'Kutaisi & Imereti', '🌊', 'Caves, canyons & water', 6),
  ('uplistsikhe', 'Uplistsikhe', '🪨', 'Rock-hewn cave city', 7)
ON CONFLICT (id) DO NOTHING;

-- Experiences
INSERT INTO experiences (id, region_id, name, description, time_needed, price_lari, price_rupee, price_aed, tags, sort_order) VALUES
  ('tbilisi-old-town', 'tbilisi', 'Old Town Wander', 'Lanes, balconies, café streets', '2–3 hr', 'Free', '—', '—', ARRAY['evening','walk'], 1),
  ('tbilisi-bridge-rike', 'tbilisi', 'Bridge of Peace + Rike Park', 'LED footbridge + riverside park', '30–60 min', 'Free', '—', '—', ARRAY['evening','scenic','kids'], 2),
  ('tbilisi-narikala', 'tbilisi', 'Narikala Cable Car + Fortress', '2-min ride up + walls/views', '45 min', '2.5/ride', '₹90', 'AED 3', ARRAY['scenic','kids'], 3),
  ('tbilisi-mtatsminda', 'tbilisi', 'Mtatsminda Funicular + Park', 'Cliff train + hilltop rides/sunset', '2–3 hr', '~6–8 (+rides)', '₹216–288', 'AED 8–11', ARRAY['kids','evening','scenic'], 4),
  ('tbilisi-sulfur-baths', 'tbilisi', 'Sulfur Baths (private room)', 'Soak in the historic domes (per room/hr)', '~1 hr', '50–150', '₹1,800–5,400', 'AED 68–205', ARRAY['cool'], 5),
  ('tbilisi-sulfur-scrub', 'tbilisi', 'Sulfur Scrub ("kisa")', 'Traditional exfoliating scrub', '20 min', '20–50', '₹720–1,800', 'AED 27–68', ARRAY[]::TEXT[], 6),
  ('tbilisi-museum', 'tbilisi', 'Georgian National Museum', 'A/C; gold Treasury highlight', '1–2 hr', '20–30', '₹720–1,080', 'AED 27–41', ARRAY['cool'], 7),
  ('tbilisi-chronicles', 'tbilisi', 'Chronicles of Georgia', 'Giant carved pillars', '30–45 min', 'Free', '—', '—', ARRAY['scenic'], 8),
  ('tbilisi-churches', 'tbilisi', 'Churches (Sameba, Metekhi, Sioni)', 'Cathedrals & old sites', '20–40 min ea', 'Free', '—', '—', ARRAY['scenic'], 9),
  ('tbilisi-dry-bridge', 'tbilisi', 'Dry Bridge Market / Fabrika', 'Flea market / old-factory hangout', '30–60 min', 'Free', '—', '—', ARRAY['evening'], 10),
  ('mtskheta-jvari', 'mtskheta', 'Jvari Monastery', 'Hilltop church + valley viewpoint', '20–30 min', 'Free', '—', '—', ARRAY['scenic'], 1),
  ('mtskheta-svetitskhoveli', 'mtskheta', 'Svetitskhoveli Cathedral', 'UNESCO cathedral', '30–45 min', 'Free', '—', '—', ARRAY['scenic'], 2),
  ('mtskheta-aragvi-raft', 'mtskheta', 'Aragvi Rafting (half-day)', 'Easy grade 2–3 float (gentle in Aug); gear+guide', '1.5–2 hr on water', '120–180', '₹4,320–6,480', 'AED 164–247', ARRAY['water','kids','scenic'], 3),
  ('mtskheta-zhinvali-kayak', 'mtskheta', 'Zhinvali Kayak/Canoe', 'Calm emerald-lake paddle, swimmable', '~2 hr', '~40–50', '₹1,440–1,800', 'AED 55–68', ARRAY['water','kids','cool'], 4),
  ('mtskheta-ananuri', 'mtskheta', 'Ananuri Castle + "I ❤️ Georgia"', 'Lakeside fortress + photo stop', '30–40 min', 'Free', '—', '—', ARRAY['scenic'], 5),
  ('kakheti-winery-tasting', 'kakheti', 'Winery Tasting', 'A flight at a family cellar', '1–1.5 hr', '6–25', '₹216–900', 'AED 8–34', ARRAY['wine'], 1),
  ('kakheti-khareba', 'kakheti', 'Khareba "Wine Tunnel"', 'Taste inside a cool hillside cave', '~1 hr', '~20', '₹720', 'AED 27', ARRAY['cool','wine','kids'], 2),
  ('kakheti-tsinandali', 'kakheti', 'Tsinandali Estate', 'Historic manor, gardens, cellar', '1–2 hr', '10–35', '₹360–1,260', 'AED 14–48', ARRAY['wine','scenic','kids'], 3),
  ('kakheti-supra', 'kakheti', 'Winery Lunch / Supra', 'Big traditional feast w/ wine', '1.5–2 hr', '~30–60', '₹1,080–2,160', 'AED 41–82', ARRAY['wine','kids'], 4),
  ('kakheti-sighnaghi', 'kakheti', 'Sighnaghi Walls + Bodbe', 'Ramparts walk + cypress convent', '1–2 hr', 'Free', '—', '—', ARRAY['scenic','walk'], 5),
  ('kazbegi-friendship', 'gudauri-kazbegi', 'Friendship of Nations Panorama', 'Mosaic balcony over the valley', '20–30 min', 'Free', '—', '—', ARRAY['scenic','walk','kids'], 1),
  ('kazbegi-gergeti', 'gudauri-kazbegi', 'Gergeti Trinity by 4×4', '4×4 up (~20 min) + church/views', 'half-day', '~50–70 (per veh ~50)', '₹1,800–2,520', 'AED 68–96', ARRAY['scenic','walk'], 2),
  ('kazbegi-gveleti', 'gudauri-kazbegi', 'Gveleti Waterfall', 'Easy walk to a falls', '1–1.5 hr', 'Free', '—', '—', ARRAY['cool','walk','kids'], 3),
  ('kazbegi-juta-truso', 'gudauri-kazbegi', 'Juta / Truso Valley', 'Green alpine valleys, flat lower bits', 'half–full day', 'Free (4×4 extra)', '—', '—', ARRAY['cool','hike','scenic'], 4),
  ('kazbegi-paragliding', 'gudauri-kazbegi', 'Gudauri Paragliding (tandem)', 'Float over the valley w/ instructor', 'flight 10–30 min', '~350–500', '₹12,600–18,000', 'AED 480–685', ARRAY['thrill','scenic'], 5),
  ('borjomi-park', 'borjomi', 'Borjomi Central Park', 'Mineral spring + playground + rides', '2–3 hr', '~2–5 (+rides)', '₹70–180', 'AED 3–7', ARRAY['kids','cool'], 1),
  ('borjomi-cable-car', 'borjomi', 'Park Cable Car', 'Up to a forest plateau', '5 min + time', '~2', '₹70', 'AED 3', ARRAY['scenic','cool'], 2),
  ('borjomi-raft', 'borjomi', 'Mtkvari Family Rafting', 'Short 8 km grade-2 float', '~1 hr', 'from ~80', '₹2,880', 'AED 110', ARRAY['water','kids','cool'], 3),
  ('borjomi-np', 'borjomi', 'Borjomi-Kharagauli NP', 'Forested reserve, easy trails', 'half day', 'Free', '—', '—', ARRAY['cool','hike'], 4),
  ('imereti-martvili', 'kutaisi-imereti', 'Martvili Canyon', 'Boat through turquoise gorge + 700 m loop', '1–1.5 hr', '~20 (+boat)', '₹720', 'AED 27', ARRAY['water','cave','kids','scenic'], 1),
  ('imereti-martvili-zip', 'kutaisi-imereti', 'Martvili Zipline', 'Optional zip over the canyon', '15 min', '~60', '₹2,160', 'AED 82', ARRAY['thrill'], 2),
  ('imereti-prometheus', 'kutaisi-imereti', 'Prometheus Cave', '1.4 km lit stalactite halls + optional boat', '1–2 hr', '40 (+boat 30)', '₹1,440 (+₹1,080)', 'AED 55 (+41)', ARRAY['cool','cave','kids','scenic'], 3),
  ('imereti-okatse', 'kutaisi-imereti', 'Okatse Canyon', '780–900 m cliff hanging-walkway', '2–3 hr (incl 2.5 km walk)', '~30 (+4×4 15)', '₹1,080', 'AED 41', ARRAY['scenic','cave','hike'], 4),
  ('imereti-sataplia', 'kutaisi-imereti', 'Sataplia Reserve', 'Dinosaur footprints + glass platform', '1–1.5 hr', '~20', '₹720', 'AED 27', ARRAY['kids','scenic'], 5),
  ('imereti-gelati-bagrati', 'kutaisi-imereti', 'Gelati / Bagrati', 'UNESCO mosaics / hilltop cathedral', '30–45 min ea', 'Free', '—', '—', ARRAY['scenic'], 6),
  ('uplistsikhe-cave', 'uplistsikhe', 'Uplistsikhe Cave Town', 'Explore carved city, tunnels, altars', '1–1.5 hr', '~15–25', '₹540–900', 'AED 21–34', ARRAY['kids','cave','scenic'], 1),
  ('uplistsikhe-gori', 'uplistsikhe', 'Gori / Stalin Museum', 'History stop nearby (optional)', '1–1.5 hr', '~15–25', '₹540–900', 'AED 21–34', ARRAY[]::TEXT[], 2)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for users
SELECT setval('users_id_seq', 8);
