-- Migration 02 — places added from the "13-day road-trip loop" PDF
-- (Svaneti region + 20 new experiences.)
-- NOTE: these rows are also inserted automatically by the app tooling via
-- the REST API; this file is the reproducible source of truth. Running it
-- again is safe (ON CONFLICT DO NOTHING).

INSERT INTO regions (id, name, icon, subtitle, sort_order) VALUES
  ('svaneti', 'Svaneti (Mestia & Ushguli)', '🗼', 'Medieval towers & big mountains (the road-trip add-on)', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiences (id, region_id, name, description, time_needed, price_lari, price_rupee, price_aed, tags, sort_order) VALUES
  ('kakheti-david-gareja', 'kakheti', 'David Gareja Monastery Complex', 'Remote cave-monastery on the semi-desert ridge (road conditions permitting)', 'half day', 'Free (4×4 advised)', '—', '—', ARRAY['cave','scenic'], 6),
  ('kakheti-alazani-picnic', 'kakheti', 'Alazani Valley Family Picnic', 'Picnic overlooking the valley — churchkhela, local cheeses & juice for the kids', '1–2 hr', '~20–40', '₹720–1,440', 'AED 27–55', ARRAY['kids','wine','scenic'], 7),
  ('kakheti-artisan', 'kakheti', 'Sighnaghi Artisan Workshops', 'Local crafts — carpets, ceramics & felt in the old town lanes', '30–60 min', 'Free to browse', '—', '—', ARRAY['walk'], 8),
  ('kazbegi-sno', 'gudauri-kazbegi', 'Sno Village Stone Heads', 'Giant carved stone faces in a roadside meadow — quick, quirky photo stop', '15–20 min', 'Free', '—', '—', ARRAY['scenic','kids'], 6),
  ('kazbegi-mineral-springs', 'gudauri-kazbegi', 'Military Highway Mineral Springs', 'Fizzy orange travertine springs on the drive up — taste the water', '15 min', 'Free', '—', '—', ARRAY['scenic','kids'], 7),
  ('kazbegi-horse', 'gudauri-kazbegi', 'Kazbegi Horse Riding', 'Guided rides through the valleys — beginner friendly', '1–2 hr', '~50–80/hr', '₹1,800–2,880', 'AED 68–110', ARRAY['kids','scenic'], 8),
  ('kazbegi-honey', 'gudauri-kazbegi', 'Local Honey Tasting', 'Mountain honey farm stop — alpine wildflower varieties', '~30 min', '~10–20', '₹360–720', 'AED 14–27', ARRAY['kids'], 9),
  ('kazbegi-stargazing', 'gudauri-kazbegi', 'Stargazing Night', 'Clear high-altitude skies if weather allows — blankets + hot tea', '~1 hr', 'Free', '—', '—', ARRAY['evening','kids'], 10),
  ('imereti-white-bridge', 'kutaisi-imereti', 'White Bridge & Historic Centre', 'Kutaisi''s landmark bridge + old-town stroll and cafés', '1–1.5 hr', 'Free', '—', '—', ARRAY['evening','walk'], 7),
  ('imereti-bazaar', 'kutaisi-imereti', 'Kutaisi Green Bazaar', 'Bustling local market — fruit, spices, cheese & churchkhela', '30–60 min', 'Free to browse', '—', '—', ARRAY['kids'], 8),
  ('imereti-cooking-class', 'kutaisi-imereti', 'Georgian Cooking Class', 'Family khinkali & khachapuri masterclass (optional)', '2–3 hr', '~80–120 pp', '₹2,880–4,320', 'AED 110–164', ARRAY['kids','wine','cool'], 9),
  ('svaneti-towers', 'svaneti', 'Mestia Svan Towers & Old Quarters', 'Medieval defensive towers + walks through the old neighbourhoods', '1–2 hr', 'Free (tower visit ~10)', '₹360', 'AED 14', ARRAY['scenic','walk','kids'], 1),
  ('svaneti-museum', 'svaneti', 'Svaneti Ethnographic Museum', 'Treasury of icons & Svan artefacts — A/C escape in Mestia', '~1 hr', '~10–20', '₹360–720', 'AED 14–27', ARRAY['cool'], 2),
  ('svaneti-hatsvali', 'svaneti', 'Hatsvali Cable Car', 'Ride above the forest for Ushba & Tetnuldi panoramas', '1–2 hr', '~15–30', '₹540–1,080', 'AED 21–41', ARRAY['scenic','kids','cool'], 3),
  ('svaneti-chalaadi', 'svaneti', 'Chalaadi Glacier Hike', 'Forest trail to a glacier tongue — easy-moderate, cool all day', 'half day', 'Free (transfer ~30)', '₹1,080', 'AED 41', ARRAY['hike','cool','scenic'], 4),
  ('svaneti-kubdari', 'svaneti', 'Kubdari Tasting', 'Traditional Svan spiced-meat pie — the region''s signature dish', '~30 min', '~10–20', '₹360–720', 'AED 14–27', ARRAY['wine','kids'], 5),
  ('svaneti-ushguli', 'svaneti', 'Ushguli Day Trip (UNESCO)', '4×4 through spectacular valleys to Europe''s highest inhabited village', 'full day (~2 hr each way)', '~250–350 per 4×4', '₹9,000–12,600', 'AED 343–480', ARRAY['scenic','kids'], 6),
  ('svaneti-lamaria', 'svaneti', 'Lamaria Church (Ushguli)', '12th-century church on the meadow edge above Ushguli', '20–30 min', 'Free', '—', '—', ARRAY['scenic'], 7),
  ('svaneti-shkhara', 'svaneti', 'Mount Shkhara Viewpoint', 'Georgia''s highest peak (5,193 m) looming over Ushguli — short walks', '30–60 min', 'Free', '—', '—', ARRAY['scenic','walk'], 8),
  ('svaneti-horse', 'svaneti', 'Ushguli Horse Riding', 'Optional ride through the UNESCO village meadows', '1–2 hr', '~50–80/hr', '₹1,800–2,880', 'AED 68–110', ARRAY['scenic'], 9)
ON CONFLICT (id) DO NOTHING;
