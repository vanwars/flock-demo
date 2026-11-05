import { DATA_URL } from "./config.js";
import { render } from "./template.js";

const panel = document.getElementById("panel");

export async function showStatewide(campusCount, counts, statewideCount) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  panel.innerHTML = await render("overview", {
    campus_count: campusCount,
    camera_count: total,
    statewide_count: statewideCount,
  });
}

// A campus's own card lives in partials/what-we-know/<id>.html; otherwise show the TODO card.
async function whatWeKnow(campus, data) {
  try {
    return await render(`what-we-know/${campus.id}`, data);
  } catch {
    return render("what-we-know/todo", data);
  }
}

export async function showCampus(campus, counts, onBack) {
  const data = {
    name: campus.name,
    camera_count: counts.get(campus.id),
    radius: campus.radius,
  };
  panel.innerHTML = await render("campus", {
    ...data,
    what_we_know: await whatWeKnow(campus, data),
  });
  document.getElementById("back").onclick = onBack;
}

export async function showCamera(cam, backLabel, onBack) {
  const rows = await Promise.all(
    Object.entries(cam.props).map(([key, value]) => render("tag-row", { key, value })),
  );
  const [lat, lng] = cam.latlng;
  panel.innerHTML = await render("camera", {
    title: cam.campus ? `Camera on/near ${cam.campus.name}` : "Camera outside any campus radius",
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
    facing: cam.bearings.length
      ? `faces ${cam.bearings.map((b) => b + "°").join(", ")}`
      : "direction not mapped",
    note: cam.campus
      ? `Within ${cam.campus.radius} m of ${cam.campus.short}. Who operates this camera is not confirmed.`
      : "Outside every campus radius. It may belong to a city, county, state, or private operator; who operates it is not confirmed.",
    back_label: backLabel,
    rows: rows.join(""),
  });
  document.getElementById("back").onclick = onBack;
}

export async function showError(err) {
  console.error(err);
  panel.innerHTML = await render("error", { data_url: DATA_URL });
}
