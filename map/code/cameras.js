import { CAMPUSES, DATA_URL } from "./config.js";

const CARDINALS = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

// OSM direction can be a number, "90;270", or a cardinal like "NE".
// Returns bearings in degrees clockwise from north.
function parseBearings({ direction, directions, directionCardinal }) {
  const tokens = [direction, directions, directionCardinal]
    .filter((v) => v != null)
    .join(";")
    .split(/[;,]/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const out = tokens.map((t) => (isNaN(t) ? CARDINALS[t] : Number(t)));
  return [...new Set(out.filter((b) => b !== undefined))];
}

// The closest campus whose radius contains this point, or null.
function campusAt([lat, lng]) {
  const point = L.latLng(lat, lng);
  let best = null;
  let bestMeters = Infinity;
  for (const campus of CAMPUSES) {
    const meters = point.distanceTo(campus.center);
    if (meters <= campus.radius && meters < bestMeters) {
      best = campus;
      bestMeters = meters;
    }
  }
  return best;
}

export async function loadCameras() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  const geojson = await response.json();

  return (geojson.features ?? [])
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const props = f.properties ?? {};
      const latlng = [lat, lng];
      return { props, latlng, campus: campusAt(latlng), bearings: parseBearings(props) };
    });
}

// Map of campus id -> number of cameras on/near that campus.
export function countByCampus(cams) {
  const counts = new Map(CAMPUSES.map((c) => [c.id, 0]));
  for (const cam of cams) {
    if (cam.campus) counts.set(cam.campus.id, counts.get(cam.campus.id) + 1);
  }
  return counts;
}
