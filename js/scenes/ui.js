// Small UI helpers for the scenes page. Vanilla JS, no dependencies.
// Each helper enhances an existing element (a <select>, a checkbox, a range) so the scene scripts keep
// reading and writing the original element. After changing one of them from script, dispatch a "sync"
// event on it (`el.dispatchEvent(new Event("sync"))`) so its fancy version updates.

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let liveEl = null;
// Say something to screen readers without moving focus.
export function announce(message) {
  liveEl ??= document.getElementById("live");
  if (!liveEl) return;
  liveEl.textContent = "";
  // A tick later so repeating the same message is still announced.
  setTimeout(() => (liveEl.textContent = message), 30);
}

const uid = (() => {
  let n = 0;
  return (p) => `${p}-${++n}`;
})();

// A <select> becomes a segmented control (a radio group). The select stays in the DOM, hidden.
export function segmented(select, { label } = {}) {
  if (!select || select.dataset.enhanced) return null;
  select.dataset.enhanced = "1";
  select.hidden = true;
  const group = document.createElement("div");
  group.className = "seg";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label ?? select.getAttribute("aria-label") ?? select.closest("label")?.textContent.trim() ?? "Choose one");
  const buttons = [...select.options].map((opt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "seg-btn";
    b.setAttribute("role", "radio");
    b.dataset.value = opt.value;
    b.textContent = opt.dataset.short ?? opt.textContent;
    b.title = opt.textContent;
    b.addEventListener("click", () => {
      if (select.value === opt.value) return;
      select.value = opt.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });
    group.appendChild(b);
    return b;
  });
  const sync = () => {
    for (const b of buttons) {
      const on = b.dataset.value === select.value;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };
  group.addEventListener("keydown", (e) => {
    const i = buttons.findIndex((b) => b.getAttribute("aria-checked") === "true");
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // keep the page's left/right scene shortcuts out of this
    const next = buttons[(i + step + buttons.length) % buttons.length];
    next.click();
    next.focus();
  });
  select.addEventListener("sync", sync);
  select.insertAdjacentElement("afterend", group);
  sync();
  return { group, sync };
}

// A checkbox becomes a toggle chip (a button with aria-pressed). The checkbox stays, hidden.
export function toggleChip(checkbox, { hint } = {}) {
  if (!checkbox || checkbox.dataset.enhanced) return null;
  checkbox.dataset.enhanced = "1";
  const labelEl = checkbox.closest("label");
  const text = labelEl ? labelEl.textContent.trim() : checkbox.getAttribute("aria-label") ?? "";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chipbtn";
  b.innerHTML = `<span class="chipbtn-box" aria-hidden="true"></span><span>${text}</span>${hint ? `<span class="chipbtn-hint">${hint}</span>` : ""}`;
  const sync = () => b.setAttribute("aria-pressed", String(checkbox.checked));
  b.addEventListener("click", () => {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
  });
  checkbox.addEventListener("sync", sync);
  (labelEl ?? checkbox).hidden = true;
  (labelEl ?? checkbox).insertAdjacentElement("afterend", b);
  sync();
  return { button: b, sync };
}

// A range input gets tick marks and a value bubble that follows the thumb.
// ticks: [[value, "label"], ...]. fmt(value) -> text for the bubble.
export function rangeWithTicks(input, { ticks = [], fmt = (v) => v } = {}) {
  if (!input || input.dataset.enhanced) return null;
  input.dataset.enhanced = "1";
  const wrap = document.createElement("div");
  wrap.className = "range";
  input.replaceWith(wrap);
  const bubble = document.createElement("output");
  bubble.className = "range-bubble";
  bubble.setAttribute("aria-hidden", "true");
  const track = document.createElement("div");
  track.className = "range-track";
  track.append(input);
  const tickRow = document.createElement("div");
  tickRow.className = "range-ticks";
  tickRow.setAttribute("aria-hidden", "true");
  wrap.append(bubble, track, tickRow);
  const pos = (v) => (100 * (v - Number(input.min))) / (Number(input.max) - Number(input.min) || 1);
  const build = () => {
    tickRow.replaceChildren();
    for (const [v, label] of ticks) {
      const t = document.createElement("span");
      t.style.left = `${pos(v)}%`;
      t.textContent = label;
      tickRow.appendChild(t);
    }
  };
  const sync = () => {
    const v = Number(input.value);
    const p = pos(v);
    wrap.style.setProperty("--fill", `${p}%`);
    // Keep the bubble inside the track near both ends.
    bubble.style.left = `calc(${p}% + ${(0.5 - p / 100) * 18}px)`;
    bubble.textContent = fmt(v);
    input.setAttribute("aria-valuetext", String(fmt(v)));
  };
  input.addEventListener("input", sync);
  input.addEventListener("sync", () => { build(); sync(); });
  build();
  sync();
  return { wrap, sync, rebuild: build };
}

// Count a number up (or down) quickly. Falls back to an instant change with reduced motion.
export function countUp(el, to, ms = 350) {
  const from = Number(el.dataset.v ?? el.textContent) || 0;
  el.dataset.v = String(to);
  if (reducedMotion() || from === to) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1 && el.dataset.v === String(to)) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The step strip that sits at the top of a scene card and stays in view while the card is on screen.
// set({ step, total, title, label, onClick, disabled, secondary }) updates it.
export function actionStrip(root) {
  const strip = root.querySelector(".actionstrip");
  if (!strip) return { set() {} };
  const stepEl = strip.querySelector(".as-step");
  const titleEl = strip.querySelector(".as-title");
  const dotsEl = strip.querySelector(".as-dots");
  const go = strip.querySelector(".as-go");
  let handler = null;
  go?.addEventListener("click", () => handler?.());
  return {
    set({ step, total, title, label, onClick, disabled = false, hideButton = false }) {
      if (stepEl) stepEl.textContent = total ? `Step ${Math.min(step, total)} of ${total}` : step ?? "";
      if (titleEl && title != null) titleEl.textContent = title;
      if (dotsEl) {
        dotsEl.hidden = !total;
        dotsEl.replaceChildren(...Array.from({ length: total ?? 0 }, (_, i) => {
          const d = document.createElement("i");
          d.className = i + 1 < step ? "done" : i + 1 === step ? "now" : "";
          return d;
        }));
      }
      if (go) {
        go.hidden = hideButton;
        if (label != null) go.querySelector(".as-label").textContent = label;
        go.disabled = disabled;
      }
      handler = onClick ?? null;
    },
  };
}

// A round play/pause button state helper (used by the shared player in shared.js through textContent).
export function playLabel(button, playing) {
  button.setAttribute("aria-pressed", String(playing));
}
