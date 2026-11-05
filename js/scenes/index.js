import { render } from "../template.js";
import { initTheme } from "../theme.js";
import * as scene1 from "./scene1.js";
import { initCard, enterScene } from "./card.js";
import { announce, reducedMotion } from "./ui.js";

// Add a scene by adding a line here plus its partials (scene-N.html and facts-N.html) and scene module.
const SCENES = [
  { title: "One person", mod: scene1 },
  { title: "Search by place, joined with records" },
  { title: "Who else can search?" },
  { title: "Purchased data" },
];
const TOTAL = SCENES.length;

const $ = (id) => document.getElementById(id);
const stepper = $("stepper");
const sceneEl = $("scene");
const factsEl = $("facts");
const outroEl = $("outro");
const introEl = $("intro");
const prev = $("prev");
const next = $("next");
let current = -1;
let cleanup = () => {};

// ----- stepper: connected steps on wide screens, "Scene 2 of 4" on phones -----
stepper.innerHTML = `<div class="stepper-inner">
  <ol class="steps"></ol>
  <div class="step-compact" aria-hidden="true"><div><strong id="sc-title"></strong><small id="sc-count"></small></div></div>
  <div class="step-progress" id="step-progress"></div>
</div>`;
const stepsOl = stepper.querySelector(".steps");
SCENES.forEach((s, i) => {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "step";
  b.innerHTML = `<b>${i + 1}</b><span>${s.title}</span>`;
  b.onclick = () => go(i);
  li.appendChild(b);
  stepsOl.appendChild(li);
});

const fromHash = () => {
  const n = Number((location.hash.match(/scene=(\d+)/) ?? [])[1]);
  return n >= 1 && n <= TOTAL ? n - 1 : 0;
};

// ----- intro card (scene 1 only, dismissible, remembered) -----
const INTRO_KEY = "scenes-intro-dismissed";
const introSeen = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
};
function dismissIntro() {
  introEl.hidden = true;
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {}
  sceneEl.querySelector("h2")?.focus({ preventScroll: true });
}
$("intro-start").onclick = dismissIntro;
$("intro-skip").onclick = dismissIntro;

// ----- sources box: wrap the partial in a collapsed <details> with a count -----
function wrapFacts(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const section = tmp.querySelector("section");
  if (!section) return html;
  section.querySelector("h3")?.remove();
  const sourced = section.querySelectorAll("li .chip.ok").length;
  return `<details class="facts"><summary>What is documented
      <span class="chip ok">${sourced} sourced</span><small>Tap to see the sources</small></summary>
      <div class="facts-body">${section.innerHTML}</div></details>`;
}

function loadingState() {
  sceneEl.setAttribute("aria-busy", "true");
  sceneEl.innerHTML = `<div class="skeleton" role="status" aria-label="Loading scene"></div>`;
}

function errorState(n) {
  const cmd = "python3 -m http.server";
  sceneEl.innerHTML = `<div class="card"><div class="card-body">
    <h2>Scene ${n} could not load</h2>
    <p>This page loads its scenes from separate files, so it has to be served over http rather than opened as a file.</p>
    <p><code id="cmd">${cmd}</code> <button class="btn small" id="copycmd" type="button">Copy</button></p>
    <p class="note">Run that in the project folder, then open <code>http://localhost:8000/scenes.html</code>.</p>
  </div></div>`;
  $("copycmd").onclick = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      $("copycmd").textContent = "Copied";
    } catch {
      $("copycmd").textContent = "Select and copy";
    }
  };
}

function updateChrome(i) {
  const n = i + 1;
  [...stepsOl.querySelectorAll(".step")].forEach((b, j) => {
    b.classList.toggle("active", j === i);
    b.classList.toggle("done", j < i);
    if (j === i) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
  $("sc-title").textContent = SCENES[i].title;
  $("sc-count").textContent = `Scene ${n} of ${TOTAL}`;
  $("step-progress").style.width = `${(n / TOTAL) * 100}%`;
  prev.disabled = i === 0;
  $("prev-label").textContent = i === 0 ? "Back" : `Scene ${i}`;
  const last = i === TOTAL - 1;
  $("next-label").innerHTML = last
    ? "Back to the map"
    : `<span class="long">Next: ${SCENES[i + 1].title}</span><span class="short">Next scene</span>`;
  document.title = `Scene ${n} of ${TOTAL}: ${SCENES[i].title} · How plate reads add up`;
}

async function go(i, { initial = false } = {}) {
  if (i === current || i < 0 || i >= TOTAL) return;
  cleanup();
  cleanup = () => {};
  const n = i + 1;
  const wasInitial = current === -1;
  current = i;
  history.replaceState(null, "", `#scene=${n}`);
  updateChrome(i);

  if (!wasInitial && !reducedMotion()) {
    sceneEl.classList.add("leaving");
    await new Promise((r) => setTimeout(r, 110));
    if (current !== i) return;
  }
  loadingState();
  try {
    const [sceneHtml, factsHtml, outroHtml] = await Promise.all([
      render(`scenes/scene-${n}`),
      render(`scenes/facts-${n}`),
      n === TOTAL ? render("scenes/outro") : Promise.resolve(""),
    ]);
    if (current !== i) return;
    sceneEl.removeAttribute("aria-busy");
    sceneEl.innerHTML = sceneHtml;
    factsEl.innerHTML = wrapFacts(factsHtml);
    outroEl.innerHTML = outroHtml;
    introEl.hidden = !(i === 0 && !introSeen());
    enterScene(n);
    const mod = SCENES[i].mod ?? (await import(`./scene${n}.js`));
    if (current !== i) return;
    cleanup = mod.mount(sceneEl) ?? (() => {});
  } catch (err) {
    console.error(err);
    sceneEl.removeAttribute("aria-busy");
    errorState(n);
    factsEl.innerHTML = "";
    outroEl.innerHTML = "";
  }
  sceneEl.classList.remove("leaving");
  if (!reducedMotion()) {
    sceneEl.classList.add("entering");
    setTimeout(() => sceneEl.classList.remove("entering"), 320);
  }
  if (!wasInitial) {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    sceneEl.querySelector("h2")?.focus({ preventScroll: true });
    announce(`Scene ${n} of ${TOTAL}: ${SCENES[i].title}`);
  }
}

prev.onclick = () => go(current - 1);
next.onclick = () => {
  if (current === TOTAL - 1) location.href = "index.html";
  else go(current + 1);
};
window.addEventListener("hashchange", () => go(fromHash()));

// Left/right arrows switch scenes, except while typing or using a control that uses the arrows itself.
window.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.target.closest("input, select, textarea, [role='radiogroup'], [contenteditable]")) return;
  if (document.getElementById("factsheet")?.classList.contains("open")) return;
  e.preventDefault();
  if (e.key === "ArrowLeft") go(current - 1);
  else if (current < TOTAL - 1) go(current + 1);
});

initTheme();
initCard($("factsheet"), { pill: $("fs-pill"), backdrop: $("fs-backdrop") });
go(fromHash(), { initial: true });
