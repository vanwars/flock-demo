// Scene 3: who can search which agency's reads, depending on each agency's sharing setting. All invented.
import { el } from "./shared.js";
import { update as cardUpdate } from "./card.js";

const AGENCIES = [
  { id: "campus", name: "Campus police", reads: 1200, x: 70, y: 60 },
  { id: "city", name: "City police", reads: 18000, x: 70, y: 175 },
  { id: "county", name: "County sheriff", reads: 9000, x: 70, y: 290 },
];
const SETTINGS = [
  ["national", "with agencies nationwide"],
  ["state", "with agencies in this state"],
  ["none", "with no one"],
];
const VENDOR = { x: 300, y: 175 };
const SEARCHERS = {
  state: { name: "State agency", sub: "in this state", x: 505, y: 100, inState: true },
  federal: { name: "Federal immigration agency", sub: "out of state", x: 505, y: 250, inState: false },
};
const fmt = (n) => n.toLocaleString();

// Can this searcher reach an agency's reads under that agency's setting?
export const canReach = (setting, searcher) =>
  setting === "national" || (setting === "state" && searcher.inState);

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const settings = { campus: "national", city: "state", county: "none" };
  for (const a of AGENCIES) {
    const sel = $(`#s3-${a.id}`);
    for (const [v, label] of SETTINGS) sel.add(new Option(label, v));
    sel.value = settings[a.id];
    sel.addEventListener("change", () => { settings[a.id] = sel.value; draw(); });
  }
  root.querySelectorAll('input[name="s3-who"]').forEach((r) => r.addEventListener("change", draw));

  const svg = el("svg", {
    viewBox: "0 0 600 360",
    role: "img",
    "aria-label": "Diagram: three local agencies send reads to a vendor cloud, which a state agency or a federal agency can search depending on each local agency's sharing setting.",
  });
  $("#s3-map").replaceChildren(svg);
  const edges = el("g", {}, svg);
  const nodes = el("g", {}, svg);

  function node(x, y, w, h, title, sub, cls = "") {
    el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, class: `s3-node ${cls}` }, nodes);
    el("text", { x, y: sub ? y - 3 : y + 4, class: "s3-title", "text-anchor": "middle" }, nodes).textContent = title;
    if (sub) el("text", { x, y: y + 13, class: "s3-sub", "text-anchor": "middle" }, nodes).textContent = sub;
  }

  function draw() {
    const who = SEARCHERS[root.querySelector('input[name="s3-who"]:checked').value];
    edges.replaceChildren();
    nodes.replaceChildren();
    let reach = 0;
    const total = AGENCIES.reduce((n, a) => n + a.reads, 0);
    for (const a of AGENCIES) {
      const ok = canReach(settings[a.id], who);
      if (ok) reach += a.reads;
      el("line", { x1: a.x + 60, y1: a.y, x2: VENDOR.x - 50, y2: VENDOR.y, class: `s3-edge ${ok ? "open" : "shut"}` }, edges);
    }
    const anyOpen = reach > 0;
    el("line", { x1: VENDOR.x + 50, y1: VENDOR.y, x2: who.x - 85, y2: who.y, class: `s3-edge ${anyOpen ? "open to-searcher" : "shut"}` }, edges);
    for (const a of AGENCIES) {
      node(a.x, a.y, 120, 46, a.name, `${fmt(a.reads)} reads/mo`, canReach(settings[a.id], who) ? "reach" : "");
    }
    node(VENDOR.x, VENDOR.y, 100, 56, "Vendor cloud", "stores every read");
    node(who.x, who.y, 170, 50, who.name, `${who.sub}, runs the search`, "searcher");
    $("#s3-result").innerHTML =
      `A search by <b>${who.name.toLowerCase()}</b> can reach <b>${fmt(reach)} of ${fmt(total)}</b> reads a month ` +
      `(${Math.round((100 * reach) / total)}%). ` +
      (settings.campus !== "none" && canReach(settings.campus, who)
        ? "That includes reads from campus cameras."
        : "Campus cameras are out of reach under these settings.");
  }

  const card = $("#s3-card");
  let joined = false;
  const FIELDS = [
    ["Plate read", "XYZ-0417 at Cam 1, 7:50 AM", "camera", "Seen by camera"],
    ["Registered owner and address", "Alex Example, 412 Sample St.", "joined", "Joined from a record"],
    ["Federal case records", "Whether a case exists, past contact, linked people (kept generic)", "joined", "Joined from a record"],
    ["Result", "A plate read becomes a person, and a person becomes a place to find them", "inferred", "Inferred"],
  ];
  function drawCard() {
    const rows = joined ? FIELDS : FIELDS.slice(0, 2);
    card.innerHTML = rows.map(([l, v, cls, src]) =>
      `<div class="field"><span class="fl">${l}</span><span class="fv">${v}</span><span class="chip s-${cls}">${src}</span></div>`).join("");
    cardUpdate({ federal: joined });
    $("#s3-join").textContent = joined ? "− Remove federal case records" : "+ Join with federal case records";
  }
  $("#s3-join").addEventListener("click", () => { joined = !joined; drawCard(); });
  draw();
  drawCard();
}
