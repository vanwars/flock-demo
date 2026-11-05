// Scene 2: search everyone who drove past a camera, filtered by registry and guessed attributes,
// then follow one plate through the joins that fill in those fields. All invented.
import { el, DAYS } from "./shared.js";
import { CAMS, ROADS, PLACES, TRIPS, route } from "./scene1-data.js";
import { SRC, LAYERS } from "./profile-data.js";
import { update as cardUpdate } from "./card.js";
import { buildWorld, profileSearch, nodeXY, CAMS2, XS, YS } from "./world.js";

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const svg = el("svg", {
    viewBox: "0 0 600 380",
    role: "img",
    "aria-label": "Street map of the imaginary car's routes, with home and work pins appearing as data is joined.",
  });
  $("#s2-map").replaceChildren(svg);
  for (const d of ROADS) el("path", { d, class: "c-road" }, svg);
  for (const p of PLACES) el("text", { x: p.x, y: p.y, class: "c-place", "text-anchor": "middle" }, svg).textContent = p.label;
  const traces = el("g", {}, svg);
  for (const trip of TRIPS) {
    const pts = [];
    for (let i = 1; i < trip.reads.length; i++) {
      const seg = route(trip.reads[i - 1].cam, trip.reads[i].cam);
      pts.push(...(pts.length ? seg.slice(1) : seg));
    }
    if (pts.length > 1) {
      el("polyline", { points: pts.map(([x, y]) => `${x + trip.jx},${y + trip.jy}`).join(" "), class: "c-trace" }, traces);
    }
  }
  for (const [id, c] of Object.entries(CAMS)) {
    el("circle", { cx: c.x, cy: c.y, r: 6, class: "c-cam" }, svg);
    el("text", { x: c.x + 10, y: c.y - 8, class: "c-camlabel" }, svg).textContent = id;
  }
  const pins = el("g", {}, svg);
  const pinAt = { home: [96, 290, "Alex Example, 412 Sample St."], work: [470, 90, "Example Corp."] };

  $("#s2-legend").innerHTML = Object.entries(SRC)
    .map(([k, v]) => `<span class="chip s-${k}">${v}</span>`).join(" ");

  let step = -1;
  function draw() {
    const shown = LAYERS.slice(0, step + 1);
    const total = shown.reduce((n, l) => n + l.fields.length, 0);
    $("#s2-count").textContent = total;
    cardUpdate({ layers: step + 1 });
    $("#s2-card").innerHTML = shown.length
      ? shown.map((l, i) => l.fields.map(([label, value, src]) =>
          `<div class="field${i === step ? " new" : ""}"><span class="fl">${label}</span>` +
          `<span class="fv">${value}</span><span class="chip s-${src}">${SRC[src]}</span></div>`).join("")).join("")
      : `<p class="note">Nothing yet. Press the button to start with the plate reads.</p>`;
    $("#s2-why").textContent = step >= 0 ? LAYERS[step].why : "";
    const next = LAYERS[step + 1];
    const add = $("#s2-add");
    add.textContent = next ? `+ ${next.button}` : "All sources joined";
    add.disabled = !next;
    pins.replaceChildren();
    for (const l of shown) {
      if (!l.pin) continue;
      const [x, y, label] = pinAt[l.pin];
      el("circle", { cx: x, cy: y, r: 9, class: "s2-pin" }, pins);
      el("text", { x, y: y - 14, class: "c-camlabel", "text-anchor": "middle" }, pins).textContent = label;
    }
  }
  $("#s2-add").addEventListener("click", () => { step++; draw(); });
  $("#s2-reset").addEventListener("click", () => { step = -1; draw(); });
  draw();
  mountCrowd(root);
}

// ----- search by location: click a camera, then filter -----
const hourLabel = (h) => (h === 0 || h === 24 ? "midnight" : h === 12 ? "noon" : `${h % 12} ${h < 12 ? "AM" : "PM"}`);

