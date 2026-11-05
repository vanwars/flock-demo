// An invented town of 100 people, six weeks of trips on a street grid. Used by scenes 2 and 4.
// Cameras sit at some intersections; a car is "read" whenever its route passes one.
import { rng } from "./shared.js";

export const XS = [90, 200, 300, 440, 510];
export const YS = [90, 200, 290];
const DAYS_N = 42;
const nodeAt = (i, j) => i * YS.length + j;
export const nodeXY = (n) => [XS[Math.floor(n / YS.length)], YS[n % YS.length]];
export const N_NODES = XS.length * YS.length;

export const EDGES = [];
const edgeOf = new Map();
for (let i = 0; i < XS.length; i++) {
  for (let j = 0; j < YS.length; j++) {
    if (i < XS.length - 1) EDGES.push([nodeAt(i, j), nodeAt(i + 1, j)]);
    if (j < YS.length - 1) EDGES.push([nodeAt(i, j), nodeAt(i, j + 1)]);
  }
}
EDGES.forEach(([a, b], k) => {
  edgeOf.set(`${a}-${b}`, k);
  edgeOf.set(`${b}-${a}`, k);
});
const neighbors = (n) => {
  const i = Math.floor(n / YS.length), j = n % YS.length, out = [];
  if (i > 0) out.push(nodeAt(i - 1, j));
  if (i < XS.length - 1) out.push(nodeAt(i + 1, j));
  if (j > 0) out.push(nodeAt(i, j - 1));
  if (j < YS.length - 1) out.push(nodeAt(i, j + 1));
  return out;
};

// Cameras at 12 intersections. The west column (x=90) is residential, with no cameras.
export const CAMS2 = [
  [1, 1, 0, "school"], [2, 2, 0, ""], [3, 3, 0, "office park"], [4, 4, 0, "hospital"],
  [5, 1, 1, ""], [6, 2, 1, "downtown"], [7, 3, 1, "mall"], [8, 4, 1, ""],
  [12, 1, 2, ""], [9, 2, 2, ""], [10, 3, 2, "gym"], [11, 4, 2, ""],
].map(([id, i, j, label]) => ({ id, node: nodeAt(i, j), label }));
export const CAM_AT = new Map(CAMS2.map((c) => [c.node, c.id]));
export const CAM_NODE = new Map(CAMS2.map((c) => [c.id, c.node]));
export const DEST2 = { 1: "the school", 3: "the office park", 4: "the hospital", 6: "downtown", 7: "the mall", 10: "the gym" };

// Shortest path on the grid; `order` rotates which neighbor is tried first so routes vary by person.
function path(from, to, order) {
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift();
    if (n === to) break;
    const nb = neighbors(n);
    for (let k = 0; k < nb.length; k++) {
      const m = nb[(k + order) % nb.length];
      if (!prev.has(m)) {
        prev.set(m, n);
        queue.push(m);
      }
    }
  }
  const out = [];
  for (let n = to; n !== -1; n = prev.get(n)) out.push(n);
  return out.reverse();
}

const MIN_PER_EDGE = 2.5;
let world = null;

