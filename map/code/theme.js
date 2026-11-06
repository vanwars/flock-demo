const KEY = "theme";
const root = document.documentElement;
const mq = window.matchMedia("(prefers-color-scheme: dark)");

function stored() {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export const currentTheme = () => root.dataset.theme || stored() || (mq.matches ? "dark" : "light");

function announce() {
  const dark = currentTheme() === "dark";
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.textContent = dark ? "☀️" : "🌙";
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: currentTheme() }));
}

export function initTheme() {
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    announce();
  });
  // Follow the OS setting until the user picks a theme explicitly.
  mq.addEventListener("change", () => {
    if (!stored()) announce();
  });
  announce();
}
