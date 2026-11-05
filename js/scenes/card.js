// The "Data Facts" label: a nutrition-label style fact sheet for one invented car.
// Each scene and each join reveals more rows, and the "% of a full profile" meter rises.
import { inferHabits } from "./shared.js";
import { TRIPS, DESTINATIONS } from "./scene1-data.js";
import { LAYERS } from "./profile-data.js";
import { buildWorld } from "./world.js";

const STAGES = {
  1: "Scene 1 · From camera reads",
  2: "Scene 2 · From the crowd and records",
  3: "Scene 3 · From federal records",
  4: "Scene 4 · From purchased data",
};
// Where a fact came from: camera, inferred, joined, estimate (same four kinds as scene 2).
const SRC_LABEL = { camera: "Seen by camera", inferred: "Inferred", joined: "Joined from a record", estimate: "Area estimate" };

const ALL_READS = TRIPS.flatMap((t) => t.reads).sort((a, b) => a.t - b.t);
const TOTAL_READS = ALL_READS.length;
const TOTAL_DAYS = 42;
const FULL_HABITS = inferHabits(ALL_READS, DESTINATIONS);
const MAX_HABITS = 5;

const clean = (h) => h.replace(/^Goes to /, "");

// Rows: id, stage, label, value(state), show(state), weight, src.
const ROWS = [
  { id: "reads", stage: 1, label: "Plate reads on file", value: (s) => s.reads.toLocaleString(), show: (s) => s.reads > 0, w: 3, src: "camera" },
  { id: "days", stage: 1, label: "Days observed", value: (s) => `${s.days} of ${TOTAL_DAYS}`, show: (s) => s.days > 0, w: 2, src: "camera" },
  { id: "vehicle", stage: 1, label: "Vehicle", value: () => "Gray sedan", show: (s) => s.reads > 0, w: 1, src: "camera" },
  { id: "route", stage: 1, label: "Usual route", value: () => "Cam 1 → 2 → 3, weekdays", show: (s) => s.days >= 3, w: 3, src: "camera" },
  { id: "home", stage: 1, label: "Probable home area", value: () => "Near Cam 1 (first read of nearly every day)", show: (s) => s.home, w: 4, src: "inferred" },
  ...Array.from({ length: MAX_HABITS }, (_, i) => ({
    id: `habit${i}`, stage: 1, label: i === 0 ? "Regular stops" : "…also",
    value: (s) => clean(s.habits[i] ?? ""), show: (s) => s.habits.length > i, w: 3, src: "inferred",
  })),
  { id: "peers", stage: 2, label: "Similar weekday routines", value: () => "44 of 99 other plates", show: (s) => s.crowd, w: 3, src: "inferred" },
  { id: "search", stage: 2, label: "Findable by place and time", value: () => "Yes, no name needed", show: (s) => s.crowd, w: 3, src: "inferred" },
  // Scene 2 rows come from the same fields as the scene 2 join ladder (skipping the camera-only first layer).
  ...LAYERS.flatMap((layer, li) =>
    li === 0 ? [] : layer.fields.map(([label, value, src], fi) => ({
      id: `layer${li}_${fi}`, stage: 2, label, value: () => value, show: (s) => s.layers > li, w: 2, src,
    }))),
  { id: "fedcase", stage: 3, label: "Federal case records", value: () => "Whether a case exists, past contact (generic)", show: (s) => s.federal, w: 6, src: "joined" },
  { id: "fedlinks", stage: 3, label: "Linked people", value: () => "Others at the same address or on the same records", show: (s) => s.federal, w: 4, src: "joined" },
  { id: "phones", stage: 4, label: "Phones that could be the driver's", value: (s) => `${s.cand} of 100`, show: (s) => s.k > 0 && s.cand > 1, w: 1, src: "estimate" },
  { id: "adid", stage: 4, label: "Advertising ID", value: () => buildWorld().people[5].adId, show: (s) => s.cand === 1, w: 4, src: "joined" },
  { id: "where", stage: 4, label: "Where the phone goes when the car is parked", value: () => "Home, work, errands, on foot", show: (s) => s.cand === 1, w: 4, src: "joined" },
  { id: "contact", stage: 4, label: "Phone number and email", value: () => "(555) 010-0417 · alex@example.test", show: (s) => s.cand === 1 && s.files.b, w: 4, src: "joined" },
  { id: "household", stage: 4, label: "Household members, past addresses", value: () => "2 adults at this address; 2 earlier addresses", show: (s) => s.cand === 1 && s.files.b && s.files.c, w: 4, src: "joined" },
  { id: "buys", stage: 4, label: "Shopping habits", value: () => "Weekly grocery run; gym membership", show: (s) => s.cand === 1 && s.files.b && s.files.c && s.files.d, w: 4, src: "joined" },
];
const TOTAL_WEIGHT = ROWS.reduce((n, r) => n + r.w, 0);

