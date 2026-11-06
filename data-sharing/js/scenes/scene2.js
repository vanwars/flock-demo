// Scene 2: how a join works (part A, one car) and a search of everyone who drove past a camera (part B).
// Everything here is invented.
import { el, DAYS } from "./shared.js";
import { LAYERS } from "./profile-data.js";
import { update as cardUpdate } from "./card.js";
import { createJoin, joinDemo } from "./join.js";
import { segmented, toggleChip, rangeWithTicks, actionStrip, announce } from "./ui.js";
import { buildWorld, profileSearch, nodeXY, CAMS2, XS, YS } from "./world.js";

// ----- part A: four joins onto one plate -----
const cellsOf = (li) => LAYERS[li].fields.map(([label, value, src], fi) => ({ id: `l${li}_${fi}`, label, value, src }));
const BASE_IDS = ["plate", "vehicle", "route", "stops", "homeguess"];
const BASE_CELLS = LAYERS[0].fields.map(([label, value, src], i) => ({ id: BASE_IDS[i], label, value, src }));

const JOIN_STEPS = [
  {
    file: "Vehicle registry", key: "plate", keyCell: "plate", keyValue: "XYZ-0417",
    rows: [["XYZ-0417", "Alex Example · 412 Sample St."], ["QRS-2231", "J. Rivera · 9 Pine Ct."], ["ABC-9921", "M. Kim · 77 Oak Ave."]],
    matchIndex: 0, adds: "name, address, age, sex, vehicle record", arrow: "registry", cells: cellsOf(1),
    caption: "Looked up XYZ-0417 in the vehicle registry. Found 1 row. Copied its name, address, age and sex onto our row.",
  },
  {
    file: "Address map", key: "address", keyCell: "l1_1", keyValue: "412 Sample St.",
    rows: [["412 Sample St.", "0.3 mi from Cam 1"], ["9 Pine Ct.", "1.8 mi from Cam 6"], ["77 Oak Ave.", "0.5 mi from Cam 4"]],
    matchIndex: 0, adds: "whether the address fits where the car sleeps", arrow: "map", cells: cellsOf(2),
    caption: "Looked up the address on a map. It is a few blocks from Cam 1, where the car sleeps, so the guess from scene 1 is now a confirmed home.",
  },
  {
    file: "Census statistics", key: "census area (from the address)", keyCell: "l1_1", keyValue: "block group 0034.02",
    rows: [["BG 0034.02", "$55–65k · 62% renters"], ["BG 0034.01", "$72k · 48% renters"], ["BG 0035.00", "$41k · 71% renters"]],
    matchIndex: 0, adds: "area income, renters, household size, education, a guessed ethnicity", arrow: "census", cells: cellsOf(3),
    caption: "Looked up the home's census area. These are averages for the area, yet joined to a name they read like facts about one person. Race is on no record, so it is guessed.",
  },
  {
    file: "Business directory", key: "place the car stays", keyCell: "route", keyValue: "near Cam 3",
    rows: [["near Cam 3", "Example Corp."], ["near Cam 5", "Corner Grocery"], ["near Cam 4", "Gym & Fitness"]],
    matchIndex: 0, adds: "likely workplace and hours", arrow: "directory", cells: cellsOf(4),
    caption: "The car spends about nine hours a day near Cam 3. A business directory lists who is there: a likely employer.",
  },
];

// ----- part B: search everyone -----
const PRESETS = {
  a: { delivery: true, hisp: true, age: 35 },
  b: { delivery: false, hisp: true, age: 30 },
  c: { delivery: true, hisp: false, age: 80 },
};
const hourLabel = (h) => (h === 0 || h === 24 ? "midnight" : h === 12 ? "noon" : `${h % 12} ${h < 12 ? "AM" : "PM"}`);
const pluralize = (n, one, many) => (n === 1 ? one : many);