export function buildWorld() {
  if (world) return world;
  const rand = rng(2024);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const jit = (w) => (rand() - 0.5) * w;
  const west = [nodeAt(0, 0), nodeAt(0, 1), nodeAt(0, 2)];
  const WORK = [nodeAt(2, 0), nodeAt(3, 0), nodeAt(4, 0)];
  const SHOP = [nodeAt(3, 1), nodeAt(2, 1), nodeAt(3, 2)]; // mall, downtown, gym
  const WORSHIP = [nodeAt(1, 1), nodeAt(2, 1), nodeAt(1, 2)];

  const people = [];
  for (let p = 0; p < 100; p++) {
    const kind = p < 45 ? "commuter" : p < 55 ? "night" : p < 70 ? "student" : p < 85 ? "retiree" : "gig";
    const letters = () => String.fromCharCode(65 + Math.floor(rand() * 26));
    people.push({
      id: p,
      kind,
      plate: `${letters()}${letters()}${letters()}-${String(Math.floor(rand() * 9000) + 1000)}`,
      adId: "ad-" + Math.floor(rand() * 0xfffff).toString(16).padStart(5, "0"),
      home: pick(west),
      work: pick(WORK),
      order: Math.floor(rand() * 4),
      errandDay: Math.floor(rand() * 5),
      errand: pick(SHOP),
      worship: rand() < 0.35 ? pick(WORSHIP) : null,
      weekendTrip: rand() < 0.5,
      apptDay: rand() < 0.4 ? pick([1, 3]) : null,
    });
  }

  const trips = [];
  const reads = [];
  const tripsOf = people.map(() => []);
  const readsOf = people.map(() => []);

  const addTrip = (p, day, hour, from, to) => {
    if (from === to || day >= DAYS_N) return;
    const nodes = path(from, to, p.order);
    const times = nodes.map((_, k) => day * 24 + hour + (k * MIN_PER_EDGE) / 60);
    const edges = [];
    for (let k = 1; k < nodes.length; k++) edges.push(edgeOf.get(`${nodes[k - 1]}-${nodes[k]}`));
    const trip = { p: p.id, day, hour, nodes, times, edges };
    trips.push(trip);
    tripsOf[p.id].push(trip);
    nodes.forEach((n, k) => {
      const cam = CAM_AT.get(n);
      if (cam) {
        const r = { t: times[k], day, hour: times[k] - day * 24, cam, p: p.id };
        reads.push(r);
        readsOf[p.id].push(r);
      }
    });
  };

  for (const p of people) {
    for (let day = 0; day < DAYS_N; day++) {
      const d = day % 7;
      if (p.kind === "commuter") {
        if (d <= 4) {
          addTrip(p, day, 7.5 + jit(0.8), p.home, p.work);
          const out = 17 + jit(0.8);
          if (d === p.errandDay) {
            addTrip(p, day, out, p.work, p.errand);
            addTrip(p, day, out + 1.2, p.errand, p.home);
          } else addTrip(p, day, out, p.work, p.home);
        } else if (d === 5 && p.weekendTrip) {
          addTrip(p, day, 11 + jit(1), p.home, p.errand);
          addTrip(p, day, 12.8 + jit(1), p.errand, p.home);
        } else if (d === 6 && p.worship != null) {
          addTrip(p, day, 9.3 + jit(0.4), p.home, p.worship);
          addTrip(p, day, 11.8 + jit(0.4), p.worship, p.home);
        }
      } else if (p.kind === "night") {
        if (d <= 4) addTrip(p, day, 18.4 + jit(0.5), p.home, nodeAt(4, 0));
        if (d >= 1 && d <= 5) addTrip(p, day, 7.2 + jit(0.5), nodeAt(4, 0), p.home);
      } else if (p.kind === "student") {
        if (d <= 4) {
          addTrip(p, day, 8.1 + jit(0.4), p.home, nodeAt(1, 0));
          if (d === 2) {
            addTrip(p, day, 15.4 + jit(0.4), nodeAt(1, 0), nodeAt(3, 1));
            addTrip(p, day, 17.2 + jit(0.4), nodeAt(3, 1), p.home);
          } else addTrip(p, day, 15.4 + jit(0.4), nodeAt(1, 0), p.home);
        } else if (d === 5 && p.weekendTrip) {
          addTrip(p, day, 14 + jit(1), p.home, nodeAt(3, 1));
          addTrip(p, day, 16.2 + jit(1), nodeAt(3, 1), p.home);
        }
      } else if (p.kind === "retiree") {
        if (d === 1 || d === 4) {
          addTrip(p, day, 10.3 + jit(0.6), p.home, nodeAt(2, 1));
          addTrip(p, day, 11.5 + jit(0.6), nodeAt(2, 1), p.home);
        }
        if (d === 6 && p.worship != null) {
          addTrip(p, day, 9.3 + jit(0.4), p.home, p.worship);
          addTrip(p, day, 11.8 + jit(0.4), p.worship, p.home);
        }
        if (p.apptDay != null && d === p.apptDay) {
          addTrip(p, day, 14 + jit(0.4), p.home, nodeAt(4, 0));
          addTrip(p, day, 15.5 + jit(0.4), nodeAt(4, 0), p.home);
        }
      } else {
        let at = p.home;
        let h = 11 + jit(1.5);
        const legs = 3 + Math.floor(rand() * 4);
        for (let k = 0; k < legs; k++) {
          const to = Math.floor(rand() * N_NODES);
          addTrip(p, day, h, at, to);
          at = to;
          h += 0.6 + rand() * 0.8;
        }
        addTrip(p, day, h, at, p.home);
      }
    }
  }
  for (const rs of readsOf) rs.sort((a, b) => a.t - b.t);
  reads.sort((a, b) => a.t - b.t);

  addAttributes(people);
  world = { people, trips, reads, tripsOf, readsOf };
  return world;
}