const initial = () => ({
  reads: 0, days: 0, home: false, habits: [], crowd: false, layers: 0,
  federal: false, k: 0, cand: 100, files: { b: false, c: false, d: false },
});
let state = initial();
let root = null;
let shown = new Set();

export function initCard(el) {
  root = el;
  render();
}

// Called when a scene opens: earlier scenes count as finished, later ones as not yet done.
export function enterScene(n) {
  const keepFederal = n >= 4 && state.federal;
  state = initial();
  if (n >= 2) Object.assign(state, { reads: TOTAL_READS, days: TOTAL_DAYS, home: true, habits: FULL_HABITS, crowd: true });
  if (n >= 3) state.layers = LAYERS.length;
  if (keepFederal) state.federal = true;
  shown = new Set(); // don't flash rows that are already known when a scene opens
  render(true);
}

export function update(patch) {
  state = { ...state, ...patch };
  render();
}

function render(silent = false) {
  if (!root) return;
  const visible = ROWS.filter((r) => r.show(state));
  const weight = visible.reduce((n, r) => n + r.w, 0);
  const pct = Math.round((100 * weight) / TOTAL_WEIGHT);
  const named = state.layers >= 2;
  const fresh = new Set(visible.map((r) => r.id).filter((id) => !shown.has(id)));
  const rowHtml = (r) => {
    const share = Math.max(1, Math.round((100 * r.w) / TOTAL_WEIGHT));
    return `<div class="fs-row${!silent && shown.size && fresh.has(r.id) ? " new" : ""}">` +
      `<span><span class="fs-dot s-${r.src}" title="${SRC_LABEL[r.src]}"></span><b>${r.label}</b>` +
      `<span class="fs-val">${r.value(state)}</span></span><b class="fs-pct">${share}%</b></div>`;
  };
  const stages = Object.keys(STAGES).map(Number).filter((n) => visible.some((r) => r.stage === n));
  root.innerHTML =
    `<div class="fs-head"><div class="fs-title">Data Facts</div>` +
    `<div class="fs-sub">Plate XYZ-0417 <i>(invented)</i></div>` +
    `<div class="fs-sub">Owner: ${named ? "Alex Example" : "<i>unknown</i>"}</div>` +
    `<div class="fs-sub">Serving size: 1 car, 6 weeks of reads</div>` +
    `<div class="fs-bar"></div>` +
    `<div class="fs-big"><span>Facts known</span><span>${visible.length}</span></div>` +
    `<div class="fs-meter" role="img" aria-label="${pct} percent of a full profile"><span style="width:${pct}%"></span></div>` +
    `<div class="fs-pct-head">% of a full profile</div></div>` +
    (stages.length
      ? stages.map((n) => `<div class="fs-stage">${STAGES[n]}</div>` + visible.filter((r) => r.stage === n).map(rowHtml).join("")).join("")
      : `<p class="fs-empty">No reads on file yet.</p>`) +
    `<div class="fs-bar thin"></div>` +
    `<div class="fs-legend">` +
    Object.entries(SRC_LABEL).map(([k, v]) => `<span><span class="fs-dot s-${k}"></span>${v}</span>`).join("") +
    `</div>` +
    `<p class="fs-foot">All data is invented. Percentages are illustrative: each row's share of a complete profile.</p>`;
  shown = new Set(visible.map((r) => r.id));
  // Keep the newest rows in view inside the (scrollable) label.
  const added = root.querySelectorAll(".fs-row.new");
  if (added.length) {
    const last = added[added.length - 1];
    root.scrollTop = Math.max(0, last.offsetTop + last.offsetHeight - root.clientHeight + 16);
  }
}
