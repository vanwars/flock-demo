import { render } from "../template.js";
import { initTheme } from "../theme.js";
import * as scene1 from "./scene1.js";
import { initCard, enterScene } from "./card.js";

// Add a scene by adding a line here plus its partials (scene-N.html and facts-N.html).
const SCENES = [
  { title: "One person", mod: scene1 },
  { title: "Search by place, joined with records" },
  { title: "Federal immigration data" },
  { title: "Purchased data" },
];

const stepper = document.getElementById("stepper");
const sceneEl = document.getElementById("scene");
const factsEl = document.getElementById("facts");
const prev = document.getElementById("prev");
const next = document.getElementById("next");
let current = -1;
let cleanup = () => {};

SCENES.forEach((s, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pill";
  b.innerHTML = `<b>${i + 1}</b><span>${s.title}</span>`;
  b.onclick = () => go(i);
  stepper.appendChild(b);
});

const fromHash = () => {
  const n = Number((location.hash.match(/scene=(\d+)/) ?? [])[1]);
  return n >= 1 && n <= SCENES.length ? n - 1 : 0;
};

async function go(i) {
  if (i === current) return;
  cleanup();
  cleanup = () => {};
  current = i;
  history.replaceState(null, "", `#scene=${i + 1}`);
  [...stepper.children].forEach((b, j) => {
    b.classList.toggle("active", j === i);
    b.classList.toggle("done", j < i);
    b.setAttribute("aria-current", j === i ? "step" : "false");
  });
  prev.disabled = i === 0;
  next.disabled = i === SCENES.length - 1;
  const n = i + 1;
  try {
    sceneEl.innerHTML = await render(`scenes/scene-${n}`);
    factsEl.innerHTML = await render(`scenes/facts-${n}`);
    enterScene(n);
    const mod = SCENES[i].mod ?? (await import(`./scene${n}.js`));
    if (current === i) cleanup = mod.mount(sceneEl) ?? (() => {});
  } catch (err) {
    console.error(err);
    sceneEl.innerHTML = `<div class="err"><strong>Scene ${n} could not load.</strong><br>
      This page must be served over http (<code>python3 -m http.server</code>).</div>`;
    factsEl.innerHTML = "";
  }
  document.querySelector(".scene").scrollTop = 0;
}

prev.onclick = () => go(current - 1);
next.onclick = () => go(current + 1);
window.addEventListener("hashchange", () => go(fromHash()));
initTheme();
initCard(document.getElementById("factsheet"));
go(fromHash());
