// THE PROPOSED PLAN — a researched, hand-crafted route for 3–16 August
// that connects every place the family voted in, with travel modes and
// realistic times for each leg.
//
// Built from the real Supabase votes (7/8 voted; Ushguli unanimous) plus
// online research (July 2026). Key routing decisions:
//  · Kakheti first via Sighnaghi, then the Tianeti back road straight to
//    the Military Highway — no doubling back through Tbilisi.
//  · Raft + kayak day based in Pasanauri (the rafting bases are there).
//  · Svaneti is entered via Zugdidi and EXITED via Ushguli over the
//    Zagari Pass — the road was fully sealed in 2024 (open May–Oct), so
//    Ushguli needs no backtrack day. Saves a full day, all new scenery.
//  · Monday (Aug 10) is the caves' closing day — it's spent on
//    monasteries + the drive to Mestia instead. Caves land Tue & Thu.
//  · Dry Bridge market on Saturday Aug 15 — its best day.
//  · Borjomi is a rich pit-stop on the return leg (park + cable car +
//    Mtkvari raft), keeping the final Tbilisi evening free.
//
// Sources: wander-lush.org (Zagari Pass, Chronicles, Martvili),
// caucasus-trekking.com (Gveleti), madloba.info + georgiantravelguide.com
// (funicular, Hatsvali), pagetraveller.com (Tbilisi cable cars),
// georgia.travel (Aragvi Adventure Center), triplinkhub.com /
// tripadvisor.com (Borjomi ropeway, cave closures), viator/getyourguide
// (cave tour logistics).

export const TRAVEL_MODES = {
  van: { emoji: "🚐", label: "Private van" },
  fourx4: { emoji: "🚙", label: "Local 4×4" },
  walk: { emoji: "🚶", label: "Walk" },
  taxi: { emoji: "🚕", label: "Taxi / Bolt" },
  cable: { emoji: "🚡", label: "Cable car" },
  funicular: { emoji: "🚞", label: "Funicular" },
  flight: { emoji: "✈️", label: "Flight" },
};

