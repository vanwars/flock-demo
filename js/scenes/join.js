// Joins, made visible. A join is "look this key up in another list, copy the matching row's columns onto ours".
// createJoin() builds: our row (growing cells), a chain of keys, a shelf of data-source cards, and an
// animation that draws a line from our key cell to the matching row in the card before the new columns arrive.
// joinDemo() is the tiny two-list explainer. Everything shown is invented.
import { el, NS } from "./shared.js";
import { announce, reducedMotion } from "./ui.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// cfg: {
//   rowTitle, baseCells: [{id, label, value, src}],
//   crumbs: ["plate", ...], baseReached: () => number,
//   steps: [{ file, key, keyCell, rows: [[k, v], ...], matchIndex, adds, arrow, cells: [...], caption }],
//   gate(i, doneCount) -> { ok, why } (optional; default is "in order"),
//   onChange({ done, total, next })
// }
export function createJoin(root, cfg) {
  const steps = cfg.steps;
  let done = 0;
  let busy = false;
  let baseCells = cfg.baseCells;
  let extraCells = [];

  root.classList.add("join");
  root.innerHTML = `
    <svg class="join-wire" aria-hidden="true"></svg>
    <div class="jr"><p class="jr-title">${esc(cfg.rowTitle ?? "Our row")}</p><div class="jr-cells"></div></div>
    <p class="join-caption" aria-live="polite"></p>
    <div class="crumbs" role="img" aria-label="Chain of keys that the joins follow"></div>
    <div class="jshelf" role="group" aria-label="Data sources you can join"></div>`;
  const wire = root.querySelector(".join-wire");
  const cellsEl = root.querySelector(".jr-cells");
  const crumbsEl = root.querySelector(".crumbs");
  const shelfEl = root.querySelector(".jshelf");
  const captionEl = root.querySelector(".join-caption");

  const gate = (i) => {
    if (i < done) return { ok: false, why: "Already joined" };
    if (i > done) return { ok: false, why: `Needs "${steps[done].file}" first` };
    return cfg.gate?.(i, done) ?? { ok: true };
  };

  const cellHtml = (c, fresh) =>
    `<div class="cell s-${c.src}${fresh ? " new" : ""}" data-cell="${c.id}"><small>${esc(c.label)}</small><span class="cv">${esc(c.value)}</span></div>`;

  function renderRow(freshIds = []) {
    const all = [...baseCells, ...extraCells, ...steps.slice(0, done).flatMap((s) => s.cells)];
    cellsEl.innerHTML = all.map((c) => cellHtml(c, freshIds.includes(c.id))).join("");
  }

  function renderCrumbs() {
    const reached = Math.min(crumbCount(), cfg.crumbs.length);
    crumbsEl.innerHTML = cfg.crumbs
      .map((label, i) => {
        const node = `<span class="crumb${i < reached ? " reached" : ""}">${esc(label)}</span>`;
        if (i === cfg.crumbs.length - 1) return node;
        const arrowLabel = steps[i]?.arrow ?? "";
        return `${node}<span class="crumb-arrow${i + 1 < reached ? " reached" : ""}">→ ${esc(arrowLabel)} →</span>`;
      })
      .join("");
  }
  const crumbCount = () => (cfg.baseReached?.() ?? 1) + done;

  function renderShelf() {
    shelfEl.innerHTML = steps
      .map((s, i) => {
        const g = gate(i);
        const state = i < done ? "used" : g.ok ? "next" : "locked";
        const rows = s.rows
          .map((r, k) => `<tr${k === s.matchIndex ? ' class="match"' : ""}>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("");
        const btn =
          state === "used" ? `<button class="btn small" type="button" disabled>✓ Joined</button>`
          : state === "next" ? `<button class="btn primary small" type="button" data-join="${i}">Join this</button>`
          : `<button class="btn small" type="button" disabled>Locked</button>`;
        const why = state === "locked" ? `<p class="jc-why">${esc(i > done ? `Needs "${steps[done].file}" first.` : "")}${g.why && i === done ? esc(g.why) : ""}</p>` : "";
        return `<div class="jcard ${state}" data-card="${i}">
          <div class="jc-top"><span class="jc-title">${esc(s.file)}</span>${state === "used" ? '<span class="jc-badge">✓</span>' : ""}</div>
          <p class="jc-key">Matches on: <b>${esc(s.key)}</b></p>
          <table class="jc-table" aria-label="Preview of ${esc(s.file)}">${rows}</table>
          <p class="jc-adds"><b>Adds:</b> ${esc(s.adds)}</p>${why}${btn}</div>`;
      })
      .join("");
    shelfEl.querySelectorAll("[data-join]").forEach((b) => b.addEventListener("click", () => joinStep(Number(b.dataset.join))));
  }

  function setCaption(text) {
    captionEl.textContent = text;
  }

  // `notify` is false for the first draw, so a scene's onChange never runs before its join variable exists.
  function draw(freshIds, notify = true) {
    renderRow(freshIds);
    renderCrumbs();
    renderShelf();
    if (notify) cfg.onChange?.({ done, total: steps.length, next: done < steps.length ? steps[done] : null });
  }

  // The animated lookup: light the key cell, draw a line to the matching row, then bring in the new columns.
  async function joinStep(i) {
    if (busy || !gate(i).ok) return;
    busy = true;
    const step = steps[i];
    const card = shelfEl.querySelector(`[data-card="${i}"]`);
    const keyCell = cellsEl.querySelector(`[data-cell="${step.keyCell}"]`) ?? cellsEl.firstElementChild;
    const matchTd = card?.querySelector("tr.match td:first-child");
    shelfEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    setCaption(`Looking up ${step.keyValue ?? "the key"} in ${step.file}…`);
    // Make sure our row, the caption and the cards are on screen, so the animation is seen.
    const top = root.getBoundingClientRect().top;
    if (top < 150 || top > window.innerHeight * 0.45) {
      window.scrollTo({ top: window.scrollY + top - 150, behavior: reducedMotion() ? "auto" : "smooth" });
      await wait(reducedMotion() ? 0 : 450);
    }
    if (!reducedMotion() && keyCell && matchTd) {
      keyCell.classList.add("key-lit");
      const rr = root.getBoundingClientRect();
      const a = keyCell.getBoundingClientRect();
      const b = matchTd.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - rr.left, y1 = a.bottom - rr.top;
      const x2 = b.left + 14 - rr.left, y2 = b.top + b.height / 2 - rr.top;
      const mid = (y1 + y2) / 2;
      wire.replaceChildren();
      const p = el("path", { d: `M${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}` }, wire);
      el("circle", { cx: x1, cy: y1, r: 4 }, wire);
      el("circle", { cx: x2, cy: y2, r: 4 }, wire);
      const len = p.getTotalLength?.() ?? 300;
      p.animate([{ strokeDasharray: `0 ${len}` }, { strokeDasharray: `${len} 0` }], { duration: 450, easing: "ease-out", fill: "forwards" });
      await wait(900);
      wire.replaceChildren();
      keyCell.classList.remove("key-lit");
    }
    done = i + 1;
    draw(step.cells.map((c) => c.id));
    setCaption(step.caption);
    announce(step.caption);
    busy = false;
  }

  function reset() {
    if (busy) return;
    done = 0;
    extraCells = [];
    draw();
    setCaption(cfg.startCaption ?? "Pick the highlighted data source to join it onto our row.");
  }

  draw(undefined, false);
  setCaption(cfg.startCaption ?? "Pick the highlighted data source to join it onto our row.");
  window.addEventListener("resize", () => wire.replaceChildren());

  return {
    reset,
    joinNext: () => joinStep(done),
    // Re-check gating after outside state changed (for example, scene 4 isolating a phone).
    refresh: () => draw(),
    setBaseCells(cells) {
      baseCells = cells;
      renderRow();
    },
    addCell(cell) {
      if (!extraCells.some((c) => c.id === cell.id) && !baseCells.some((c) => c.id === cell.id)) extraCells.push(cell);
      renderRow([cell.id]);
    },
    removeCell(id) {
      extraCells = extraCells.filter((c) => c.id !== id);
      renderRow();
    },
    state: () => ({ done, total: steps.length, next: done < steps.length ? steps[done] : null, busy }),
  };
}

// The two-list explainer: rows with the same plate line up into one wider row.
export function joinDemo(root) {
  const camera = [["XYZ-0417", "Cam 1 · 7:50 AM"], ["QRS-2231", "Cam 6 · 8:05 AM"]];
  const registry = [["QRS-2231", "J. Rivera"], ["XYZ-0417", "Alex Example"]];
  root.classList.add("joindemo");
  const table = (cap, head, rows, matchAll = false) => `<div class="jd-table"><table><caption>${cap}</caption>
    <tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>
    ${rows.map((r) => `<tr${matchAll ? ' class="match"' : ""}>${r.map((c, k) => `<td${k === 0 ? ' class="key"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}
    </table></div>`;
  function showLists() {
    root.innerHTML = `<h3>What is a join?</h3>
      <p class="note" style="margin:0">Two lists that share one column can be lined up into one bigger list. That shared column is the <b>key</b>.</p>
      <div class="jd-tables">${table("Camera reads", ["Plate", "Seen at"], camera)}${table("Registry", ["Plate", "Owner"], registry)}</div>
      <div class="jd-controls"><button class="btn primary small" type="button" id="jd-go">Join them on plate</button></div>
      <p class="jd-caption" aria-live="polite">Both lists have a plate column. No name in the left list; no camera in the right one.</p>`;
    root.querySelector("#jd-go").addEventListener("click", showJoined);
  }
  async function showJoined() {
    const go = root.querySelector("#jd-go");
    go.disabled = true;
    const tables = root.querySelector(".jd-tables");
    if (!reducedMotion()) {
      tables.querySelectorAll("tr").forEach((tr, i) => {
        const key = tr.querySelector(".key")?.textContent;
        if (key) tr.classList.add("match");
      });
      root.querySelector(".jd-caption").textContent = "Rows with the same plate belong together. Lining them up…";
      await wait(1000);
    }
    const rows = camera.map(([plate, seen]) => [plate, seen, registry.find((r) => r[0] === plate)[1]]);
    tables.classList.add("merged");
    tables.innerHTML = `<div class="jd-table"><table><caption>Camera reads + Registry, joined on plate</caption>
      <tr><th>Plate</th><th>Seen at</th><th>Owner</th></tr>
      ${rows.map((r) => `<tr><td class="key">${esc(r[0])}</td><td>${esc(r[1])}</td><td class="new">${esc(r[2])}</td></tr>`).join("")}
      </table></div>`;
    const cap = root.querySelector(".jd-caption");
    cap.textContent = "One wider list. A plate that was only a plate now has an owner. Each join below does this with one more list.";
    announce(cap.textContent);
    go.disabled = false;
    go.textContent = "Replay";
    go.onclick = showLists;
  }
  showLists();
}
