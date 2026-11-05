import {
  CAMPUSES, CAMPUS_OVERLAYS, NC_BOUNDS, BASEMAPS, BASEMAP_OPTIONS,
  CAMPUS_BUBBLE_MAX_ZOOM, ICON_MIN_ZOOM,
} from "./config.js";
import { currentTheme } from "./theme.js";

const colorVar = (cam) => (cam.campus ? "--campus" : "--other");

function cameraIcon(cam) {
  const col = `var(${colorVar(cam)})`;
  const cones = cam.bearings
    .map(
      (b) =>
        `<g transform="rotate(${b} 30 30)"><path d="M30 30 L16 4 Q30 -2 44 4 Z" style="fill:${col};fill-opacity:.35;stroke:${col};stroke-width:1.5"/></g>`,
    )
    .join("");
  return L.divIcon({
    className: "cam-icon",
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    html: `<svg width="60" height="60" viewBox="0 0 60 60">${cones}
      <circle cx="30" cy="30" r="7" style="fill:${col};stroke:#fff;stroke-width:2"/></svg>`,
  });
}

// Read live so markers pick up the active theme's colors.
const fillColor = (cam) =>
  getComputedStyle(document.documentElement).getPropertyValue(colorVar(cam)).trim() || "#dc2626";

// Dots are canvas-drawn (no CSS vars), so recolor them when the theme changes.
const dotLayers = [];
const trackDot = (cam, layer) => (dotLayers.push([cam, layer]), layer);
window.addEventListener("themechange", () => {
  for (const [cam, layer] of dotLayers) layer.setStyle({ fillColor: fillColor(cam) });
});

// Campus cameras: big dot with a white outline.
function campusDot(cam) {
  return L.circleMarker(cam.latlng, {
    radius: 10, weight: 2, color: "#fff", fillOpacity: 0.9, fillColor: fillColor(cam),
  });
}

// Every other camera in NC: a small, cheap dot (drawn on a canvas, not as DOM elements).
function otherDot(cam) {
  return L.circleMarker(cam.latlng, {
    radius: 4, weight: 1, color: "#fff", fillOpacity: 0.75, fillColor: fillColor(cam),
  });
}

function campusBubble(campus, count) {
  return L.marker(campus.center, {
    title: campus.name,
    icon: L.divIcon({
      className: "bubble-wrap",
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      html: `<div class="bubble ${count ? "" : "empty"}"><b>${count}</b></div>
             <span class="bubble-label">${campus.short}</span>`,
    }),
  });
}

// Campus map images sit between the basemap tiles and the camera dots.
function addOverlays(map) {
  map.createPane("campusMaps").style.zIndex = 250;
  const btn = document.getElementById("overlay-toggle");
  const wrap = document.getElementById("overlay-opacity-wrap");
  const slider = document.getElementById("overlay-opacity");
  const layers = CAMPUS_OVERLAYS.map((o) =>
    L.imageOverlay(o.url, o.bounds, {
      pane: "campusMaps",
      opacity: Number(slider.value),
      attribution: o.attribution,
    }),
  );
  let on = false;
  btn.addEventListener("click", () => {
    on = !on;
    for (const l of layers) on ? l.addTo(map) : map.removeLayer(l);
    btn.setAttribute("aria-pressed", String(on));
    wrap.hidden = !on;
  });
  slider.addEventListener("input", () => {
    for (const l of layers) l.setOpacity(Number(slider.value));
  });
}

export function createMap() {
  const map = L.map("map", {
    preferCanvas: true, // canvas keeps thousands of dots fast
    wheelPxPerZoomLevel: 30, // default 60: scroll wheel zooms about twice as fast
    wheelDebounceTime: 20, // default 40: react to the wheel sooner
    zoomDelta: 1,
  }); 
  map.fitBounds(NC_BOUNDS);
  // Leaflet scales the canvas bitmap during a zoom animation, which looks blurry.
  // Hide the canvas dots while zooming and show the crisp redraw afterward.
  const box = map.getContainer();
  map.on("zoomstart", () => box.classList.add("zooming"));
  map.on("zoomend moveend", () => box.classList.remove("zooming"));
  let tiles;
  let satellite = false;
  try {
    satellite = localStorage.getItem("basemap") === "satellite";
  } catch {}
  const btn = document.getElementById("satellite-toggle");
  const setBasemap = () => {
    if (tiles) map.removeLayer(tiles);
    const base = BASEMAPS[satellite ? "satellite" : currentTheme()];
    tiles = L.tileLayer(base.url, { ...BASEMAP_OPTIONS, ...base.options }).addTo(map);
    tiles.bringToBack();
    if (btn) {
      btn.textContent = satellite ? "🗺️" : "🛰️";
      btn.title = btn.ariaLabel = satellite ? "Switch to map view" : "Switch to satellite view";
      btn.setAttribute("aria-pressed", String(satellite));
    }
  };
  btn?.addEventListener("click", () => {
    satellite = !satellite;
    try {
      localStorage.setItem("basemap", satellite ? "satellite" : "map");
    } catch {}
    setBasemap();
  });
  setBasemap();
  window.addEventListener("themechange", setBasemap);
  addOverlays(map);
  for (const c of CAMPUSES) {
    L.circle(c.center, {
      radius: c.radius,
      color: "#dc2626",
      weight: 1,
      dashArray: "4 6",
      fill: false,
      interactive: false,
    }).addTo(map);
  }
  return map;
}

const FLY = { duration: 0.6 }; // seconds; Leaflet's default is computed and often 1.5s+

export const focusCampus = (map, campus) =>
  map.flyToBounds(L.latLng(campus.center).toBounds(campus.radius * 2), { padding: [40, 40], ...FLY });

export const focusAll = (map) => map.flyToBounds(NC_BOUNDS, FLY);

// Every camera in NC is always shown as a small gray canvas dot. On top of
// those, campus cameras are highlighted in red, in three views chosen by zoom:
//   far:    one count bubble per campus
//   middle: a big dot per campus camera
//   close:  an icon per campus camera, with a cone showing where it faces
export function addCameras(map, cams, counts, { onCamera, onCampus }) {
  const others = L.layerGroup();
  const bubbles = L.layerGroup();
  const dots = L.layerGroup();
  const icons = L.layerGroup();

  for (const campus of CAMPUSES) {
    campusBubble(campus, counts.get(campus.id)).on("click", () => onCampus(campus)).addTo(bubbles);
  }
  for (const cam of cams) {
    if (!cam.campus) {
      trackDot(cam, otherDot(cam)).on("click", () => onCamera(cam)).addTo(others);
      continue;
    }
    trackDot(cam, campusDot(cam)).on("click", () => onCamera(cam)).addTo(dots);
    L.marker(cam.latlng, { icon: cameraIcon(cam) }).on("click", () => onCamera(cam)).addTo(icons);
  }

  others.addTo(map);
  const update = () => {
    const zoom = map.getZoom();
    const active =
      zoom <= CAMPUS_BUBBLE_MAX_ZOOM ? bubbles : zoom >= ICON_MIN_ZOOM ? icons : dots;
    for (const layer of [bubbles, dots, icons]) {
      if (layer !== active) map.removeLayer(layer);
    }
    active.addTo(map);
  };
  map.on("zoomend", update);
  update();
}