// Block shapes:
//  { type: "place", expId, start, end, note? }        → voted place, live chips
//  { type: "travel", mode, from, to, start, end, note? } → a connecting leg
//  { type: "event", emoji, label, start, end, note? }  → meals / check-ins / fixed bits
export const PROPOSED_PLAN = {
  updated: "11 July 2026",
  days: [
    {
      date: "2026-08-03",
      title: "Arrival — Old Tbilisi on foot",
      base: "Tbilisi",
      icon: "🛬",
      note: "Nothing before 3pm. One easy walking loop — everything tonight is within 20 minutes on foot.",
      blocks: [
        { type: "travel", mode: "taxi", from: "Airport", to: "Old Town hotel", start: "14:30", end: "15:00", note: "~25 min, pre-book a van transfer" },
        { type: "event", emoji: "🏨", label: "Check in, unpack, rest", start: "15:00", end: "17:30" },
        { type: "place", expId: "tbilisi-old-town", start: "17:30", end: "19:15", note: "Sioni Cathedral + Shardeni lanes + Leghvtakhevi waterfall en route" },
        { type: "travel", mode: "walk", from: "Old Town", to: "Bridge of Peace", start: "19:15", end: "19:25" },
        { type: "place", expId: "tbilisi-bridge-rike", start: "19:25", end: "20:15", note: "LED bridge lights up at dusk; Metekhi church viewpoint is just across" },
        { type: "event", emoji: "🥟", label: "Khinkali dinner in the Old Town", start: "20:30", end: "22:00" },
      ],
    },
    {
      date: "2026-08-04",
      title: "Into wine country — Sighnaghi",
      base: "Sighnaghi",
      icon: "🍇",
      note: "Optional for the hardy: leave 7:00 and detour to David Gareja monastery first (adds ~3 hr, rough road).",
      blocks: [
        { type: "travel", mode: "van", from: "Tbilisi", to: "Sighnaghi", start: "09:00", end: "10:45", note: "~110 km" },
        { type: "place", expId: "kakheti-sighnaghi", start: "11:00", end: "12:30", note: "Bodbe Convent first, then the rampart walk before it gets hot" },
        { type: "event", emoji: "🍽️", label: "Terrace lunch over the Alazani Valley", start: "12:45", end: "14:00" },
        { type: "event", emoji: "😴", label: "Siesta / pool — Kakheti midday is hot", start: "14:00", end: "16:00" },
        { type: "place", expId: "kakheti-artisan", start: "16:00", end: "17:15", note: "Carpets, ceramics & felt in the old-town lanes" },
        { type: "place", expId: "kakheti-alazani-picnic", start: "18:00", end: "20:00", note: "Churchkhela, cheeses & juice at golden hour" },
      ],
    },
    {
      date: "2026-08-05",
      title: "Estates, the wine tunnel & the back road north",
      base: "Pasanauri",
      icon: "🍷",
      note: "The Tianeti back road skips Tbilisi entirely — narrow and twisty but scenic. If the driver prefers asphalt all the way, the Tbilisi ring adds ~45 min.",
      blocks: [
        { type: "travel", mode: "van", from: "Sighnaghi", to: "Tsinandali", start: "09:00", end: "10:00" },
        { type: "place", expId: "kakheti-tsinandali", start: "10:00", end: "11:15", note: "Chavchavadze manor gardens + historic cellar" },
        { type: "travel", mode: "van", from: "Tsinandali", to: "Kvareli", start: "11:15", end: "11:55" },
        { type: "place", expId: "kakheti-khareba", start: "12:00", end: "13:00", note: "7.7 km tunnel at a natural 12–14°C — the kids' favourite tasting room" },
        { type: "place", expId: "kakheti-supra", start: "13:15", end: "15:15", note: "Long feast lunch at a family cellar near Kvareli/Telavi" },
        { type: "place", expId: "kakheti-winery-tasting", start: "15:15", end: "15:45", note: "The qvevri flight happens at the same marani — one stop, two ticks" },
        { type: "travel", mode: "van", from: "Telavi", to: "Pasanauri via Tianeti back road", start: "16:00", end: "19:00", note: "~2.5–3 hr through forest & hairpins, bypasses Tbilisi" },
        { type: "event", emoji: "🏡", label: "Riverside guesthouse on the Aragvi, home dinner", start: "19:15", end: "21:00" },
      ],
    },
    {
      date: "2026-08-06",
      title: "Water day on the Military Highway",
      base: "Stepantsminda",
      icon: "🚣",
      note: "Both paddles are booked from the same operators' stretch of valley. If the kids fade, drop one — the drive north is full of stops anyway.",
      blocks: [
        { type: "place", expId: "mtskheta-aragvi-raft", start: "09:30", end: "11:30", note: "Gentle grade-2 float from Pasanauri; wetsuits & guides provided" },
        { type: "travel", mode: "van", from: "Pasanauri", to: "Zhinvali reservoir", start: "11:45", end: "12:15" },
        { type: "place", expId: "mtskheta-zhinvali-kayak", start: "12:15", end: "14:00", note: "Aragvi Adventure Center sit-on-tops on the emerald lake — swim stop included" },
        { type: "place", expId: "mtskheta-ananuri", start: "14:15", end: "15:15", note: "Lakeside fortress + late-lunch café + the I ❤️ Georgia sign" },
        { type: "travel", mode: "van", from: "Ananuri", to: "the mineral springs", start: "15:15", end: "16:00", note: "climbing the Military Highway" },
        { type: "place", expId: "kazbegi-mineral-springs", start: "16:00", end: "16:20", note: "Fizzy orange travertine spring — taste it" },
        { type: "travel", mode: "van", from: "Springs", to: "Gudauri panorama", start: "16:20", end: "16:45" },
        { type: "place", expId: "kazbegi-friendship", start: "16:45", end: "17:20", note: "Mosaic balcony over the Devil's Valley" },
        { type: "travel", mode: "van", from: "Gudauri", to: "Sno turn-off", start: "17:20", end: "18:00", note: "over the Cross Pass (2,379 m)" },
        { type: "place", expId: "kazbegi-sno", start: "18:00", end: "18:20", note: "Giant stone heads in the meadow" },
        { type: "travel", mode: "van", from: "Sno", to: "Stepantsminda", start: "18:20", end: "18:40" },
        { type: "place", expId: "kazbegi-stargazing", start: "21:30", end: "22:30", note: "High-altitude skies from the guesthouse terrace — blankets + tea" },
      ],
    },
    {
      date: "2026-08-07",
      title: "Kazbegi — the crown jewel",
      base: "Stepantsminda",
      icon: "⛰️",
      blocks: [
        { type: "travel", mode: "fourx4", from: "Stepantsminda", to: "Gergeti Trinity", start: "08:30", end: "08:50", note: "Paved since 2018 — vans manage, locals still run 4×4 shuttles" },
        { type: "place", expId: "kazbegi-gergeti", start: "08:50", end: "10:45", note: "Go early: Mt Kazbek is clearest before the clouds build" },
        { type: "place", expId: "kazbegi-honey", start: "11:15", end: "12:00", note: "Alpine wildflower honey farm on the valley road" },
        { type: "event", emoji: "🍽️", label: "Lunch in Stepantsminda", start: "12:15", end: "13:45" },
        { type: "travel", mode: "van", from: "Stepantsminda", to: "Gveleti trailhead", start: "14:30", end: "14:45", note: "10 min toward the Dariali Gorge" },
        { type: "place", expId: "kazbegi-gveleti", start: "14:45", end: "16:00", note: "~1 hr round-trip walk to the falls — shaded and cool" },
        { type: "place", expId: "kazbegi-horse", start: "17:00", end: "18:30", note: "Beginner-friendly guided ride through the meadows" },
      ],
    },
    {
      date: "2026-08-08",
      title: "Juta valley, then down to the ancient capital",
      base: "Gori",
      icon: "🏞️",
      note: "Optional on the way down: tandem paragliding at Gudauri (weather-dependent, adults who dare — 3 of you voted skip!).",
      blocks: [
        { type: "travel", mode: "fourx4", from: "Stepantsminda", to: "Juta village", start: "08:00", end: "08:50", note: "Via Sno; the last stretch is rough — local Delicas do it daily" },
        { type: "place", expId: "kazbegi-juta-truso", start: "08:50", end: "11:45", note: "Easy walk up to the Fifth Season café under the Chaukhi wall" },
        { type: "travel", mode: "van", from: "Juta", to: "Mtskheta", start: "12:30", end: "15:30", note: "Back down the full Military Highway — lunch stop en route" },
        { type: "place", expId: "mtskheta-jvari", start: "15:30", end: "16:10", note: "The confluence viewpoint — where the two rivers meet" },
        { type: "travel", mode: "van", from: "Jvari", to: "Mtskheta town", start: "16:10", end: "16:25" },
        { type: "place", expId: "mtskheta-svetitskhoveli", start: "16:30", end: "17:30", note: "UNESCO cathedral — late afternoon = cooler, tour buses gone" },
        { type: "travel", mode: "van", from: "Mtskheta", to: "Gori", start: "17:30", end: "18:20" },
        { type: "place", expId: "custom-gori-fortress-mr7miqfw", start: "18:45", end: "19:30", fallbackName: "Gori Fortress", note: "Sunset stroll up the citadel walls over the town" },
      ],
    },
    {
      date: "2026-08-09",
      title: "Stalin's town, the cave city & west to Kutaisi",
      base: "Kutaisi",
      icon: "🪨",
      blocks: [
        { type: "place", expId: "uplistsikhe-gori", start: "09:15", end: "10:30", note: "The infamous museum + his private railway carriage" },
        { type: "travel", mode: "van", from: "Gori", to: "Uplistsikhe", start: "10:30", end: "10:50" },
        { type: "place", expId: "uplistsikhe-cave", start: "10:50", end: "12:20", note: "Carved tunnels & altars — hats and water, it's exposed" },
        { type: "event", emoji: "🍽️", label: "Lunch on the road", start: "12:30", end: "13:30" },
        { type: "travel", mode: "van", from: "Uplistsikhe", to: "Kutaisi", start: "13:30", end: "15:45", note: "~180 km on the E60 expressway" },
        { type: "place", expId: "imereti-sataplia", start: "16:15", end: "17:45", note: "Dinosaur footprints + the glass skywalk platform" },
        { type: "place", expId: "imereti-white-bridge", start: "19:00", end: "20:30", note: "Evening stroll: White Bridge, old town lanes, dinner" },
      ],
    },
    {
      date: "2026-08-10",
      title: "Monasteries, the bazaar & the climb to Svaneti",
      base: "Mestia",
      icon: "🗼",
      note: "The caves & canyons all close on Mondays — so Monday is the UNESCO monasteries and the big scenic drive instead. Zero wasted time.",
      blocks: [
        { type: "place", expId: "imereti-gelati-bagrati", start: "09:00", end: "11:15", note: "Gelati's mosaics first, then Bagrati on the hill" },
        { type: "place", expId: "imereti-bazaar", start: "11:30", end: "12:15", note: "Stock the van: fruit, cheese, churchkhela for the mountains" },
        { type: "travel", mode: "van", from: "Kutaisi", to: "Mestia", start: "12:30", end: "17:00", note: "~3.5–4 hr, paved; photo stop at the Enguri dam viewpoint" },
        { type: "place", expId: "svaneti-towers", start: "17:30", end: "18:45", note: "Golden-hour wander through the tower quarters" },
        { type: "place", expId: "svaneti-kubdari", start: "19:15", end: "20:15", note: "The Svan meat pie — dinner, ideally from a family bakery" },
      ],
    },
    {
      date: "2026-08-11",
      title: "Mestia — glacier, ridge & treasury",
      base: "Mestia",
      icon: "🏔️",
      blocks: [
        { type: "travel", mode: "van", from: "Mestia", to: "Chalaadi trailhead", start: "08:30", end: "09:00" },
        { type: "place", expId: "svaneti-chalaadi", start: "09:00", end: "12:15", note: "Forest trail to the glacier tongue — coolest hike of the trip, go before lunch" },
        { type: "event", emoji: "🍽️", label: "Lunch back in Mestia", start: "12:45", end: "13:45" },
        { type: "travel", mode: "van", from: "Mestia", to: "Hatsvali lower station", start: "14:00", end: "14:25" },
        { type: "place", expId: "svaneti-hatsvali", start: "14:30", end: "16:00", note: "Summer hours are 11:00–16:30 — afternoon ride to the Zuruldi ridge for Ushba views" },
        { type: "place", expId: "svaneti-museum", start: "16:45", end: "17:50", note: "Icons & treasury, A/C — closes 18:00 (and all day Mondays — today is Tuesday ✓)" },
      ],
    },
    {
      date: "2026-08-12",
      title: "Ushguli — and out over the Zagari Pass",
      base: "Kutaisi",
      icon: "🐎",
      note: "The clever bit: since 2024 the Ushguli→Lentekhi→Kutaisi road is fully sealed, so Ushguli is the EXIT from Svaneti — no backtracking, a whole day saved, and the Zagari Pass is the most scenic road of the trip.",
      blocks: [
        { type: "travel", mode: "fourx4", from: "Mestia", to: "Ushguli", start: "08:30", end: "10:00", note: "47 km, sealed in 2024 — 60–90 min" },
        { type: "place", expId: "svaneti-ushguli", start: "10:00", end: "12:00", note: "Europe's highest inhabited village — UNESCO tower lanes" },
        { type: "place", expId: "svaneti-lamaria", start: "12:00", end: "12:30", note: "The 12th-century church on the meadow edge" },
        { type: "place", expId: "svaneti-shkhara", start: "12:30", end: "13:15", note: "Short walk toward Georgia's highest peak (5,193 m) + picnic" },
        { type: "place", expId: "svaneti-horse", start: "13:30", end: "14:30", note: "Meadow ride under the towers" },
        { type: "travel", mode: "van", from: "Ushguli", to: "Kutaisi via Zagari Pass & Lentekhi", start: "15:00", end: "19:00", note: "160 km, ~4 hr, sealed (open May–Oct) — waterfalls cross the road" },
        { type: "event", emoji: "🏨", label: "Back in Kutaisi — easy dinner", start: "19:30", end: "21:00" },
      ],
    },
    {
      date: "2026-08-13",
      title: "Canyons & the cave — Imereti's big day",
      base: "Kutaisi",
      icon: "🛶",
      note: "Ordered around closing times and the heat: Martvili's boat first, Okatse's walkway midday, Prometheus' constant 14°C for the hot afternoon. All open Tue–Sun (today is Thursday ✓).",
      blocks: [
        { type: "travel", mode: "van", from: "Kutaisi", to: "Martvili Canyon", start: "09:00", end: "09:50" },
        { type: "place", expId: "imereti-martvili", start: "10:00", end: "11:15", note: "Turquoise gorge boat + the 700 m boardwalk loop" },
        { type: "place", expId: "imereti-martvili-zip", start: "11:15", end: "11:45", note: "Optional zip over the canyon for the brave" },
        { type: "travel", mode: "van", from: "Martvili", to: "Okatse Canyon (Gordi)", start: "11:45", end: "12:35" },
        { type: "event", emoji: "🍽️", label: "Lunch in Gordi village", start: "12:35", end: "13:30" },
        { type: "place", expId: "imereti-okatse", start: "13:30", end: "16:00", note: "2.5 km walk + the 780 m cliff-hung walkway; 4×4 shuttle cuts the walk if legs are done" },
        { type: "travel", mode: "van", from: "Okatse", to: "Prometheus Cave (Kumistavi)", start: "16:00", end: "16:40" },
        { type: "place", expId: "imereti-prometheus", start: "16:45", end: "18:15", note: "1.4 km of lit halls at a constant ~14°C + the underground boat" },
        { type: "travel", mode: "van", from: "Prometheus", to: "Kutaisi", start: "18:15", end: "18:55" },
      ],
    },
    {
      date: "2026-08-14",
      title: "Borjomi pit-stop, then home to Tbilisi",
      base: "Tbilisi",
      icon: "🌿",
      note: "Optional: swap the raft for a short Borjomi-Kharagauli park trail if the group prefers forest to water.",
      blocks: [
        { type: "travel", mode: "van", from: "Kutaisi", to: "Borjomi", start: "09:00", end: "11:30", note: "~2.5 hr via Khashuri" },
        { type: "place", expId: "borjomi-park", start: "11:45", end: "13:15", note: "Taste the famous warm mineral water at the source — kids find it hilarious" },
        { type: "place", expId: "borjomi-cable-car", start: "13:15", end: "14:00", note: "2-min ride to the plateau ferris wheel (runs 10:00–20:00)" },
        { type: "event", emoji: "🍽️", label: "Lunch in the park", start: "14:00", end: "15:00" },
        { type: "place", expId: "borjomi-raft", start: "15:00", end: "16:30", note: "Summer route: 8 km from Chitakhevi dam ending right in Borjomi" },
        { type: "travel", mode: "van", from: "Borjomi", to: "Tbilisi", start: "17:00", end: "19:00", note: "~160 km — say goodbye to the van & driver tonight" },
        { type: "place", expId: "tbilisi-dry-bridge", start: "19:45", end: "21:30", note: "Tonight: the Fabrika half — courtyard dinner & hangout. The market half is tomorrow." },
      ],
    },
    {
      date: "2026-08-15",
      title: "Tbilisi grand finale — connected end to end",
      base: "Tbilisi",
      icon: "🌇",
      note: "Saturday — Dry Bridge's best day. Short taxi hops in the morning, then everything from the baths onward is one connected walk-and-ride line.",
      blocks: [
        { type: "travel", mode: "taxi", from: "Hotel", to: "Chronicles of Georgia", start: "08:45", end: "09:10", note: "~25 min, ~16 GEL; open 24/7, free" },
        { type: "place", expId: "tbilisi-chronicles", start: "09:10", end: "10:00", note: "The giant pillars, morning light, Tbilisi Sea behind" },
        { type: "travel", mode: "taxi", from: "Chronicles", to: "Sameba Cathedral", start: "10:00", end: "10:25" },
        { type: "place", expId: "tbilisi-churches", start: "10:25", end: "11:15", note: "Sameba today — Metekhi & Sioni were already ticked on night one's walk" },
        { type: "travel", mode: "walk", from: "Sameba (Avlabari)", to: "Dry Bridge", start: "11:15", end: "11:40", note: "Downhill through Avlabari, over the river" },
        { type: "place", expId: "tbilisi-dry-bridge", start: "11:40", end: "12:40", note: "Soviet brooches, horns, paintings — haggle gently" },
        { type: "event", emoji: "🍽️", label: "Lunch near the baths district", start: "13:00", end: "14:15" },
        { type: "place", expId: "tbilisi-sulfur-baths", start: "14:30", end: "15:30", note: "Private domed room (book Chreli-Abano ahead) — the midday-heat escape" },
        { type: "travel", mode: "walk", from: "Abanotubani", to: "National Museum (Rustaveli)", start: "15:30", end: "15:55", note: "Or 2 metro stops from Liberty Square" },
        { type: "place", expId: "tbilisi-museum", start: "16:00", end: "17:30", note: "A/C + the gold Treasury vault" },
        { type: "travel", mode: "cable", from: "Rike Park", to: "Narikala fortress", start: "18:00", end: "18:10", note: "Runs till midnight — 2-min flight over the rooftops" },
        { type: "place", expId: "tbilisi-narikala", start: "18:10", end: "19:15", note: "Golden hour on the walls, Mother of Georgia beside you" },
        { type: "travel", mode: "funicular", from: "Chonkadze St", to: "Mtatsminda Park", start: "19:45", end: "20:00", note: "Taxi to the lower station, funicular runs till 23:15" },
        { type: "place", expId: "tbilisi-mtatsminda", start: "20:00", end: "22:30", note: "Sunset + city lights + ponchiki — and the farewell supra dinner at the top" },
      ],
    },
    {
      date: "2026-08-16",
      title: "Departure",
      base: "✈️ Home",
      icon: "✈️",
      note: "Kept completely free for the journey home. Gaumarjos, Georgia! 🇬🇪",
      blocks: [
        { type: "event", emoji: "🏨", label: "Check out & last khachapuri", start: "09:00", end: "10:30" },
        { type: "travel", mode: "taxi", from: "Hotel", to: "Airport", start: "10:30", end: "11:00", note: "Time to suit the flight — pad 3 hr before departure" },
      ],
    },
  ],

  // Voted in but deliberately left as opt-ins, with the honest reason.
  optionals: [
    {
      expId: "kakheti-david-gareja",
      when: "Aug 4, early start",
      why: "Semi-desert cave monastery — spectacular but a rough-road ~3 hr detour before Sighnaghi. Only with a 7:00 start and willing kids.",
    },
    {
      expId: "kazbegi-paragliding",
      when: "Aug 8, ~13:45 at Gudauri",
      why: "On the descent route anyway. Weather-dependent and 3 of you voted skip — so it's a game-day call, cash ready.",
    },
    {
      expId: "borjomi-np",
      when: "Aug 14, instead of the raft",
      why: "The forest park deserves half a day the schedule doesn't have — the short Likani trail can swap in for the raft if the group prefers.",
    },
  ],
};
