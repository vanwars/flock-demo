import { CAMPUSES } from "./config.js";
import { loadCameras, countByCampus } from "./cameras.js";
import { createMap, addCameras, focusCampus, focusAll } from "./map.js";
import "./modal.js";
import { initTheme } from "./theme.js";
import { showStatewide, showCampus, showCamera, showError } from "./panel.js";

function initPanelToggle(map) {
  const main = document.querySelector("main");
  const btn = document.getElementById("panel-toggle");
  const set = (open) => {
    main.classList.toggle("collapsed", !open);
    btn.setAttribute("aria-expanded", String(open));
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const arrow = mobile ? (open ? "▼" : "▲") : open ? "▶" : "◀";
    btn.textContent = arrow;
    btn.title = btn.ariaLabel = open ? "Collapse panel" : "Expand panel";
    map.invalidateSize();
  };
  btn.onclick = () => set(main.classList.contains("collapsed"));
  window.matchMedia("(max-width: 760px)").addEventListener("change", () => set(!main.classList.contains("collapsed")));
  set(true);
  return () => set(true); // expand, e.g. when something is selected
}

async function main() {
  initTheme();
  const map = createMap();
  const expandPanel = initPanelToggle(map);
  const picker = document.getElementById("campus-picker");

  try {
    const cams = await loadCameras();
    const counts = countByCampus(cams);

    const showAll = () => {
      expandPanel();
      picker.value = "";
      focusAll(map);
      showStatewide(CAMPUSES.length, counts, cams.length);
    };
    const selectCampus = (campus) => {
      expandPanel();
      picker.value = campus.id;
      focusCampus(map, campus);
      showCampus(campus, counts, showAll);
    };
    // A camera on/near a campus shows its own details plus that campus's "What we know" info.
    const selectCamera = (cam) => {
      expandPanel();
      if (cam.campus) picker.value = cam.campus.id;
      showCamera(cam, counts, "← All campuses", showAll);
    };

    for (const c of CAMPUSES) picker.add(new Option(`${c.name} (${counts.get(c.id)})`, c.id));
    picker.onchange = () => {
      const campus = CAMPUSES.find((c) => c.id === picker.value);
      campus ? selectCampus(campus) : showAll();
    };

    addCameras(map, cams, counts, { onCamera: selectCamera, onCampus: selectCampus });
    showStatewide(CAMPUSES.length, counts, cams.length);
  } catch (err) {
    showError(err);
  }
}

main();