export function mount(root) {
  const $ = (s) => root.querySelector(s);
  const strip = actionStrip(root);
  const partSel = $("#s2-part");
  segmented(partSel);
  const partA = $("#s2-part-a"), partB = $("#s2c-part");

  // ----- part A -----
  joinDemo($("#s2-jd"));
  const join = createJoin($("#s2-join"), {
    rowTitle: "Our row: one plate from scene 1",
    baseCells: BASE_CELLS,
    crumbs: ["plate", "name + address", "home confirmed", "census area", "workplace"],
    baseReached: () => 1,
    steps: JOIN_STEPS,
    startCaption: "Press the highlighted card's button, or the red button above, to join it onto our row.",
    onChange: () => {
      cardUpdate({ layers: join.state().done + 1 });
      // A join can finish after you switched to part B; only part A owns the strip while it is showing.
      if (!partA.hidden) stripForA();
    },
  });
  function stripForA() {
    const s = join.state();
    if (s.next) {
      strip.set({
        step: s.done + 1, total: s.total,
        title: `Join the ${s.next.file.toLowerCase()} (matches on ${s.next.key})`,
        label: `Join: ${s.next.file}`, onClick: join.joinNext,
      });
    } else {
      strip.set({
        step: s.total + 1, total: s.total,
        title: "All four joined. One plate is now a person.",
        label: "Search everyone", onClick: () => setPart("b"),
      });
    }
  }
  $("#s2-reset").addEventListener("click", () => {
    join.reset();
    cardUpdate({ layers: 1 });
    stripForA();
  });

  // ----- part B: setup -----
  const w = buildWorld();
  const age = $("#s2c-age");
  const daySel = $("#s2c-day"), fromSel = $("#s2c-from"), toSel = $("#s2c-to"), winSel = $("#s2c-window");
  const genderSel = $("#s2c-gender"), deliveryCb = $("#s2c-delivery"), hispCb = $("#s2c-hisp"), truthCb = $("#s2c-truth");
  daySel.add(new Option("Any day", -1));
  DAYS.forEach((d, i) => daySel.add(new Option(d, i)));
  for (let h = 0; h < 24; h++) fromSel.add(new Option(h === 0 ? "any time" : hourLabel(h), h));
  for (let h = 1; h <= 24; h++) toSel.add(new Option(hourLabel(h), h));
  toSel.value = 24;
  segmented(winSel);
  segmented(genderSel);
  toggleChip(deliveryCb, { hint: "a guess" });
  toggleChip(hispCb, { hint: "a guess" });
  toggleChip(truthCb);
  rangeWithTicks(age, {
    ticks: [[20, "20"], [40, "40"], [60, "60"], [80, "any"]],
    fmt: (v) => (v >= 80 ? "any age" : `under ${v}`),
  });

  let cam = 6;
  const svg = el("svg", {
    viewBox: "0 0 600 380",
    role: "group",
    "aria-label": "Street map of the invented town with 12 cameras. Choose one to see who drove past it.",
  });
  $("#s2c-map").replaceChildren(svg);
  const [x0, x1] = [XS[0], XS[XS.length - 1]], [y0, y1] = [YS[0], YS[YS.length - 1]];
  for (const x of XS) el("path", { d: `M${x} ${y0 - 40}V${y1 + 60}`, class: "c-road" }, svg);
  for (const y of YS) el("path", { d: `M${x0 - 40} ${y}H${x1 + 40}`, class: "c-road" }, svg);
  el("text", { x: 90, y: 372, class: "c-place", "text-anchor": "middle" }, svg).textContent = "homes (no cameras)";
  const dots = new Map();
  for (const c of CAMS2) {
    const [x, y] = nodeXY(c.node);
    const g = el("g", {
      class: "s2c-cam", tabindex: 0, role: "button",
      "aria-label": `Camera ${c.id}${c.label ? ", " + c.label : ""}`,
    }, svg);
    el("title", {}, g).textContent = `Cam ${c.id}${c.label ? " · " + c.label : ""}: click to see who drove past`;
    el("circle", { cx: x, cy: y, r: 18, class: "s2c-hit" }, g);
    el("circle", { cx: x, cy: y, r: 7, class: "c-cam" }, g);
    el("text", { x: x + 10, y: y - 9, class: "c-camlabel" }, g).textContent = c.id;
    if (c.label) el("text", { x, y: y + 22, class: "c-place", "text-anchor": "middle" }, g).textContent = c.label;
    const pick = () => { cam = c.id; run(); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    dots.set(c.id, g);
  }

  const sync = (...els) => els.forEach((e) => e.dispatchEvent(new Event("sync")));
  const camName = () => {
    const c = CAMS2.find((k) => k.id === cam);
    return `Cam ${cam}${c.label ? " · " + c.label : ""}`;
  };

  // Active-filter chips: each can be removed (the camera cannot; a search needs a place).
  function drawChips(q) {
    const list = [{ label: camName() }];
    const clearers = [null];
    if (q.weekday >= 0) { list.push({ label: `${DAYS[q.weekday]}s` }); clearers.push(() => { daySel.value = -1; }); }
    if (q.h0 > 0 || q.h1 < 24) {
      list.push({ label: `${q.h0 === 0 ? "midnight" : hourLabel(q.h0)} to ${q.h1 === 24 ? "midnight" : hourLabel(q.h1)}` });
      clearers.push(() => { fromSel.value = 0; toSel.value = 24; });
    }
    if (q.win !== Infinity) { list.push({ label: `reads kept ${winSel.selectedOptions[0].dataset.short}` }); clearers.push(() => { winSel.value = 0; }); }
    if (q.delivery) { list.push({ label: "likely delivery driver (guess)" }); clearers.push(() => { deliveryCb.checked = false; }); }
    if (q.hispanic) { list.push({ label: "likely Hispanic (guess)" }); clearers.push(() => { hispCb.checked = false; }); }
    if (q.gender) { list.push({ label: q.gender === "woman" ? "women" : "men" }); clearers.push(() => { genderSel.value = ""; }); }
    if (q.maxAge < 200) { list.push({ label: `under ${q.maxAge}` }); clearers.push(() => { age.value = 80; }); }
    const host = $("#s2c-chips");
    host.replaceChildren(...list.map((c, i) => {
      const s = document.createElement("span");
      s.className = "afchip";
      s.textContent = c.label;
      if (clearers[i]) {
        const x = document.createElement("button");
        x.type = "button";
        x.setAttribute("aria-label", `Remove filter: ${c.label}`);
        x.textContent = "×";
        x.addEventListener("click", () => { clearers[i](); sync(daySel, fromSel, toSel, winSel, deliveryCb, hispCb, genderSel, age); run(); });
        s.append(" ", x);
      } else s.style.paddingRight = "10px";
      return s;
    }));
  }

  function run() {
    const winH = Number(winSel.value);
    const delivery = deliveryCb.checked, hispanic = hispCb.checked;
    const limit = Number(age.value) >= 80 ? 200 : Number(age.value);
    const q = {
      cam, t: 1007, win: winH || Infinity,
      weekday: Number(daySel.value), h0: Number(fromSel.value), h1: Number(toSel.value),
      delivery, hispanic, gender: genderSel.value, maxAge: limit,
    };
    for (const [id, g] of dots) g.classList.toggle("sel", id === cam);
    $("#s2c-where").textContent = `Selected: ${camName()}. Click another camera to move the search.`;
    drawChips(q);

    const r = profileSearch(w, q);
    const truth = truthCb.checked;
    const n = r.returned.length;
    const when = [
      q.weekday >= 0 ? `on ${DAYS[q.weekday]}s` : "",
      q.h0 > 0 || q.h1 < 24 ? `between ${q.h0 === 0 ? "midnight" : hourLabel(q.h0)} and ${q.h1 === 24 ? "midnight" : hourLabel(q.h1)}` : "",
    ].filter(Boolean).join(" ");
    $("#s2c-summary").innerHTML =
      `<b>${r.passedHere} plates</b> drove past ${camName()}${when ? " " + when : ""}. The filters pick <b>${n}</b> of them.`;

    $("#s2c-stats").innerHTML =
      `<div class="stat"><b>${n}</b><span>${pluralize(n, "plate picked", "plates picked")}</span></div>` +
      `<div class="stat${r.wrong.length ? " bad" : ""}"><b>${r.wrong.length}</b><span>${r.wrong.length ? "✗ " : ""}${pluralize(r.wrong.length, "pick was wrong", "picks were wrong")}: the guess got them wrong</span></div>` +
      `<div class="stat${r.missed.length ? " bad" : ""}"><b>${r.missed.length}</b><span>${pluralize(r.missed.length, "person who fits was missed", "people who fit were missed")}</span></div>`;

    const head =
      `<thead><tr><th>Plate <span class="chip s-camera">camera</span></th>` +
      `<th>Name, age, gender <span class="chip s-joined">registry</span></th>` +
      `<th>Guessed <span class="chip s-estimate">guess</span></th>` +
      (truth ? `<th>In fact <span class="chip claim">real answer</span></th>` : "") +
      `<th>Result</th></tr></thead>`;
    const rows = r.returned.slice(0, 14).map(({ p, pH, fitsTruth }) => {
      const guess = [];
      if (delivery) guess.push("delivery driver");
      if (hispanic) guess.push(`likely Hispanic (${Math.round(pH * 100)}%)`);
      const real = [];
      if (delivery) real.push(`<span class="${p.job === "delivery driver" ? "" : "bad"}">${p.job}</span>`);
      if (hispanic) real.push(`<span class="${p.group === "Hispanic" ? "" : "bad"}">${p.group === "Hispanic" ? "Hispanic" : "not Hispanic (" + p.group + ")"}</span>`);
      return `<tr class="${fitsTruth ? "" : "wrong"}"><td data-label="Plate"><code>${p.plate}</code></td>` +
        `<td data-label="Name, age, gender">${p.name} · ${p.age} · ${p.gender}</td>` +
        `<td data-label="Guessed">${guess.join(" · ") || "(no guess used)"}</td>` +
        (truth ? `<td data-label="In fact">${real.join(" · ") || "-"}</td>` : "") +
        `<td data-label="Result">${fitsTruth ? '<span class="verdict good">✓ fits</span>' : '<span class="verdict bad">✗ wrong guess</span>'}</td></tr>`;
    });
    $("#s2c-table").innerHTML = n
      ? head + `<tbody>${rows.join("")}${n > 14 ? `<tr><td colspan="5" class="note">…and ${n - 14} more.</td></tr>` : ""}</tbody>`
      : `<tbody><tr><td colspan="5"><div class="empty">Nobody matches. Loosen a filter, or remove one with its × above.</div></td></tr></tbody>`;
  }

  const applyPreset = (p) => {
    deliveryCb.checked = p.delivery;
    hispCb.checked = p.hisp;
    age.value = p.age;
    sync(deliveryCb, hispCb, age);
    run();
  };
  root.querySelectorAll("[data-s2c]").forEach((b) => b.addEventListener("click", () => applyPreset(PRESETS[b.dataset.s2c])));
  for (const e of [daySel, fromSel, toSel, winSel, deliveryCb, hispCb, genderSel, truthCb]) e.addEventListener("change", run);
  age.addEventListener("input", run);

  // ----- switching parts -----
  let presetIdx = -1;
  function stripForB() {
    strip.set({
      step: "Part B · Search everyone", total: 0,
      title: "Click a camera, narrow the list, read the results",
      label: "Try an example",
      onClick: () => {
        presetIdx = (presetIdx + 1) % 3;
        applyPreset(PRESETS["abc"[presetIdx]]);
        announce("Example search applied");
      },
    });
  }
  function setPart(p) {
    partSel.value = p;
    sync(partSel);
    partA.hidden = p !== "a";
    partB.hidden = p !== "b";
    if (p === "a") stripForA();
    else {
      stripForB();
      run();
    }
    if (p === "b") window.scrollTo({ top: root.querySelector(".card").getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  }
  partSel.addEventListener("change", () => setPart(partSel.value));

  cardUpdate({ layers: 1 });
  setPart("a");
}
