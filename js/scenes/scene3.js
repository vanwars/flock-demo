// Scene 3: who can search which agency's reads, depending on each agency's sharing setting. All invented.
import { el } from "./shared.js";
import { update as cardUpdate } from "./card.js";
import { createJoin } from "./join.js";
import { segmented, actionStrip, announce } from "./ui.js";

const AGENCIES = [
  { id: "campus", name: "Campus police", reads: 1200, x: 80, y: 60 },
  { id: "city", name: "City police", reads: 18000, x: 80, y: 170 },
  { id: "county", name: "County sheriff", reads: 9000, x: 80, y: 280 },
];
// [value, short label, long label]
const SETTINGS = [
  ["national", "Nationwide", "Shares with agencies nationwide"],
  ["state", "In this state", "Shares with agencies in this state only"],
  ["none", "No one", "Shares with no one"],
];
const VENDOR = { x: 300, y: 170 };
const SEARCHERS = {
  state: { name: "State agency", sub: "in this state", x: 510, y: 90, inState: true },
  federal: { name: "Federal immigration agency", sub: "out of state", x: 510, y: 250, inState: false },
};
const fmt = (n) => n.toLocaleString();

// Can this searcher reach an agency's reads under that agency's setting?
export const canReach = (setting, searcher) =>
  setting === "national" || (setting === "state" && searcher.inState);

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const strip = actionStrip(root);
  const settings = { campus: "national", city: "state", county: "none" };
  const whoSel = $("#s3-who");
  segmented(whoSel);

  for (const a of AGENCIES) {
    const sel = $(`#s3-${a.id}`);
    for (const [v, short, long] of SETTINGS) {
      const o = new Option(long, v);
      o.dataset.short = short;
      sel.add(o);
    }
    sel.value = settings[a.id];
    segmented(sel);
    sel.addEventListener("change", () => { settings[a.id] = sel.value; draw(); });
  }
  whoSel.addEventListener("change", draw);

  const svg = el("svg", {
    viewBox: "0 0 600 340",
    role: "img",
    "aria-label": "Diagram: three local agencies send reads to a vendor cloud, which a state agency or a federal immigration agency can search depending on each local agency's sharing setting.",
  });
  $("#s3-map").replaceChildren(svg);
  const edges = el("g", {}, svg);
  const nodes = el("g", {}, svg);

  function node(x, y, w, h, title, sub, cls = "") {
    el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, class: `dg-node ${cls}` }, nodes);
    el("text", { x, y: sub ? y - 3 : y + 4, class: "dg-title", "text-anchor": "middle" }, nodes).textContent = title;
    if (sub) el("text", { x, y: y + 14, class: "dg-sub", "text-anchor": "middle" }, nodes).textContent = sub;
  }

  function draw() {
    const who = SEARCHERS[whoSel.value];
    const other = SEARCHERS[whoSel.value === "state" ? "federal" : "state"];
    edges.replaceChildren();
    nodes.replaceChildren();
    let reach = 0;
    const total = AGENCIES.reduce((n, a) => n + a.reads, 0);
    for (const a of AGENCIES) {
      const ok = canReach(settings[a.id], who);
      if (ok) reach += a.reads;
      el("line", { x1: a.x + 64, y1: a.y, x2: VENDOR.x - 54, y2: VENDOR.y, class: `dg-edge ${ok ? "open" : "shut"}` }, edges);
    }
    el("line", { x1: VENDOR.x + 54, y1: VENDOR.y, x2: who.x - 92, y2: who.y, class: `dg-edge ${reach > 0 ? "open to-searcher" : "shut"}` }, edges);
    for (const a of AGENCIES) {
      node(a.x, a.y, 128, 50, a.name, `${fmt(a.reads)} reads/mo`, canReach(settings[a.id], who) ? "reach" : "");
    }
    node(VENDOR.x, VENDOR.y, 108, 60, "Vendor cloud", "stores every read");
    node(who.x, who.y, 184, 54, who.name, `${who.sub} · runs the search`, "searcher");

    $("#s3-result").innerHTML =
      `A search by the <b>${who.name.toLowerCase()}</b> can reach <b>${fmt(reach)} of ${fmt(total)}</b> reads a month ` +
      `(${Math.round((100 * reach) / total)}%). ` +
      (canReach(settings.campus, who) ? "That includes reads from <b>campus cameras</b>." : "<b>Campus cameras</b> are out of reach under these settings.");
    $("#s3-bars").innerHTML = AGENCIES.map((a) => {
      const ok = canReach(settings[a.id], who);
      return `<div class="rb"><span>${a.name}</span><div class="rb-bar" role="img" aria-label="${ok ? "reachable" : "blocked"}"><i style="width:${ok ? 100 : 0}%"></i></div>` +
        `<span class="rb-n">${ok ? `<b>${fmt(a.reads)}</b> reachable` : "blocked"}</span></div>`;
    }).join("");

    strip.set({
      step: "Try it", total: 0,
      title: `Searching as: ${who.name}. Change an agency's setting below to see what changes.`,
      label: `Search as the ${other.name.toLowerCase()} instead`,
      onClick: () => {
        whoSel.value = whoSel.value === "state" ? "federal" : "state";
        whoSel.dispatchEvent(new Event("sync"));
        draw();
        announce($("#s3-result").textContent);
      },
    });
  }

  // ----- the federal-record join (same idea as scene 2) -----
  const join = createJoin($("#s3-join"), {
    rowTitle: "Our row: one plate read",
    baseCells: [
      { id: "plate", label: "Plate read", value: "XYZ-0417 at Cam 1, 7:50 AM", src: "camera" },
      { id: "owner", label: "Registered owner", value: "Alex Example", src: "joined" },
      { id: "address", label: "Address", value: "412 Sample St.", src: "joined" },
    ],
    crumbs: ["plate", "name + address", "case records"],
    baseReached: () => 2,
    startCaption: "Press the button on the card to join the federal list onto our row.",
    steps: [{
      file: "Federal case records (kept generic)", key: "name + address", keyCell: "owner", keyValue: "Alex Example",
      rows: [["Alex Example · 412 Sample St.", "case record on file"], ["J. Rivera · 9 Pine Ct.", "no record"], ["M. Kim · 77 Oak Ave.", "no record"]],
      matchIndex: 0, adds: "whether a case exists, past contact, linked people", arrow: "federal list",
      cells: [
        { id: "fed1", label: "Federal case records", value: "Whether a case exists, past contact", src: "joined" },
        { id: "fed2", label: "Linked people", value: "Others at the same address or on the same records", src: "joined" },
        { id: "fed3", label: "Result", value: "A plate read becomes a person, and a person becomes a place to find them", src: "inferred" },
      ],
      caption: "Looked up the owner's name and address in a federal list. Found a match. A single read has become a person, and the person has become a place to find them.",
    }],
    onChange: ({ done }) => cardUpdate({ federal: done >= 1 }),
  });
  $("#s3-reset").addEventListener("click", () => { join.reset(); cardUpdate({ federal: false }); });

  draw();
  cardUpdate({ federal: false });
}
