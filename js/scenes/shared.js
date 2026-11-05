// Helpers shared by the scenes. Everything the scenes show is invented.
export const NS = "http://www.w3.org/2000/svg";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

// Small seeded random numbers so the invented data is the same every time.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// t is hours since the start of week 1, Monday 00:00.
export const clockText = (t) => {
  const day = Math.floor(t / 24);
  const h = t - day * 24;
  const hh = String(Math.floor(h)).padStart(2, "0");
  const mm = String(Math.floor((h % 1) * 60)).padStart(2, "0");
  return `Week ${Math.floor(day / 7) + 1} · ${DAYS[day % 7].slice(0, 3)} ${hh}:${mm}`;
};

export function timeOfDay(h) {
  const total = Math.round(h * 2) / 2; // nearest half hour
  const hr = Math.floor(total) % 24;
  const min = total % 1 ? "30" : "";
  if (hr === 12 && !min) return "noon";
  const h12 = hr % 12 || 12;
  return `${h12}${min ? ":" + min : ""} ${hr < 12 ? "AM" : "PM"}`;
}

export function duration(h) {
  if (h < 0.9) return `${Math.round((h * 60) / 5) * 5} minutes`;
  if (h < 1.5) return "an hour";
  return `${Math.round(h)} hours`;
}

export function dayList(days) {
  const idx = [...days].sort((a, b) => a - b);
  const runs = [];
  for (const d of idx) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else runs.push([d]);
  }
  const parts = runs.flatMap((run) =>
    run.length >= 3 ? [`${DAYS[run[0]]} through ${DAYS[run[run.length - 1]]}`] : run.map((d) => DAYS[d]),
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

// Turn reads (each {t, day, hour, cam}) into plain-English guesses about habits.
// `destinations` maps a camera id to a place name, e.g. { 4: "the gym" }.
export function inferHabits(reads, destinations) {
  // A "visit" = the car is read at a destination camera and then read at that same camera again,
  // with no other camera in between (it sat there), 20 minutes to 13 hours apart.
  const visits = [];
  for (let i = 0; i < reads.length; ) {
    let j = i;
    while (j + 1 < reads.length && reads[j + 1].cam === reads[i].cam) j++;
    const first = reads[i], last = reads[j];
    const stay = last.t - first.t;
    if (j > i && destinations[first.cam] && stay >= 1 / 3 && stay <= 13) {
      visits.push({ cam: first.cam, weekday: first.day % 7, hour: first.hour, stay });
    }
    i = j + 1;
  }
  const out = [];
  for (const cam of Object.keys(destinations)) {
    // Group this camera's visits into time-of-day clusters (e.g. weekday evenings vs Saturday morning).
    const mine = visits.filter((v) => v.cam === Number(cam)).sort((a, b) => a.hour - b.hour);
    const clusters = [];
    for (const v of mine) {
      const c = clusters[clusters.length - 1];
      if (c && v.hour - c[c.length - 1].hour <= 2) c.push(v);
      else clusters.push([v]);
    }
    for (const c of clusters) {
      if (c.length < 3) continue;
      const perDay = new Map();
      for (const v of c) perDay.set(v.weekday, (perDay.get(v.weekday) ?? 0) + 1);
      const top = Math.max(...perDay.values());
      const days = [...perDay].filter(([, n]) => n >= 2 && n >= 0.6 * top).map(([d]) => d);
      if (!days.length) continue;
      const hour = median(c.map((v) => v.hour));
      out.push({
        order: hour,
        text: `Goes to ${destinations[cam]} every ${dayList(days)} around ${timeOfDay(hour)}, staying about ${duration(median(c.map((v) => v.stay)))}.`,
      });
    }
  }
  return out.sort((a, b) => a.order - b.order).map((o) => o.text);
}

// A stepper-friendly play loop: returns {toggle, stop}.
export function player({ button, slider, max, step, ms, onTick }) {
  let timer = null;
  const stop = () => {
    clearInterval(timer);
    timer = null;
    button.textContent = "▶ Play";
  };
  const toggle = () => {
    if (timer) return stop();
    if (Number(slider.value) >= max) slider.value = 0;
    button.textContent = "❚❚ Pause";
    timer = setInterval(() => {
      slider.value = Math.min(max, Number(slider.value) + step);
      onTick();
      if (Number(slider.value) >= max) stop();
    }, ms);
  };
  button.addEventListener("click", toggle);
  return { stop };
}