function mountCrowd(root) {
  const $ = (id) => root.querySelector(id);
  const w = buildWorld();
  const age = $("#s2c-age");
  const daySel = $("#s2c-day"), fromSel = $("#s2c-from"), toSel = $("#s2c-to");
  daySel.add(new Option("Any day", -1));
  DAYS.forEach((d, i) => daySel.add(new Option(d, i)));
  for (let h = 0; h < 24; h++) fromSel.add(new Option(h === 0 ? "any time" : hourLabel(h), h));
  for (let h = 1; h <= 24; h++) toSel.add(new Option(h === 24 ? "end of day" : hourLabel(h), h));
  toSel.value = 24;

  // ----- clickable camera map -----
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
    el("circle", { cx: x, cy: y, r: 18, class: "s2c-hit" }, g);
    el("circle", { cx: x, cy: y, r: 7, class: "c-cam" }, g);
    el("text", { x: x + 10, y: y - 9, class: "c-camlabel" }, g).textContent = c.id;
    if (c.label) el("text", { x, y: y + 22, class: "c-place", "text-anchor": "middle" }, g).textContent = c.label;
    const pick = () => { cam = c.id; run(); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    dots.set(c.id, g);
  }

  function run() {
    const winH = Number($("#s2c-window").value);
    $("#s2c-age-out").textContent = age.value;
    const delivery = $("#s2c-delivery").checked, hispanic = $("#s2c-hisp").checked;
    const q = {
      cam, t: 1007, win: winH || Infinity,
      weekday: Number(daySel.value), h0: Number(fromSel.value), h1: Number(toSel.value),
      delivery, hispanic, gender: $("#s2c-gender").value, maxAge: Number(age.value),
    };
    for (const [id, g] of dots) g.classList.toggle("sel", id === cam);
    const camInfo = CAMS2.find((c) => c.id === cam);
    const place = `Cam ${cam}${camInfo.label ? " (" + camInfo.label + ")" : ""}`;
    const when = [
      q.weekday >= 0 ? `on ${DAYS[q.weekday]}s` : "",
      q.h0 > 0 || q.h1 < 24 ? `between ${q.h0 === 0 ? "midnight" : hourLabel(q.h0)} and ${q.h1 === 24 ? "midnight" : hourLabel(q.h1)}` : "",
    ].filter(Boolean).join(" ");
    $("#s2c-where").textContent = `Selected: ${place}.`;

    const r = profileSearch(w, q);
    const truth = $("#s2c-truth").checked;
    const n = r.returned.length;
    $("#s2c-summary").innerHTML =
      `<b>${r.passedHere} plates</b> drove past ${place}${when ? " " + when : ""}. The filters pick <b>${n}</b> of them.`;
    $("#s2c-accuracy").innerHTML = n || r.missed.length
      ? `<div><b>${r.wrong.length}</b><span> of the ${n} picked do not fit: the guess was wrong</span></div>` +
        `<div><b>${r.missed.length}</b><span> ${r.missed.length === 1 ? "person who fits was" : "people who fit were"} not picked</span></div>`
      : "";
    const rows = r.returned.slice(0, 14).map(({ p, pH, fitsTruth }) => {
      const guess = [];
      if (delivery) guess.push("delivery driver");
      if (hispanic) guess.push(`likely Hispanic (${Math.round(pH * 100)}%)`);
      const real = [];
      if (delivery) real.push(`<span class="${p.job === "delivery driver" ? "" : "bad"}">${p.job}</span>`);
      if (hispanic) real.push(`<span class="${p.group === "Hispanic" ? "" : "bad"}">${p.group === "Hispanic" ? "Hispanic" : "not Hispanic (" + p.group + ")"}</span>`);
      return `<tr class="${fitsTruth ? "" : "wrong"}"><td><code>${p.plate}</code></td><td>${p.name}</td>` +
        `<td>${p.age}, ${p.gender}</td><td>${guess.join(" · ") || "(no guess used)"}</td>` +
        (truth ? `<td>${real.join(" · ") || "-"}</td>` : "") + `</tr>`;
    });
    $("#s2c-table").innerHTML = n
      ? `<tr><th>Plate</th><th>Registry name</th><th>Age, gender</th><th>Guessed</th>${truth ? "<th>In fact</th>" : ""}</tr>` +
        rows.join("") + (n > 14 ? `<tr><td colspan="5" class="note">…and ${n - 14} more.</td></tr>` : "")
      : `<tr><td class="note">Nobody matches. Loosen a filter.</td></tr>`;
  }
  const PRESETS = {
    a: { delivery: true, hisp: true, age: 35 },
    b: { delivery: false, hisp: true, age: 30 },
    c: { delivery: true, hisp: false, age: 80 },
  };
  root.querySelectorAll("[data-s2c]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.s2c];
    $("#s2c-delivery").checked = p.delivery;
    $("#s2c-hisp").checked = p.hisp;
    age.value = p.age;
    run();
  }));
  for (const id of ["#s2c-day", "#s2c-from", "#s2c-to", "#s2c-window", "#s2c-delivery", "#s2c-hisp", "#s2c-gender", "#s2c-age", "#s2c-truth"]) {
    $(id).addEventListener(id === "#s2c-age" ? "input" : "change", run);
  }
  run();
}
