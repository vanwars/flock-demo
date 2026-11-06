// Builds the side panel. The wording you can edit lives in the /content folder;
// the small fixed pieces (legend, camera details, error message) are here.
import { DATA_URL } from "./config.js";
import { render, escapeHtml as esc } from "./template.js";

const panel = document.getElementById("panel");

const LEGEND = `
<div class="legend">
  <span><span class="dot" style="background:var(--campus)"></span>On/near a campus</span>
  <span><span class="dot" style="background:var(--other)"></span>Elsewhere in NC</span>
  <span>Cone = direction the camera faces</span>
</div>`;

export async function showStatewide(campusCount, counts, statewideCount) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  panel.innerHTML =
    (await render("overview", {
      campus_count: campusCount,
      camera_count: total,
      statewide_count: statewideCount,
    })) +
    LEGEND;
}

// A campus's own page is content/campuses/<id>.html; otherwise use the "not researched yet" page.
async function whatWeKnow(campus, data) {
  try {
    return await render(`campuses/${campus.id}`, data);
  } catch {
    return render("campuses/_not-researched-yet", data);
  }
}

const campusData = (campus, counts) => ({
  name: campus.name,
  camera_count: counts.get(campus.id),
  radius: campus.radius,
});

export async function showCampus(campus, counts, onBack) {
  const data = campusData(campus, counts);
  panel.innerHTML = `
    <h2>${esc(data.name)}</h2>
    <div class="note">
      ${esc(data.camera_count)} camera(s) within ${esc(data.radius)} m of campus (dashed circle).
      Operator tags are crowd‑sourced and may be incomplete, so who runs each camera still needs to be confirmed.
    </div>
    <p><button class="btn" id="back">← All campuses</button></p>
    ${LEGEND}
    ${await whatWeKnow(campus, data)}`;
  document.getElementById("back").onclick = onBack;
}

export async function showCamera(cam, counts, backLabel, onBack) {
  const rows = Object.entries(cam.props)
    .map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`)
    .join("");
  const [lat, lng] = cam.latlng;
  const title = cam.campus ? `Camera on/near ${cam.campus.name}` : "Camera outside any campus radius";
  const facing = cam.bearings.length
    ? `faces ${cam.bearings.map((b) => b + "°").join(", ")}`
    : "direction not mapped";
  const note = cam.campus
    ? `Within ${cam.campus.radius} m of ${cam.campus.short}. Who operates this camera is not confirmed.`
    : "Outside every campus radius. It may belong to a city, county, state, or private operator; who operates it is not confirmed.";
  const cameraDetails = `
    <div class="note">${lat.toFixed(5)}, ${lng.toFixed(5)} · ${esc(facing)}</div>
    <p class="note">${esc(note)}</p>
    <h3>Mapped details (from OpenStreetMap tags)</h3>
    <table>${rows}</table>`;
  const header = `
    <h2>${esc(title)}</h2>
    <p><button class="btn" id="back">${esc(backLabel)}</button></p>`;

  if (!cam.campus) {
    panel.innerHTML = header + cameraDetails;
  } else {
    // Camera on/near a campus: two tabs, the campus's Flock details and the camera's own data.
    const campusInfo = await whatWeKnow(cam.campus, campusData(cam.campus, counts));
    panel.innerHTML = `
      ${header}
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" id="tab-campus" aria-selected="true" aria-controls="tabpanel-campus">University Flock details</button>
        <button class="tab" role="tab" id="tab-camera" aria-selected="false" aria-controls="tabpanel-camera">Camera data</button>
      </div>
      <div id="tabpanel-campus" role="tabpanel" aria-labelledby="tab-campus">${campusInfo}</div>
      <div id="tabpanel-camera" role="tabpanel" aria-labelledby="tab-camera" hidden>${cameraDetails}</div>`;
    for (const tab of panel.querySelectorAll(".tab")) {
      tab.onclick = () => {
        for (const t of panel.querySelectorAll(".tab")) {
          const selected = t === tab;
          t.setAttribute("aria-selected", String(selected));
          document.getElementById(t.getAttribute("aria-controls")).hidden = !selected;
        }
      };
    }
  }
  document.getElementById("back").onclick = onBack;
}

export async function showError(err) {
  console.error(err);
  panel.innerHTML = `
    <div class="err">
      <strong>No camera data loaded.</strong><br>
      This page needs <code>${esc(DATA_URL)}</code> next to it, and must be served over http
      (<code>python3 -m http.server</code>, then open http://localhost:8000/map/index.html).
    </div>`;
}