// ---- invented personal attributes (scene 2 search) ----
// Race/ethnicity is NOT a field on a vehicle registry record. Real systems guess it from a surname and a
// neighborhood, and the guess is often wrong. The "truth" below exists only so the scene can show the errors.
const HISP_SURNAMES = ["Garcia", "Martinez", "Rodriguez", "Hernandez", "Lopez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres"];
const ASIAN_SURNAMES = ["Nguyen", "Kim", "Patel", "Chen", "Singh", "Wang"];
const OTHER_SURNAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Clark", "Lewis", "Walker", "Hall", "Allen"];
// Share of each west-side neighborhood (by home row) that is Hispanic: an invented prior.
const HISP_PRIOR = [0.35, 0.2, 0.1];
const BASE_RATE = 0.2;
const logit = (x) => Math.log(x / (1 - x));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const pSurname = (name) => (HISP_SURNAMES.includes(name) ? 0.9 : ASIAN_SURNAMES.includes(name) ? 0.02 : 0.03);

// The guess a system could make: surname evidence combined with the neighborhood prior.
export function estimateHispanic(person) {
  const row = person.home % YS.length;
  return sigmoid(logit(pSurname(person.surname)) + logit(HISP_PRIOR[row]) - logit(BASE_RATE));
}

function addAttributes(people) {
  const rand = rng(404); // separate stream: does not change the trips above
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  let gig = 0;
  for (const p of people) {
    const prior = HISP_PRIOR[p.home % YS.length];
    const r = rand();
    p.group = r < prior ? "Hispanic" : (() => {
      const q = rand();
      return q < 0.25 ? "Black" : q < 0.8 ? "White" : q < 0.92 ? "Asian" : "Other";
    })();
    const ownPool = p.group === "Hispanic" ? HISP_SURNAMES : p.group === "Asian" ? ASIAN_SURNAMES : OTHER_SURNAMES;
    const cross = rand();
    // Names don't always match the group: 22% of Hispanic people have another surname, 5% of others a Hispanic one.
    p.surname =
      p.group === "Hispanic" ? (cross < 0.78 ? pick(HISP_SURNAMES) : pick(OTHER_SURNAMES))
      : cross < 0.05 ? pick(HISP_SURNAMES)
      : p.group === "Asian" && cross < 0.7 ? pick(ASIAN_SURNAMES)
      : pick(ownPool === ASIAN_SURNAMES ? OTHER_SURNAMES : ownPool);
    p.initial = String.fromCharCode(65 + Math.floor(rand() * 26));
    p.name = `${p.initial}. ${p.surname}`;
    p.gender = rand() < 0.5 ? "woman" : "man";
    p.age =
      p.kind === "student" ? between(18, 23) : p.kind === "retiree" ? between(66, 84)
      : p.kind === "night" ? between(26, 58) : p.kind === "gig" ? between(19, 55) : between(24, 62);
    p.job =
      p.kind === "gig" ? (gig++ < 12 ? "delivery driver" : "rideshare driver")
      : p.kind === "student" ? "student" : p.kind === "retiree" ? "retired"
      : p.kind === "night" ? "night-shift hospital worker"
      : p.work === nodeAt(4, 0) ? "hospital worker" : "office worker";
  }
}

// "Likely delivery driver": guessed from the driving pattern alone, many stops at many places all day.
// (A rideshare driver looks the same, so some guesses are wrong.)
export function inferDelivery(reads) {
  const byDay = new Map();
  for (const r of reads) (byDay.get(r.day) ?? byDay.set(r.day, []).get(r.day)).push(r.cam);
  if (byDay.size < 3) return false;
  let total = 0, distinct = 0;
  for (const cams of byDay.values()) {
    total += cams.length;
    distinct += new Set(cams).size;
  }
  return total / byDay.size >= 12.5 && distinct / byDay.size >= 7;
}

