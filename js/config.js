export const DATA_URL = "cameras-nc.geojson";
export const DEFAULT_RADIUS_M = 900; // cameras within a campus's radius count as "on/near campus"
export const NC_BOUNDS = [[33.8, -84.4], [36.6, -75.4]]; // initial statewide view
export const CAMPUS_BUBBLE_MAX_ZOOM = 11; // at this zoom and farther out, show one count bubble per campus
export const ICON_MIN_ZOOM = 14; // at this zoom and closer, show oriented camera icons instead of dots

// Esri Gray Canvas basemaps (no API key). CARTO needs a free CARTO API key.
const ATTRIBUTION =
  "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors · Camera data: DeFlock / OSM";
const esri = (layer) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;
export const BASEMAPS = {
  light: { url: esri("World_Light_Gray_Base") },
  dark: { url: esri("World_Dark_Gray_Base") },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxNativeZoom: 18,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics · Camera data: DeFlock / OSM",
    },
  },
};
export const BASEMAP_OPTIONS = { maxNativeZoom: 16, maxZoom: 19, attribution: ATTRIBUTION };

// Illustrated UNC Asheville campus map (from a 2019 WordCamp parking PDF), georeferenced by
// matching road intersections to OpenStreetMap: north-up, about 0.53 m/pixel. It is a stylized
// illustration, so expect a few meters of drift. Bounds are [[south, west], [north, east]].
export const CAMPUS_OVERLAYS = [
  {
    id: "unca",
    url: "overlays/unca-campus-map.webp",
    bounds: [[35.61116, -82.57383], [35.62101, -82.55986]],
    attribution: "Campus map: UNC Asheville / WordCamp Asheville 2019",
  },
];

/* ------------------------------------------------------------------
   The 17 UNC System institutions. `center` is [lat, lng]; `radius`
   (meters) is a rough circle around campus, so tune it per campus.
   Centers were checked against OpenStreetMap geocoding, EXCEPT
   ncat, ecu and ncsu, which are from memory: please verify.
------------------------------------------------------------------- */
export const CAMPUSES = [
  { id: "appstate", name: "Appalachian State University", short: "App State", center: [36.2114, -81.6861], radius: 1000 },
  { id: "ecu", name: "East Carolina University", short: "ECU", center: [35.6064, -77.366], radius: 1200 }, // verify
  { id: "ecsu", name: "Elizabeth City State University", short: "ECSU", center: [36.2801, -76.2134] },
  { id: "fsu", name: "Fayetteville State University", short: "FSU", center: [35.0737, -78.8926] },
  { id: "ncat", name: "North Carolina A&T State University", short: "NC A&T", center: [36.0766, -79.775], radius: 1000 }, // verify
  { id: "nccu", name: "North Carolina Central University", short: "NCCU", center: [35.9732, -78.8976] },
  { id: "ncsu", name: "North Carolina State University", short: "NC State", center: [35.7847, -78.6821], radius: 1400 }, // verify
  { id: "unca", name: "UNC Asheville", short: "UNCA", center: [35.6163, -82.5676] },
  { id: "unc", name: "UNC Chapel Hill", short: "UNC-CH", center: [35.905, -79.0478], radius: 1400 },
  { id: "uncc", name: "UNC Charlotte", short: "UNCC", center: [35.3065, -80.735], radius: 1500 },
  { id: "uncg", name: "UNC Greensboro", short: "UNCG", center: [36.0684, -79.8106] },
  { id: "uncp", name: "UNC Pembroke", short: "UNCP", center: [34.6917, -79.2014] },
  { id: "uncsa", name: "UNC School of the Arts", short: "UNCSA", center: [36.0768, -80.2363] },
  { id: "uncw", name: "UNC Wilmington", short: "UNCW", center: [34.225, -77.8691], radius: 1200 },
  { id: "wcu", name: "Western Carolina University", short: "WCU", center: [35.31, -83.199], radius: 1000 },
  { id: "wssu", name: "Winston-Salem State University", short: "WSSU", center: [36.0895, -80.224] },
  { id: "ncssm", name: "NC School of Science and Mathematics", short: "NCSSM", center: [36.0194, -78.9207] },
].map((c) => ({ radius: DEFAULT_RADIUS_M, ...c }));
