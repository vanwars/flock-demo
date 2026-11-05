// Scene 4: lining up plate sightings with purchased phone pings narrows 100 phones to one,
// then purchased files join a name, address and shopping habits onto the plate. All invented.
import { el, clockText, player } from "./shared.js";
import { update as cardUpdate } from "./card.js";
import { createJoin } from "./join.js";
import { segmented, rangeWithTicks, actionStrip, countUp, announce } from "./ui.js";
import { buildWorld, narrowing, nodeXY, XS, YS, CAMS2 } from "./world.js";

const TARGET = 5; // an invented commuter
const RING = 351.9; // circumference of the counter ring

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const w = buildWorld();
  const me = w.people[TARGET];
  const strip = actionStrip(root);
  const slider = $("#s4-k");
  const precSel = $("#s4-prec");
  let result = null;
  let n = 100; // phones still possible

  // The counter ring (built here, not in the partial, so no </svg> appears in an HTML fragment).
  const ringSvg = el("svg", { viewBox: "0 0 132 132", "aria-hidden": "true" });
  el("circle", { class: "track", cx: 66, cy: 66, r: 56 }, ringSvg);
  el("circle", { class: "arc", id: "s4-arc", cx: 66, cy: 66, r: 56, "stroke-dasharray": String(RING), "stroke-dashoffset": "0" }, ringSvg);
  $(".ring").prepend(ringSvg);

  segmented(precSel);
  const range = rangeWithTicks(slider, { ticks: [[0, "0"], [6, "6"], [12, "12"]], fmt: (v) => `${v} lined up` });

  // ----- map -----
  const svg = el("svg", {
    viewBox: "0 0 600 380",
    role: "img",
    "aria-label": "Street grid. Red numbered markers are plate sightings; blue dots are phones still possible; gray dots are phones ruled out.",
  });
  $("#s4-map").replaceChildren(svg);
  const [x0, x1] = [XS[0], XS[XS.length - 1]], [y0, y1] = [YS[0], YS[YS.length - 1]];
  for (const x of XS) el("path", { d: `M${x} ${y0 - 40}V${y1 + 60}`, class: "c-road" }, svg);
  for (const y of YS) el("path", { d: `M${x0 - 40} ${y}H${x1 + 40}`, class: "c-road" }, svg);
  for (const c of CAMS2) {
    const [x, y] = nodeXY(c.node);
    el("circle", { cx: x, cy: y, r: 4, class: "c-cam" }, svg);
  }
  const layer = el("g", {}, svg);

  // ----- the purchased-file joins -----
  const others = [w.people[6], w.people[7]];
  const join = createJoin($("#s4-join"), {
    rowTitle: "Our row: the plate, and the phone we just found",
    baseCells: [
      { id: "plate", label: "Plate", value: me.plate, src: "camera" },
      { id: "where", label: "Where and when", value: "6 weeks of sightings", src: "camera" },
    ],
    crumbs: ["plate", "ad ID", "phone · email", "name", "shopping"],
    baseReached: () => (n === 1 ? 2 : 1),
    startCaption: "Add sightings above until one phone is left, then join the purchased files.",
    gate: (i) => (i === 0 && n !== 1 ? { ok: false, why: "Add sightings above until only one phone is left." } : { ok: true }),
    steps: [
      {
        file: "Advertising-ID linking file", key: "ad ID", keyCell: "adid", keyValue: me.adId,
        rows: [[me.adId, "(555) 010-0417 · alex@example.test"], [others[0].adId, "(555) 010-2231 · j.r@example.test"], [others[1].adId, "(555) 010-8842 · m.k@example.test"]],
        matchIndex: 0, adds: "phone number, email", arrow: "ad-ID file",
        cells: [{ id: "contact", label: "Phone, email", value: "(555) 010-0417 · alex@example.test", src: "joined" }],
        caption: "Looked up the advertising ID in a file that links IDs to phone numbers and email addresses. Found 1 row. Our row now has a phone number and an email.",
      },
      {
        file: "People-search / credit-header file", key: "phone · email", keyCell: "contact", keyValue: "(555) 010-0417",
        rows: [["(555) 010-0417", "Alex Example · 2 adults · 2 earlier addresses"], ["(555) 010-2231", "J. Rivera · 1 adult"], ["(555) 010-8842", "M. Kim · 3 adults"]],
        matchIndex: 0, adds: "name, household members, past addresses", arrow: "people-search",
        cells: [
          { id: "name", label: "Name", value: "Alex Example", src: "joined" },
          { id: "household", label: "Household, past addresses", value: "2 adults here; 2 earlier addresses", src: "joined" },
        ],
        caption: "Looked up the phone number in a people-search file. Found 1 row. Our row now has a name, who lives with them, and where they lived before.",
      },
      {
        file: "Loyalty-card purchases", key: "name", keyCell: "name", keyValue: "Alex Example",
        rows: [["Alex Example", "Weekly grocery run · gym membership"], ["J. Rivera", "Pharmacy, hardware store"], ["M. Kim", "Online orders"]],
        matchIndex: 0, adds: "shopping habits", arrow: "purchases",
        cells: [{ id: "buys", label: "Shopping habits", value: "Weekly grocery run; gym membership", src: "joined" }],
        caption: "Looked up the name in a loyalty-card file. Found 1 row. Our row now says what this household buys, and how often.",
      },
    ],
    onChange: () => publish(),
  });
  function files() {
    const d = join.state().done;
    return { b: d >= 1, c: d >= 2, d: d >= 3 };
  }
  function publish() {
    cardUpdate({ cand: n, k: Number(slider.value), files: files() });
  }

  function compute() {
    const [hops, minutes] = precSel.value.split(",").map(Number);
    result = narrowing(TARGET, 12, { hops, minutes });
    slider.max = result.sightings.length;
    range?.rebuild();
    slider.dispatchEvent(new Event("sync"));
  }

  function draw() {
    const k = Number(slider.value);
    const remaining = result.remaining[k];
    layer.replaceChildren();
    if (k > 0) {
      // Phone pings near the latest sighting: blue = consistent with every sighting so far,
      // gray = near here, but already ruled out by an earlier sighting.
      const s = result.sightings[k - 1];
      const prev = result.remaining[k - 1];
      let i = 0;
      for (const q of s.pings) {
        const [x, y] = nodeXY(q.node);
        const a = (i++ * 2.399) % (Math.PI * 2);
        const rad = 8 + ((i * 7) % 14);
        el("circle", { cx: x + Math.cos(a) * rad, cy: y + Math.sin(a) * rad, r: 3, class: prev.has(q.p) ? "s4-live" : "s4-dead" }, layer);
      }
    }
    result.sightings.slice(0, k).forEach((s, i) => {
      const [x, y] = nodeXY(s.node);
      el("circle", { cx: x, cy: y, r: 10, class: "s4-sight" }, layer);
      el("text", { x, y: y + 3.5, class: "s4-num", "text-anchor": "middle" }, layer).textContent = i + 1;
    });

    const prevN = n;
    n = remaining.size;
    countUp($("#s4-n"), n);
    $("#s4-arc").style.strokeDashoffset = String(RING * (1 - n / 100));
    const ids = [...remaining].slice(0, 6).map((p) => w.people[p].adId);
    $("#s4-ids").innerHTML = ids.map((id) => `<code>${id}</code>`).join("") + (n > 6 ? `<span class="note">+${n - 6} more</span>` : "");
    const last = k > 0 ? result.sightings[k - 1] : null;
    $("#s4-msg").textContent =
      k === 0 ? "Start with zero sightings: every phone in town is a candidate."
      : n > 1 ? `Sighting ${k}: Cam ${last.cam}, ${clockText(last.t)}. ${n} phones were near there then, and near every earlier sighting.`
      : n === 1 ? `After ${k} sightings only one advertising ID is consistent with all of them. It is now tied to the plate.`
      : "No phone matches every sighting (the driver's phone did not ping).";

    // The advertising ID appears on our row once it is the only one left.
    if (n === 1) join.addCell({ id: "adid", label: "Advertising ID", value: me.adId, src: "joined" });
    else join.removeCell("adid");
    join.refresh();
    publish();

    const max = result.sightings.length;
    if (n === 1) {
      strip.set({
        step: "Found it", total: 0,
        title: `One phone left after ${k} sightings. Now buy the missing files.`,
        label: "Buy the missing files", onClick: () => $("#s4-join").scrollIntoView({ behavior: "smooth", block: "center" }),
      });
      if (prevN !== 1) announce(`Only one phone is left after ${k} sightings.`);
    } else {
      strip.set({
        step: k ? `Sighting ${k} of ${max}` : "Start", total: 0,
        title: `${n} phone${n === 1 ? "" : "s"} could be the driver. ${k < max ? "Add a sighting to narrow it down." : "That is every sighting there is."}`,
        label: k < max ? "Add a sighting" : "Start over", onClick: () => {
          slider.value = k < max ? k + 1 : 0;
          slider.dispatchEvent(new Event("sync"));
          draw();
        },
      });
    }
  }

  slider.addEventListener("input", draw);
  precSel.addEventListener("change", () => {
    compute();
    slider.value = Math.min(Number(slider.value), Number(slider.max));
    slider.dispatchEvent(new Event("sync"));
    draw();
  });
  const playBtn = $("#s4-play");
  const play = player({ button: playBtn, slider, max: 12, step: 1, ms: 900, onTick: () => {
    slider.value = Math.min(Number(slider.value), Number(slider.max));
    draw();
    if (Number(slider.value) >= Number(slider.max) || n === 1) play.stop();
  } });
  $("#s4-reset").addEventListener("click", () => {
    join.reset();
    slider.value = 0;
    slider.dispatchEvent(new Event("sync"));
    draw();
  });

  compute();
  slider.value = 0;
  slider.dispatchEvent(new Event("sync"));
  draw();
  return () => play.stop();
}
