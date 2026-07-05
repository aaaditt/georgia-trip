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
};

function queryFor(experience) {
  if (MAPS_QUERIES[experience.id]) return MAPS_QUERIES[experience.id];
  const region = REGIONS.find((r) => r.id === experience.regionId);
  return `${experience.name}, ${region ? region.name + ", " : ""}Georgia`;
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
