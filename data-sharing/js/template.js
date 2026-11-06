// Tiny template engine for the HTML files in /partials.
//   {{name}}   value, HTML-escaped
//   {{{name}}} value, inserted as raw HTML
//   {{> name}} include partials/name.html (same values available)
const cache = new Map();

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

async function load(name) {
  if (!cache.has(name)) {
    const response = await fetch(`partials/${name}.html`);
    if (!response.ok) throw new Error(`partials/${name}.html: HTTP ${response.status}`);
    // Comments are for humans; strip them so example tags in them aren't processed.
    cache.set(name, (await response.text()).replace(/<!--[\s\S]*?-->/g, ""));
  }
  return cache.get(name);
}

export async function render(name, data = {}) {
  let html = await load(name);

  // 1. includes
  for (const [tag, partial] of html.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)) {
    html = html.replace(tag, await render(partial, data));
  }
  // 2. raw and escaped values
  return html
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => data[key] ?? "")
    .replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(data[key] ?? ""));
}