// "Everyone who drove past `cam`" (optionally on one weekday, between two hours) filtered by guessed and registry attributes.
// Returns the people the guesses select, plus what the real attributes would have selected.
export function profileSearch(w, { cam, t, win, weekday = -1, h0 = 0, h1 = 24, delivery, hispanic, gender, maxAge }) {
  const inHours = (h) => (h0 <= h1 ? h >= h0 && h < h1 : h >= h0 || h < h1);
  const here = new Set();
  const mine = new Map();
  for (const r of w.reads) {
    if (r.t > t) break;
    if (r.t <= t - win) continue;
    (mine.get(r.p) ?? mine.set(r.p, []).get(r.p)).push(r);
    if (r.cam === cam && (weekday < 0 || r.day % 7 === weekday) && inHours(r.hour)) here.add(r.p);
  }
  const rows = [...here].map((id) => {
    const p = w.people[id];
    const guessDelivery = inferDelivery(mine.get(id));
    const pH = estimateHispanic(p);
    const guessHispanic = pH >= 0.5;
    const fitsGuess =
      (!delivery || guessDelivery) && (!hispanic || guessHispanic) &&
      (!gender || p.gender === gender) && p.age < maxAge;
    const fitsTruth =
      (!delivery || p.job === "delivery driver") && (!hispanic || p.group === "Hispanic") &&
      (!gender || p.gender === gender) && p.age < maxAge;
    return { p, guessDelivery, guessHispanic, pH, fitsGuess, fitsTruth };
  });
  const returned = rows.filter((r) => r.fitsGuess);
  return {
    passedHere: rows.length,
    returned,
    wrong: returned.filter((r) => !r.fitsTruth),
    missed: rows.filter((r) => r.fitsTruth && !r.fitsGuess),
  };
}

// ---- phone pings (scene 4) ----
let pingData = null;
export function buildPings() {
  if (pingData) return pingData;
  const w = buildWorld();
  const rand = rng(77);
  const byNode = Array.from({ length: N_NODES }, () => []);
  for (const tr of w.trips) {
    tr.nodes.forEach((n, k) => {
      if (rand() < 0.55) byNode[n].push({ t: tr.times[k] + (rand() - 0.5) * 0.14, p: tr.p, node: n });
    });
  }
  for (const a of byNode) a.sort((x, y) => x.t - y.t);
  pingData = { byNode };
  return pingData;
}

// Nodes within `hops` grid steps of `node` (including itself).
export function nodesWithin(node, hops) {
  let seen = new Set([node]);
  let frontier = [node];
  for (let h = 0; h < hops; h++) {
    const nextF = [];
    for (const n of frontier) for (const m of neighbors(n)) if (!seen.has(m)) (seen.add(m), nextF.push(m));
    frontier = nextF;
  }
  return seen;
}

// Pick up to maxK sightings of `target` (one per day, each with a matching phone ping) and track which
// phones are consistent with every sighting so far. `hops` = how coarse the phone location is, in blocks;
// `minutes` = how loosely the times must agree. Returns { sightings, remaining: [Set per k] }.
export function narrowing(target, maxK = 12, { hops = 1, minutes = 20 } = {}) {
  const w = buildWorld();
  const { byNode } = buildPings();
  const win = minutes / 60;
  const near = (node, t) => {
    const out = [];
    for (const n of nodesWithin(node, hops)) for (const q of byNode[n]) if (Math.abs(q.t - t) <= win) out.push(q);
    return out;
  };
  const sightings = [];
  const usedDays = new Set();
  for (const r of w.readsOf[target]) {
    if (usedDays.has(r.day)) continue;
    const node = CAM_NODE.get(r.cam);
    const pings = near(node, r.t);
    if (!pings.some((q) => q.p === target)) continue;
    usedDays.add(r.day);
    sightings.push({ ...r, node, phones: new Set(pings.map((q) => q.p)), pings });
    if (sightings.length >= maxK) break;
  }
  const remaining = [new Set(w.people.map((p) => p.id))];
  for (const s of sightings) {
    const prev = remaining[remaining.length - 1];
    remaining.push(new Set([...prev].filter((p) => s.phones.has(p))));
  }
  return { sightings, remaining };
}
