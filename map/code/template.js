// Loads a file from the /content folder and fills in {{placeholders}}.
// Comments (<!-- ... -->) are removed so they never show on the page.
const cache = new Map();

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

async function load(path) {
  if (!cache.has(path)) {
    const response = await fetch(`content/${path}.html`);
    if (!response.ok) throw new Error(`content/${path}.html: HTTP ${response.status}`);
    cache.set(path, (await response.text()).replace(/<!--[\s\S]*?-->/g, ""));
  }
  return cache.get(path);
}

export async function render(path, data = {}) {
  const html = await load(path);
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(data[key] ?? ""));
}
