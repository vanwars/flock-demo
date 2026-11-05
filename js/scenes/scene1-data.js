// Scene 1 data: one imaginary car, six weeks of plate reads. All data is invented.
import { rng } from "./shared.js";

const WEEKS = 6;
export const MAX_HOUR = WEEKS * 7 * 24 - 1;

export const CAMS = {
  1: { x: 150, y: 290 },
  2: { x: 300, y: 200 },
  3: { x: 440, y: 90 },
  4: { x: 300, y: 340 },
  5: { x: 200, y: 150 },
  6: { x: 510, y: 290 },
};
// What an observer might guess a camera's surroundings are. Only cameras where the car stays a while.
export const DESTINATIONS = { 3: "work", 4: "the gym", 5: "the grocery store", 6: "a place of worship" };
export const PLACES = [
  { x: 60, y: 318, label: "home" },
  { x: 500, y: 62, label: "work" },
  { x: 330, y: 372, label: "gym?" },
  { x: 200, y: 128, label: "grocery?" },
  { x: 548, y: 318, label: "?" },
];
export const ROADS = ["M0 90H600", "M0 200H600", "M0 290H600", "M200 0V380", "M300 0V380", "M440 0V380", "M510 0V380"];
// Road routes between camera pairs (so traces follow streets, and never pass another camera).
const ROUTES = {
  "1-2": [[150, 290], [300, 290], [300, 200]],
  "2-3": [[300, 200], [440, 200], [440, 90]],
  "2-4": [[300, 200], [300, 340]],
  "2-5": [[300, 200], [200, 200], [200, 150]],
  "1-4": [[150, 290], [300, 290], [300, 340]],
  "1-5": [[150, 290], [200, 290], [200, 150]],
  "1-6": [[150, 290], [510, 290]],
};
export function route(a, b) {
  const fwd = ROUTES[`${a}-${b}`];
  if (fwd) return fwd;
  return [...(ROUTES[`${b}-${a}`] ?? [[CAMS[a].x, CAMS[a].y], [CAMS[b].x, CAMS[b].y]])].reverse();
}

// Trips: each is a list of reads {t (hours from start), day, hour, cam}.
function buildTrips() {
  const rand = rng(11);
  const trips = [];
  const trip = (day, startHour, cams) => {
    const shift = (rand() - 0.5) * 0.5; // up to ~15 minutes early or late
    const reads = cams.map((cam, i) => {
      const hour = startHour + shift + i * (0.27 + rand() * 0.06);
      return { t: day * 24 + hour, day, hour, cam };
    });
    trips.push({ reads, jx: (rand() - 0.5) * 5, jy: (rand() - 0.5) * 5 });
  };
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = w * 7 + d;
      if (d <= 4) {
        const remote = w >= 3 && d === 4; // from week 4, Fridays at home
        if (!remote) {
          trip(day, 7.8, [1, 2, 3]);
          if (d === 1 || d === 3) {
            trip(day, 17.1, [3, 2, 4]);
            trip(day, 19.1, [4, 2, 1]);
          } else if (d === 2) {
            trip(day, 17.1, [3, 2, 5]);
            trip(day, 18.6, [5, 1]);
          } else trip(day, 17.1, [3, 2, 1]);
        }
      } else if (d === 5 && w >= 2) {
        trip(day, 8.9, [1, 4]);
        trip(day, 10.6, [4, 1]);
      } else if (d === 6) {
        trip(day, 9.3, [1, 6]);
        trip(day, 12.0, [6, 1]);
      }
    }
  }
  return trips;
}
export const TRIPS = buildTrips();


