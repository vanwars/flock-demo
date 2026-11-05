// Scene 4: lining up plate sightings with purchased phone pings narrows 100 phones to one. All invented.
import { el, clockText } from "./shared.js";
import { update as cardUpdate } from "./card.js";
import { buildWorld, narrowing, nodeXY, XS, YS, CAMS2 } from "./world.js";

const TARGET = 5; // an invented commuter
const GRAPH_NODES = {
  plate: [60, 55, "Plate"], ad: [190, 55, "Ad ID"], contact: [330, 55, "Phone · email"],
  name: [470, 55, "Name"], address: [470, 130, "Home address"], buys: [330, 130, "Shopping habits"],
};
// edge: [from, to, file that provides it]
const GRAPH_EDGES = [
  ["plate", "ad", "a"], ["ad", "contact", "b"], ["contact", "name", "c"],
  ["name", "address", "c"], ["name", "buys", "d"],
];

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const w = buildWorld();
  const slider = $("#s4-k");
  const precSel = $("#s4-prec");
  let result = null;
  const files = new Set(["a"]); // the location file is the one the sightings use

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

  // ----- key graph -----
  const gsvg = el("svg", { viewBox: "0 0 600 180", role: "img", "aria-label": "Graph of linked identifiers: plate, ad ID, phone and email, name, address, shopping habits." });
  $("#s4-graph").replaceChildren(gsvg);
  const gLayer = el("g", {}, gsvg);

  function compute() {
    const [hops, minutes] = precSel.value.split(",").map(Number);
    result = narrowing(TARGET, 12, { hops, minutes });
    slider.max = result.sightings.length;
  }

  function draw() {
    const k = Number(slider.value);
    $("#s4-k-out").textContent = k;
    const remaining = result.remaining[k];
    layer.replaceChildren();

    // Phone pings near the latest sighting: blue = consistent with every sighting so far,
    // gray = near here, but already ruled out by an earlier sighting.
    if (k > 0) {
      const s = result.sightings[k - 1];
      const prev = result.remaining[k - 1];
      let i = 0;
      for (const q of s.pings) {
        const [x, y] = nodeXY(q.node);
        const a = (i++ * 2.399) % (Math.PI * 2);
        const rad = 8 + ((i * 7) % 14);
        el("circle", {
          cx: x + Math.cos(a) * rad, cy: y + Math.sin(a) * rad, r: 3,
          class: prev.has(q.p) ? "s4-live" : "s4-dead",
        }, layer);
      }
    }
    // Plate sightings so far.
    result.sightings.slice(0, k).forEach((s, i) => {
      const [x, y] = nodeXY(s.node);
      el("circle", { cx: x, cy: y, r: 9, class: "s4-sight" }, layer);
      el("text", { x, y: y + 3.5, class: "s4-num", "text-anchor": "middle" }, layer).textContent = i + 1;
    });

    // Counter and candidate list.
    const n = remaining.size;
    $("#s4-n").textContent = n;
    const ids = [...remaining].slice(0, 8).map((p) => w.people[p].adId);
    $("#s4-ids").innerHTML = ids.map((id) => `<code>${id}</code>`).join(" ") + (n > 8 ? ` <span class="note">+${n - 8} more</span>` : "");
    const last = k > 0 ? result.sightings[k - 1] : null;
    $("#s4-msg").textContent =
      k === 0 ? "Start with zero sightings: every phone in town is a candidate."
      : n > 1 ? `Sighting ${k}: Cam ${last.cam}, ${clockText(last.t)}. ${n} phones were near there then, and near every earlier sighting.`
      : n === 1 ? `After ${k} sightings only one advertising ID is consistent with all of them. It is now tied to the plate.`
      : "No phone matches every sighting (the driver's phone did not ping).";
    drawGraph(n);
    cardUpdate({ cand: n, k, files: { b: files.has("b"), c: files.has("c"), d: files.has("d") } });
  }

  function drawGraph(n) {
    gLayer.replaceChildren();
    const linked = new Set(["plate"]);
    const onA = n === 1;
    const active = (e) => (e[2] === "a" ? onA : files.has(e[2]));
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of GRAPH_EDGES) {
        if (active(e) && linked.has(e[0]) && !linked.has(e[1])) (linked.add(e[1]), (grew = true));
      }
    }
    for (const e of GRAPH_EDGES) {
      const [ax, ay] = GRAPH_NODES[e[0]], [bx, by] = GRAPH_NODES[e[1]];
      const on = active(e) && linked.has(e[0]);
      const weak = e[2] === "a" && !onA && n > 1;
      el("line", { x1: ax, y1: ay, x2: bx, y2: by, class: `s4-gedge ${on ? "on" : weak ? "weak" : ""}` }, gLayer);
    }
    for (const [id, [x, y, label]] of Object.entries(GRAPH_NODES)) {
      el("rect", { x: x - 52, y: y - 17, width: 104, height: 34, rx: 8, class: `s4-gnode ${linked.has(id) ? "on" : ""}` }, gLayer);
      el("text", { x, y: y + 4, class: "s3-title", "text-anchor": "middle" }, gLayer).textContent = label;
    }
    const facts = {
      plate: "where the car goes and when", ad: "a persistent advertising ID",
      contact: "a phone number and email", name: "a legal name",
      address: "a home address", buys: "what the household buys",
    };
    $("#s4-facts").textContent = [...linked].map((id) => facts[id]).join(" · ");
  }

  slider.addEventListener("input", draw);
  precSel.addEventListener("change", () => { compute(); slider.value = Math.min(slider.value, slider.max); draw(); });
  root.querySelectorAll("[data-file]").forEach((b) =>
    b.addEventListener("click", () => { files.add(b.dataset.file); draw(); }));
  $("#s4-reset").addEventListener("click", () => { files.clear(); files.add("a"); slider.value = 0; draw(); });
  compute();
  slider.value = 0;
  draw();
}
