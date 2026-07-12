// Google Maps + photo links for every experience.
// Curated queries make the Maps pin land on the right spot; anything
// without an entry (e.g. places the family adds) falls back to
// "<name>, <region>, Georgia".

import { REGIONS } from "./data";

const MAPS_QUERIES = {
  "tbilisi-old-town": "Old Town Tbilisi",
  "tbilisi-bridge-rike": "Bridge of Peace, Tbilisi",
  "tbilisi-narikala": "Narikala Fortress Cable Car, Tbilisi",
  "tbilisi-mtatsminda": "Mtatsminda Park, Tbilisi",
  "tbilisi-sulfur-baths": "Abanotubani Sulfur Baths, Tbilisi",
  "tbilisi-sulfur-scrub": "Abanotubani Sulfur Baths, Tbilisi",
  "tbilisi-museum": "Georgian National Museum, Tbilisi",
  "tbilisi-chronicles": "Chronicles of Georgia, Tbilisi",
  "tbilisi-churches": "Holy Trinity Cathedral of Tbilisi",
  "tbilisi-dry-bridge": "Dry Bridge Market, Tbilisi",
  "mtskheta-jvari": "Jvari Monastery, Mtskheta",
  "mtskheta-svetitskhoveli": "Svetitskhoveli Cathedral, Mtskheta",
  "mtskheta-aragvi-raft": "Aragvi River Rafting, Georgia",
  "mtskheta-zhinvali-kayak": "Zhinvali Reservoir, Georgia",
  "mtskheta-ananuri": "Ananuri Fortress, Georgia",
  "kakheti-winery-tasting": "Wineries in Telavi, Kakheti",
  "kakheti-khareba": "Winery Khareba Wine Tunnel, Kvareli",
  "kakheti-tsinandali": "Tsinandali Estate, Kakheti",
  "kakheti-supra": "Pheasant's Tears, Sighnaghi",
  "kakheti-sighnaghi": "Sighnaghi City Walls",
  "kazbegi-friendship": "Russia Georgia Friendship Monument, Gudauri",
  "kazbegi-gergeti": "Gergeti Trinity Church, Stepantsminda",
  "kazbegi-gveleti": "Gveleti Waterfall, Georgia",
  "kazbegi-juta-truso": "Juta Valley, Georgia",
  "kazbegi-paragliding": "Gudauri Paragliding",
  "borjomi-park": "Borjomi Central Park",
  "borjomi-cable-car": "Borjomi Park Cable Car",
  "borjomi-raft": "Rafting Borjomi, Georgia",
  "borjomi-np": "Borjomi-Kharagauli National Park",
  "imereti-martvili": "Martvili Canyon",
  "imereti-martvili-zip": "Martvili Canyon Zipline",
  "imereti-prometheus": "Prometheus Cave, Kumistavi",
  "imereti-okatse": "Okatse Canyon",
  "imereti-sataplia": "Sataplia Nature Reserve, Kutaisi",
  "imereti-gelati-bagrati": "Gelati Monastery, Kutaisi",
  "uplistsikhe-cave": "Uplistsikhe Cave Town",
  "uplistsikhe-gori": "Stalin Museum, Gori",
  "kakheti-david-gareja": "David Gareja Monastery",
  "kakheti-alazani-picnic": "Alazani Valley viewpoint, Sighnaghi",
  "kakheti-artisan": "Sighnaghi old town",
  "kazbegi-sno": "Sno village stone heads, Georgia",
  "kazbegi-mineral-springs": "Mineral springs, Georgian Military Highway",
  "kazbegi-horse": "Horse riding Stepantsminda",
  "kazbegi-honey": "Honey farm Stepantsminda",
  "kazbegi-stargazing": "Stepantsminda, Georgia",
  "imereti-white-bridge": "White Bridge, Kutaisi",
  "imereti-bazaar": "Green Bazaar, Kutaisi",
  "imereti-cooking-class": "Cooking class Kutaisi",
  "svaneti-towers": "Svan towers, Mestia",
  "svaneti-museum": "Svaneti Museum of History and Ethnography, Mestia",
  "svaneti-hatsvali": "Hatsvali Ropeway, Mestia",
  "svaneti-chalaadi": "Chalaadi Glacier, Mestia",
  "svaneti-kubdari": "Restaurants in Mestia",
  "svaneti-ushguli": "Ushguli, Georgia",
  "svaneti-lamaria": "Lamaria Monastery, Ushguli",
  "svaneti-shkhara": "Mount Shkhara viewpoint, Ushguli",
  "svaneti-horse": "Ushguli, Georgia",
  // Family-added custom places
  "custom-gori-fortress-mr7miqfw": "Gori Fortress, Gori",
};

export function queryFor(experience) {
  if (MAPS_QUERIES[experience.id]) return MAPS_QUERIES[experience.id];
  const region = REGIONS.find((r) => r.id === experience.regionId);
  return `${experience.name}, ${region ? region.name + ", " : ""}Georgia`;
}

// Google Maps directions chaining stops in order (origin → waypoints →
// destination). The URL API allows at most 9 waypoints, so trim from the
// middle if a day ever exceeds that.
export function getRouteUrl(stops, mode = "driving") {
  // Drop consecutive repeats only — a loop legitimately revisits stops
  const unique = stops.filter((s, i) => i === 0 || s !== stops[i - 1]);
  if (unique.length < 2) return null;
  const origin = unique[0];
  const destination = unique[unique.length - 1];
  const waypoints = unique.slice(1, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: mode,
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getMapsUrl(experience) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(queryFor(experience))
  );
}

export function getPhotosUrl(experience) {
  return (
    "https://www.google.com/search?udm=2&q=" +
    encodeURIComponent(queryFor(experience))
  );
}
