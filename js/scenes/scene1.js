// Scene 1: one imaginary car, six weeks of plate reads. All data is invented.
// Each trip is drawn as a faint trace along the roads, so repeated routes build up.
import { el, rng, clockText, inferHabits, player } from "./shared.js";
import { update as cardUpdate } from "./card.js";
import { segmented, rangeWithTicks } from "./ui.js";
import { MAX_HOUR, CAMS, DESTINATIONS, PLACES, ROADS, route, TRIPS } from "./scene1-data.js";

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const slider = $("#concept-slider");
  const clockOut = $("#concept-clock");
  const countOut = $("#concept-count");
  const winSel = $("#concept-window");
  const insights = $("#concept-insights");
  slider.max = MAX_HOUR;
  segmented(winSel);
  rangeWithTicks(slider, {
    ticks: [0, 1, 2, 3, 4, 5].map((w) => [w * 168, `Wk ${w + 1}`]),
    fmt: (v) => clockText(v).replace("Week ", "Wk ").split(" · ")[1],
  });

  const svg = el("svg", {
    viewBox: "0 0 600 380",
    role: "img",
    "aria-label": "Stylized street map. Faint traces from many trips by one imaginary car build up along its regular routes.",
  });
  $("#concept-map").replaceChildren(svg);
  for (const d of ROADS) el("path", { d, class: "c-road" }, svg);
  for (const p of PLACES) {
    el("text", { x: p.x, y: p.y, class: "c-place", "text-anchor": "middle" }, svg).textContent = p.label;
  }
  const traces = el("g", {}, svg);
  const dots = el("g", {}, svg);
  for (const [id, c] of Object.entries(CAMS)) {
    el("circle", { cx: c.x, cy: c.y, r: 6, class: "c-cam" }, svg);
    el("text", { x: c.x + 10, y: c.y - 8, class: "c-camlabel" }, svg).textContent = id;
  }
  const latest = el("circle", { r: 13, class: "c-latest", fill: "none" }, svg);

  // Fixed per-read scatter so each dot stays put as the slider moves.
  const scatter = new Map();
  const jitter = rng(5);
  for (const trip of TRIPS) for (const r of trip.reads) scatter.set(r, [(jitter() - 0.5) * 16, (jitter() - 0.5) * 16]);

  function update() {
    const t = Number(slider.value);
    const win = Number(winSel.value) || Infinity;
    const visible = (r) => r.t <= t && r.t > t - win;
    const seen = [];

    traces.replaceChildren();
    dots.replaceChildren();
    for (const trip of TRIPS) {
      const rs = trip.reads.filter(visible);
      seen.push(...rs);
      if (!rs.length) continue;
      for (const r of rs) {
        const [dx, dy] = scatter.get(r);
        el("circle", { cx: CAMS[r.cam].x + dx, cy: CAMS[r.cam].y + dy, r: 3.2, class: "c-read" }, dots);
      }
      const pts = [];
      for (let i = 1; i < rs.length; i++) {
        const seg = route(rs[i - 1].cam, rs[i].cam);
        pts.push(...(pts.length ? seg.slice(1) : seg));
      }
      if (pts.length > 1) {
        el("polyline", {
          points: pts.map(([x, y]) => `${x + trip.jx},${y + trip.jy}`).join(" "),
          class: "c-trace",
        }, traces);
      }
    }
    seen.sort((a, b) => a.t - b.t);
    const last = seen[seen.length - 1];
    latest.style.display = last && t - last.t < 3 ? "" : "none";
    if (last) {
      latest.setAttribute("cx", CAMS[last.cam].x);
      latest.setAttribute("cy", CAMS[last.cam].y);
    }
    clockOut.textContent = clockText(t);
    countOut.textContent = `${seen.length} read${seen.length === 1 ? "" : "s"} on file`;

    // Guesses an observer could make from what is on file right now.
    const out = [];
    const days = new Set(seen.map((r) => r.day));
    const firstOfDay = new Map();
    for (const r of seen) if (!firstOfDay.has(r.day)) firstOfDay.set(r.day, r.cam);
    const home = days.size >= 3 && [...firstOfDay.values()].filter((c) => c === 1).length >= 0.8 * days.size;
    if (home) out.push("Probably lives near Cam 1: it is the first read on nearly every day.");
    const habits = inferHabits(seen, DESTINATIONS);
    out.push(...habits);
    cardUpdate({ reads: seen.length, days: days.size, home, habits });
    if (Number.isFinite(win) && t > win) {
      out.push(`Reads older than ${win >= 48 ? win / 24 + " days" : "a day"} are gone, so patterns that take longer to show up can't be seen.`);
    }
    if (!out.length) out.push(seen.length ? "Not enough history yet to see a pattern. Keep scrubbing forward." : "Nothing on file yet.");
    // Highlight guesses that were not there a moment ago, so new discoveries catch the eye.
    const known = new Set([...insights.children].map((li) => li.textContent));
    insights.innerHTML = out.map((s) => `<li${known.size && !known.has(s) ? ' class="fresh"' : ""}>${s}</li>`).join("");
  }

  slider.addEventListener("input", update);
  winSel.addEventListener("change", update);
  const playBtn = $("#concept-play");
  const play = player({ button: playBtn, slider, max: MAX_HOUR, step: 4, ms: 60, onTick: update });
  playBtn.classList.add("pulse"); // draw the eye to the one thing to press first
  slider.value = 20;
  slider.dispatchEvent(new Event("sync"));
  update();
  return () => play.stop();
}
