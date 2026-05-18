// ======================================================
// ARMENIA SÍSMICA INTERACTIVA 3D
// MapLibre GL: rotación, inclinación y edificios 3D
// ======================================================

const amplitudeSlider = document.getElementById("amplitudeSlider");
const amplitudeValue = document.getElementById("amplitudeValue");
const knownAmplitudeInput = document.getElementById("knownAmplitudeInput");

const movementLevel = document.getElementById("movementLevel");
const soilResponse = document.getElementById("soilResponse");
const amplitudeBehavior = document.getElementById("amplitudeBehavior");
const soilType = document.getElementById("soilType");
const heroBadge = document.getElementById("heroBadge");

const selectedBarrioName = document.getElementById("selectedBarrioName");
const selectedBarrioInfo = document.getElementById("selectedBarrioInfo");

const r1Value = document.getElementById("r1Value");
const r2Value = document.getElementById("r2Value");
const a2Value = document.getElementById("a2Value");

const simulateBtn = document.getElementById("simulateBtn");
const stopBtn = document.getElementById("stopBtn");
const applyFormulaBtn = document.getElementById("applyFormulaBtn");
const loadCaseBtn = document.getElementById("loadCaseBtn");
const clearPointsBtn = document.getElementById("clearPointsBtn");
const toggleBuildingsBtn = document.getElementById("toggleBuildingsBtn");
const focusRegionBtn = document.getElementById("focusRegionBtn");
const focusArmeniaBtn = document.getElementById("focusArmeniaBtn");
const reset3dBtn = document.getElementById("reset3dBtn");
const resetNorthBtn = document.getElementById("resetNorthBtn");

const stepEpicenter = document.getElementById("stepEpicenter");
const stepReference = document.getElementById("stepReference");
const stepAnalysis = document.getElementById("stepAnalysis");
const intensityOverlay = document.getElementById("intensityOverlay");

const ARMENIA_CENTER = [-75.6811, 4.5339];
const REGION_CENTER = [-75.72, 4.67];

const armeniaBounds = [
  [-75.740, 4.470],
  [-75.610, 4.590]
];

const regionBounds = [
  [-76.10, 4.30],
  [-75.35, 4.95]
];

let currentMode = "epicenter";
let barriosData = null;
let fallaData = null;
let edificiosData = { type: "FeatureCollection", features: [] };

let epicenter = null;
let referencePoint = null;
let analysisPoint = null;

let selectedBarrioFeature = null;
let lastComputedA2 = null;
let waveInterval = null;
let buildingsVisible = true;

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap"
      }
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": 0.96,
          "raster-brightness-min": 0.28,
          "raster-brightness-max": 1.00,
          "raster-contrast": -0.08,
          "raster-saturation": -0.18
        }
      }
    ]
  },
  center: ARMENIA_CENTER,
  zoom: 12,
  pitch: 64,
  bearing: -26,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

function forceMapResize() {
  map.resize();
}

window.addEventListener("load", () => {
  setTimeout(forceMapResize, 100);
  setTimeout(forceMapResize, 500);
  setTimeout(forceMapResize, 1000);
});

window.addEventListener("resize", forceMapResize);

if ("ResizeObserver" in window) {
  const mapObserver = new ResizeObserver(() => {
    requestAnimationFrame(forceMapResize);
  });
  mapObserver.observe(document.getElementById("map"));
  mapObserver.observe(document.querySelector(".map-wrapper"));
}

map.on("load", async () => {
  try {
    // Primero se usan los datos incrustados en datos_geograficos.js.
    // Esto evita que las capas desaparezcan si el navegador bloquea fetch local.
    barriosData = window.BARRIOS_GEOJSON || await fetch("barrios_vulnerabilidad.geojson").then((r) => r.json());
    fallaData = window.FALLA_GEOJSON || await fetch("falla_armenia.geojson").then((r) => r.json());

    barriosData.features.forEach((feature, index) => {
      feature.id = feature.id ?? index;
    });

    fallaData.features.forEach((feature, index) => {
      feature.id = feature.id ?? index;
    });

    addCoreLayers();
    generateBuildings();
    updateEverything();
    fitToArmenia(false);

    updateLayerStatus();
  } catch (error) {
    console.error("No se pudieron cargar las capas del proyecto:", error);
    const status = document.getElementById("layerStatus");
    if (status) {
      status.classList.add("error");
      status.textContent = "No se cargaron barrios/falla. Abre con Live Server.";
    }
  }
});

// =======================
// Capas 3D
// =======================
function addCoreLayers() {
  map.addSource("barrios", {
    type: "geojson",
    data: barriosData,
    generateId: true
  });

  map.addLayer({
    id: "barrios-fill",
    type: "fill",
    source: "barrios",
    paint: {
      "fill-color": [
        "match",
        ["get", "vulnerabilidad"],
        "Alta", "#ef4444",
        "Media", "#f59e0b",
        "Baja", "#fff3a3",
        "Muy baja", "#b8e8c8",
        "#cbd5e1"
      ],
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        0.92,
        0.78
      ]
    }
  });

  map.addLayer({
    id: "barrios-line",
    type: "line",
    source: "barrios",
    paint: {
      "line-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#0f172a",
        "#475569"
      ],
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3.4,
        1.55
      ],
      "line-opacity": 1
    }
  });

  map.addSource("falla", {
    type: "geojson",
    data: fallaData,
    generateId: true
  });

  map.addLayer({
    id: "falla-fill",
    type: "fill",
    source: "falla",
    paint: {
      "fill-color": "#7c3aed",
      "fill-opacity": 0.22
    }
  });

  map.addLayer({
    id: "falla-line",
    type: "line",
    source: "falla",
    paint: {
      "line-color": "#6d28d9",
      "line-width": 4.8,
      "line-opacity": 1,
      "line-dasharray": [2, 1.1]
    }
  });

  map.addLayer({
    id: "falla-hit",
    type: "fill",
    source: "falla",
    paint: {
      "fill-color": "#7c3aed",
      "fill-opacity": 0.01
    }
  });

  map.on("mouseenter", "falla-hit", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "falla-hit", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("click", "falla-hit", (e) => {
    const props = e.features?.[0]?.properties || {};
    const nombre = props.Name || props.name || props.NOMBRE || props.nombre || "Corredor real de la Falla de Armenia";

    new maplibregl.Popup({ closeButton: true })
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>${nombre}</strong><br>
        Corredor real de la Falla de Armenia incorporado al visor.
      `)
      .addTo(map);
  });

  map.addSource("edificios", {
    type: "geojson",
    data: edificiosData
  });

  map.addLayer({
    id: "edificios-3d",
    type: "fill-extrusion",
    source: "edificios",
    paint: {
      "fill-extrusion-color": ["get", "color"],
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-vertical-gradient": true
    }
  });

  map.addSource("distance-lines", {
    type: "geojson",
    data: emptyCollection()
  });

  map.addLayer({
    id: "distance-lines",
    type: "line",
    source: "distance-lines",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 3,
      "line-dasharray": [2, 1.4]
    }
  });

  map.addSource("points", {
    type: "geojson",
    data: emptyCollection()
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "points",
    paint: {
      "circle-radius": 9,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 4
    }
  });

  map.addLayer({
    id: "point-labels",
    type: "symbol",
    source: "points",
    layout: {
      "text-field": ["get", "label"],
      "text-size": 12,
      "text-offset": [0, -1.8],
      "text-anchor": "bottom",
      "text-allow-overlap": true
    },
    paint: {
      "text-color": "#173044",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2
    }
  });

  map.addSource("wave", {
    type: "geojson",
    data: emptyCollection()
  });

  map.addLayer({
    id: "wave-fill",
    type: "fill",
    source: "wave",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.0
    }
  });

  map.addLayer({
    id: "wave-line",
    type: "line",
    source: "wave",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 0,
      "line-opacity": 0.0
    }
  });

  map.on("click", "barrios-fill", (e) => {
    if (!e.features || !e.features.length) return;
    selectBarrioFeature(e.features[0]);
  });

  map.on("mouseenter", "barrios-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "barrios-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  function ensureVisibleProjectLayers() {
    ["barrios-fill", "barrios-line", "edificios-3d", "falla-fill", "falla-line", "falla-hit", "distance-lines", "points", "point-labels"].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        try { map.moveLayer(layerId); } catch (error) {}
      }
    });
  }

  ensureVisibleProjectLayers();

  function forceProjectLayerOrder() {
    ["barrios-fill", "barrios-line", "edificios-3d", "falla-fill", "falla-line", "falla-hit", "distance-lines", "points", "point-labels"].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        try { map.moveLayer(layerId); } catch (error) {}
      }
    });
  }

  forceProjectLayerOrder();

  map.on("click", (e) => {
    // Si el clic cae en modo ubicación, se usa para puntos.
    handleMapClick(e.lngLat);
  });
}

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

function updateLayerStatus() {
  const status = document.getElementById("layerStatus");
  if (!status) return;

  const barriosCount = barriosData?.features?.length || 0;
  const fallaCount = fallaData?.features?.length || 0;

  if (barriosCount && fallaCount) {
    status.textContent = `${barriosCount} barrios · Falla cargada`;
    status.classList.remove("error");
    setTimeout(() => {
      status.classList.add("fade");
    }, 2400);
  } else {
    status.classList.add("error");
    status.textContent = "Capas incompletas";
  }
}

// =======================
// Edificios 3D simbólicos
// =======================
function generateBuildings() {
  const features = [];

  barriosData.features.forEach((feature, index) => {
    const props = feature.properties || {};
    const vulnerability = normalizeVulnerability(props.vulnerabilidad);
    const name = getBarrioName(props);
    const rand = seededRandom(name);
    const bounds = geometryBounds(feature.geometry);

    if (!bounds) return;

    const count = vulnerability === "Alta" ? 3 : vulnerability === "Media" ? 2 : 1;

    let created = 0;
    let attempts = 0;

    while (created < count && attempts < count * 40) {
      attempts++;

      const lng = bounds.minLng + rand() * (bounds.maxLng - bounds.minLng);
      const lat = bounds.minLat + rand() * (bounds.maxLat - bounds.minLat);
      const point = { lng, lat };

      if (!pointInGeometry(point, feature.geometry)) continue;

      const size = vulnerability === "Alta" ? 0.00042 : vulnerability === "Media" ? 0.00037 : 0.00033;
      const height = vulnerability === "Alta" ? 150 : vulnerability === "Media" ? 112 : 82;

      features.push({
        type: "Feature",
        properties: {
          id: `${index}-${created}`,
          barrio: name,
          vulnerability,
          centerLng: lng,
          centerLat: lat,
          baseHeight: height,
          height,
          color: getBuildingColor(vulnerability, 0)
        },
        geometry: makeSquarePolygon(lng, lat, size)
      });

      created++;
    }
  });

  edificiosData = {
    type: "FeatureCollection",
    features
  };
}

function updateBuildingDamage(amplitude, waveRadiusKm = null, motionPhase = 0) {
  const origin = getWaveOrigin();

  edificiosData.features.forEach((feature, index) => {
    const vulnerability = feature.properties.vulnerability;
    let damage = 0;

    const buildingPoint = {
      lng: feature.properties.centerLng,
      lat: feature.properties.centerLat
    };

    const reachedByWave = waveRadiusKm === null
      ? true
      : distanceKm(origin, buildingPoint) <= waveRadiusKm;

    if (reachedByWave) {
      if (vulnerability === "Alta") {
        if (amplitude > 46) damage = 3;
        else if (amplitude > 26) damage = 2;
        else if (amplitude > 14) damage = 1;
      } else if (vulnerability === "Media") {
        if (amplitude > 58) damage = 3;
        else if (amplitude > 34) damage = 2;
        else if (amplitude > 18) damage = 1;
      } else {
        if (amplitude > 74) damage = 3;
        else if (amplitude > 50) damage = 2;
        else if (amplitude > 28) damage = 1;
      }
    }

    const baseHeight = feature.properties.baseHeight;
    let currentHeight = baseHeight;

    if (reachedByWave && damage > 0) {
      // Lógica parecida al visor 2D: el edificio "se mueve" según la intensidad,
      // cambia de color y se comprime un poco, pero no colapsa de forma brusca.
      const wobble = damage === 3 ? 0.18 : damage === 2 ? 0.11 : 0.06;
      const compression = damage === 3 ? 0.84 : damage === 2 ? 0.91 : 0.97;
      const oscillation = 1 + Math.sin(motionPhase + index * 0.75) * wobble;
      currentHeight = baseHeight * compression * oscillation;
    }

    feature.properties.height = Math.max(18, currentHeight);
    feature.properties.color = getBuildingColor(vulnerability, damage);
  });

  if (map.getSource("edificios")) {
    map.getSource("edificios").setData(edificiosData);
  }
}

function getBuildingColor(vulnerability, damage) {
  // Cada barrio conserva un color base según su vulnerabilidad.
  // Si la amplitud aumenta, el color evoluciona dentro de una escala de afectación.
  const palettes = {
    Alta: {
      0: "#efb0a3",  // base vulnerable
      1: "#f28c6b",  // afectación leve
      2: "#e85d3f",  // afectación media
      3: "#c62828"   // afectación alta
    },
    Media: {
      0: "#f5d58f",  // base intermedia
      1: "#f2c14e",  // leve
      2: "#f08c00",  // media
      3: "#d1491f"   // alta
    },
    Baja: {
      0: "#c7e7cf",  // base baja vulnerabilidad
      1: "#8fd19e",  // leve
      2: "#d9b44a",  // media
      3: "#ef6c3e"   // alta
    }
  };

  const palette = palettes[vulnerability] || palettes.Baja;
  return palette[damage] || palette[0];
}

function makeSquarePolygon(lng, lat, size) {
  const dx = size;
  const dy = size * 0.72;

  return {
    type: "Polygon",
    coordinates: [[
      [lng - dx, lat - dy],
      [lng + dx, lat - dy],
      [lng + dx, lat + dy],
      [lng - dx, lat + dy],
      [lng - dx, lat - dy]
    ]]
  };
}

// =======================
// Puntos, fórmula y selección
// =======================
function handleMapClick(lngLat) {
  const point = { lng: lngLat.lng, lat: lngLat.lat };
  const wasRunning = simulationRunning;

  if (wasRunning) stopSimulation();

  if (currentMode === "epicenter") {
    epicenter = point;
    setMode("reference");
  } else if (currentMode === "reference") {
    referencePoint = point;
    setMode("analysis");
  } else if (currentMode === "analysis") {
    analysisPoint = point;
  }

  updateEverything();

  if (wasRunning) startSimulation();
}

function updatePointsAndLines() {
  const pointFeatures = [];

  if (epicenter) {
    pointFeatures.push(pointFeature(epicenter, "Epicentro", "#e45750"));
  }

  if (referencePoint) {
    pointFeatures.push(pointFeature(referencePoint, "Estación", "#2f9edd"));
  }

  if (analysisPoint) {
    pointFeatures.push(pointFeature(analysisPoint, "Punto de análisis", "#35a870"));
  }

  if (map.getSource("points")) {
    map.getSource("points").setData({
      type: "FeatureCollection",
      features: pointFeatures
    });
  }

  const lineFeatures = [];

  if (epicenter && referencePoint) {
    lineFeatures.push({
      type: "Feature",
      properties: { color: "#2f9edd" },
      geometry: {
        type: "LineString",
        coordinates: [[epicenter.lng, epicenter.lat], [referencePoint.lng, referencePoint.lat]]
      }
    });
  }

  if (epicenter && analysisPoint) {
    lineFeatures.push({
      type: "Feature",
      properties: { color: "#35a870" },
      geometry: {
        type: "LineString",
        coordinates: [[epicenter.lng, epicenter.lat], [analysisPoint.lng, analysisPoint.lat]]
      }
    });
  }

  if (map.getSource("distance-lines")) {
    map.getSource("distance-lines").setData({
      type: "FeatureCollection",
      features: lineFeatures
    });
  }
}

function pointFeature(point, label, color) {
  return {
    type: "Feature",
    properties: { label, color },
    geometry: { type: "Point", coordinates: [point.lng, point.lat] }
  };
}

function calculateA2() {
  const A1 = Number(amplitudeSlider.value);
  knownAmplitudeInput.value = A1.toFixed(1);
  amplitudeValue.textContent = A1.toFixed(1);

  let r1 = null;
  let r2 = null;

  if (epicenter && referencePoint) {
    r1 = distanceKm(epicenter, referencePoint);
    r1Value.textContent = `${r1.toFixed(2)} km`;
  } else {
    r1Value.textContent = "—";
  }

  if (epicenter && analysisPoint) {
    r2 = distanceKm(epicenter, analysisPoint);
    r2Value.textContent = `${r2.toFixed(2)} km`;
  } else {
    r2Value.textContent = "—";
  }

  if (r1 && r2 && r2 > 0) {
    const A2 = A1 * (r1 / r2);
    lastComputedA2 = A2;
    a2Value.textContent = `${A2.toFixed(1)} mm`;
    return A2;
  }

  lastComputedA2 = null;
  a2Value.textContent = "—";
  return A1;
}

function updateEverything() {
  updatePointsAndLines();

  const amplitudeForInterpretation = calculateA2();

  updateSoilCards(amplitudeForInterpretation);
  updateBuildingDamage(amplitudeForInterpretation);
  updateBarrioFromAnalysisPoint();
}

function getCurrentWaveAmplitude() {
  return lastComputedA2 || Number(amplitudeSlider.value);
}

// =======================
// Barrio seleccionado
// =======================
function updateBarrioFromAnalysisPoint() {
  if (!analysisPoint || !barriosData) {
    clearBarrioSelection();
    selectedBarrioName.textContent = "Sin seleccionar";
    selectedBarrioInfo.innerHTML = "Ubica el punto de análisis sobre un barrio para ver su vulnerabilidad relativa.";
    return;
  }

  const feature = barriosData.features.find((item) => pointInGeometry(analysisPoint, item.geometry));

  if (!feature) {
    clearBarrioSelection();
    selectedBarrioName.textContent = "Fuera de barrio";
    selectedBarrioInfo.innerHTML = "El punto de análisis no cayó sobre un polígono de barrio de la capa cargada.";
    return;
  }

  selectBarrioFeature(feature);
}

function selectBarrioFeature(feature) {
  clearBarrioSelection();

  selectedBarrioFeature = feature;

  const props = feature.properties || {};
  const name = getBarrioName(props);
  const vuln = normalizeVulnerability(props.vulnerabilidad);
  const indice = props.indice ? Number(props.indice).toFixed(2) : "Sin dato";
  const explanation = getVulnerabilityExplanation(vuln);

  selectedBarrioName.textContent = name;
  selectedBarrioInfo.innerHTML =
    `<strong>Vulnerabilidad relativa: ${vuln}</strong>. Índice integrado: ${indice}.<span class="barrio-explanation">${explanation}</span>`;

  applyBarrioReadingToSoilPanel(feature);

  // MapLibre feature-state necesita un id. Si no existe, se usa el índice de la fuente.
  const featureId = feature.id ?? barriosData.features.indexOf(feature);
  if (featureId !== undefined && featureId >= 0) {
    map.setFeatureState({ source: "barrios", id: featureId }, { selected: true });
  }
}

function clearBarrioSelection() {
  if (!selectedBarrioFeature || !barriosData || !map.getSource("barrios")) return;

  const featureId = selectedBarrioFeature.id ?? barriosData.features.indexOf(selectedBarrioFeature);
  if (featureId !== undefined && featureId >= 0) {
    map.setFeatureState({ source: "barrios", id: featureId }, { selected: false });
  }

  selectedBarrioFeature = null;
  updateSoilCards(getCurrentWaveAmplitude ? getCurrentWaveAmplitude() : Number(amplitudeSlider.value));
}

// =======================
// Interpretación del suelo
// =======================
function getInterpretation(value) {
  if (value <= 20) {
    return {
      level: "Bajo",
      badge: "Amplitud baja",
      response: "Más favorable",
      behavior: "Afectación baja o limitada",
      soil: "Sectores con pocas limitaciones relativas, pendientes suaves o moderadas y mejor estabilidad general del terreno.",
      className: "low",
      color: "#35a870"
    };
  }

  if (value <= 50) {
    return {
      level: "Medio",
      badge: "Amplitud media",
      response: "Intermedia",
      behavior: "Afectación media o vulnerabilidad moderada",
      soil: "Zonas con condiciones intermedias: pendientes más marcadas, posible erosión localizada, mayor concentración urbana o aglomeración de personas y respuesta sísmica moderada.",
      className: "medium",
      color: "#f0ab3b"
    };
  }

  return {
    level: "Alto",
    badge: "Amplitud alta",
    response: "Menos favorable",
    behavior: "Afectación alta o vulnerabilidad crítica",
    soil: "Sectores con condiciones menos favorables: pendientes altas, erosión, cercanía o influencia del corredor de falla, construcciones antiguas o vulnerables y mayor susceptibilidad frente al movimiento sísmico.",
    className: "high",
    color: "#e45750"
  };
}

function getBarrioReading(feature, amplitude) {
  const props = feature?.properties || {};
  const vuln = normalizeVulnerability(props.vulnerabilidad);
  const name = getBarrioName(props);
  const indice = Number(props.indice || 0);
  const valSuelo = Number(props.val_suelo || 0);
  const valFalla = Number(props.val_falla || 0);
  const valAntig = Number(props.val_antig || 0);
  const limitacion = Number(props.porcentaje_limitacion_suelo || 0);

  const amplitudeLevel =
    amplitude > 50 ? "alta" :
    amplitude > 20 ? "media" : "baja";

  let level = vuln;
  let response = "";
  let behavior = "";
  let soil = "";
  let color = "#35a870";
  let className = "low";

  if (vuln === "Alta") {
    level = amplitudeLevel === "alta" ? "Alto" : "Medio-alto";
    response = "Menos favorable";
    behavior = amplitudeLevel === "alta"
      ? "Afectación alta por combinación de amplitud y vulnerabilidad crítica"
      : "Afectación media-alta por condiciones urbanas y geomorfológicas sensibles";

    const variants = [
      "Sector con pendientes altas, posible erosión, cercanía o influencia de la falla y presencia probable de edificaciones antiguas o vulnerables.",
      "Zona con condiciones territoriales críticas: relieve inclinado, mayor susceptibilidad a inestabilidad y respuesta sísmica menos favorable.",
      "Barrio con alta vulnerabilidad relativa; puede concentrar limitaciones por pendiente, erosión, antigüedad constructiva y exposición al corredor de falla."
    ];
    soil = variants[Math.abs(name.length + Math.round(indice)) % variants.length];
    color = "#e45750";
    className = "high";
  } else if (vuln === "Media") {
    level = amplitudeLevel === "alta" ? "Medio-alto" : "Medio";
    response = "Intermedia";
    behavior = amplitudeLevel === "alta"
      ? "Afectación media con tendencia alta por aumento de amplitud"
      : "Afectación media o vulnerabilidad moderada";

    const variants = [
      "Zona con condiciones intermedias: pendientes más marcadas en algunos sectores, posible erosión localizada y concentración urbana moderada.",
      "Sector con respuesta sísmica moderada; puede presentar aglomeración de personas, cambios de pendiente y limitaciones puntuales del terreno.",
      "Barrio de vulnerabilidad media, con factores que no son críticos en todo el sector, pero que pueden aumentar la afectación ante mayor amplitud."
    ];
    soil = variants[Math.abs(name.length + Math.round(valSuelo) + Math.round(valAntig)) % variants.length];
    color = "#f0ab3b";
    className = "medium";
  } else if (vuln === "Baja") {
    level = amplitudeLevel === "alta" ? "Bajo-medio" : "Bajo";
    response = "Más favorable";
    behavior = amplitudeLevel === "alta"
      ? "Afectación baja con posible aumento local por amplitud alta"
      : "Afectación baja o limitada";

    const variants = [
      "Sector con pocas limitaciones relativas, pendientes suaves o moderadas y mejor estabilidad general del terreno.",
      "Zona con menor susceptibilidad relativa; puede presentar pendientes inclinadas, pero sin condiciones tan desfavorables como los sectores críticos.",
      "Barrio con condiciones más favorables para la respuesta sísmica, menor limitación territorial y baja vulnerabilidad comparativa."
    ];
    soil = variants[Math.abs(name.length + Math.round(limitacion)) % variants.length];
    color = "#35a870";
    className = "low";
  } else {
    level = getInterpretation(amplitude).level;
    response = getInterpretation(amplitude).response;
    behavior = getInterpretation(amplitude).behavior;
    soil = "No se dispone de clasificación suficiente para este barrio; se mantiene una lectura general según la amplitud estimada.";
    color = getInterpretation(amplitude).color;
    className = getInterpretation(amplitude).className;
  }

  return { level, response, behavior, soil, color, className };
}

function applyBarrioReadingToSoilPanel(feature) {
  if (!feature) return;

  const amplitude = getCurrentWaveAmplitude ? getCurrentWaveAmplitude() : Number(amplitudeSlider.value);
  const reading = getBarrioReading(feature, amplitude);

  movementLevel.textContent = reading.level;
  soilResponse.textContent = reading.response;
  amplitudeBehavior.textContent = reading.behavior;
  soilType.textContent = reading.soil;

  document.documentElement.style.setProperty("--accent", reading.color);
}
function updateSoilCards(amplitude) {
  const data = getInterpretation(amplitude);

  movementLevel.textContent = data.level;
  soilResponse.textContent = data.response;
  amplitudeBehavior.textContent = data.behavior;
  soilType.textContent = data.soil;

  heroBadge.innerHTML = `<span class="dot" style="background:${data.color};"></span>${data.badge}`;
  heroBadge.style.background = hexToRgba(data.color, 0.12);
  heroBadge.style.borderColor = hexToRgba(data.color, 0.26);
  heroBadge.style.color = data.className === "high" ? "#8d2f2a" : data.className === "medium" ? "#7b540f" : "#186440";

  document.documentElement.style.setProperty("--accent", data.color);

  const shakeValue = amplitude > 50 ? 3.1 : amplitude > 20 ? 1.7 : 0.5;
  const overlayOpacity = amplitude > 50 ? 0.22 : amplitude > 20 ? 0.14 : 0.06;

  document.documentElement.style.setProperty("--shake-x", `${shakeValue}px`);
  document.documentElement.style.setProperty("--shake-y", `${shakeValue * 0.65}px`);
  document.documentElement.style.setProperty("--impact-opacity", overlayOpacity);

  if (data.className === "high") {
    document.documentElement.style.setProperty("--impact-color", "rgba(228,87,80,0.16)");
  } else if (data.className === "medium") {
    document.documentElement.style.setProperty("--impact-color", "rgba(240,171,59,0.14)");
  } else {
    document.documentElement.style.setProperty("--impact-color", "rgba(47,158,221,0.10)");
  }
}

// =======================
// Onda sísmica geográfica
// =======================
let waveCycleTimeout = null;
let simulationRunning = false;
let activeWaveMarkers = [];
let currentWaveRadiusKm = 0;

function getWaveOrigin() {
  return epicenter || { lng: -75.72, lat: 4.41 };
}

function getCurrentWaveAmplitude() {
  return lastComputedA2 || Number(amplitudeSlider.value);
}

function createCircleFeature(center, radiusKm, color) {
  const points = 160;
  const coordinates = [];
  const earthRadiusKm = 6371;

  const lat1 = toRad(center.lat);
  const lng1 = toRad(center.lng);
  const angularDistance = radiusKm / earthRadiusKm;

  for (let i = 0; i <= points; i++) {
    const bearing = toRad((i / points) * 360);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    coordinates.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
  }

  return {
    type: "Feature",
    properties: { color },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}

function getWaveColor(amplitude) {
  const info = getInterpretation(amplitude);
  if (info.className === "high") return "#e45750";
  if (info.className === "medium") return "#f0ab3b";
  return "#2f9edd";
}

function createWavePulse(amplitude, durationMs) {
  const origin = getWaveOrigin();
  const info = getInterpretation(amplitude);
  const waveSize = 46 + Math.min(amplitude, 120) * 1.1;
  const scale = 5.0 + Math.min(amplitude, 120) / 11.5;

  activeWaveMarkers.forEach((marker) => marker.remove());
  activeWaveMarkers = [];

  const container = document.createElement("div");
  container.className = "wave-marker";

  const ring = document.createElement("div");
  ring.className = `wave-ring ${info.className}`;
  ring.style.setProperty("--wave-size", `${waveSize}px`);
  ring.style.setProperty("--scale", `${scale}`);
  ring.style.setProperty("--duration", `${Math.max(durationMs / 1000, 1.3)}s`);

  container.appendChild(ring);

  const marker = new maplibregl.Marker({ element: container, anchor: "center" })
    .setLngLat([origin.lng, origin.lat])
    .addTo(map);

  activeWaveMarkers.push(marker);

  setTimeout(() => {
    marker.remove();
    activeWaveMarkers = activeWaveMarkers.filter((item) => item !== marker);
  }, durationMs + 180);
}

function setWave(radiusKm, amplitude) {
  // La onda visible principal se maneja con el pulso centrado en el epicentro.
  // Este método se deja como no-op para evitar un segundo círculo visual en otra zona.
  return;
}

function clearWave() {
  return;
}

function getMaxWaveRadiusKm(amplitude) {
  if (amplitude > 70) return 42;
  if (amplitude > 50) return 34;
  if (amplitude > 20) return 24;
  return 14;
}

function runWaveCycle() {
  if (!simulationRunning) return;

  const amplitude = getCurrentWaveAmplitude();
  const maxRadius = getMaxWaveRadiusKm(amplitude);
  const duration = amplitude > 50 ? 2600 : amplitude > 20 ? 3100 : 3600;
  const stepMs = 120;
  const totalSteps = Math.max(14, Math.round(duration / stepMs));
  let step = 0;

  createWavePulse(amplitude, duration);
  currentWaveRadiusKm = 0;
  updateBuildingDamage(amplitude, 0.01, 0);

  waveInterval = setInterval(() => {
    if (!simulationRunning) return;

    step += 1;
    const progress = Math.min(step / totalSteps, 1);
    const eased = 1 - Math.pow(1 - progress, 2.05);
    currentWaveRadiusKm = Math.max(0.12, maxRadius * eased);
    const motionPhase = step * 1.15;

    updateBuildingDamage(amplitude, currentWaveRadiusKm, motionPhase);

    if (progress >= 1) {
      clearInterval(waveInterval);
      waveInterval = null;
      currentWaveRadiusKm = maxRadius;
      updateBuildingDamage(amplitude, currentWaveRadiusKm, motionPhase);
      waveCycleTimeout = setTimeout(() => {
        if (!simulationRunning) return;
        runWaveCycle();
      }, 620);
    }
  }, stepMs);
}

function startSimulation() {
  stopSimulation();

  simulationRunning = true;

  const amplitude = getCurrentWaveAmplitude();

  if (amplitude > 12) {
    intensityOverlay.classList.add("active");
  }

  // La onda visible sale del epicentro y el daño se aplica por radio interno.
  runWaveCycle();
}

function stopSimulation() {
  simulationRunning = false;
  intensityOverlay.classList.remove("active");

  if (waveInterval) {
    clearInterval(waveInterval);
    waveInterval = null;
  }

  if (waveCycleTimeout) {
    clearTimeout(waveCycleTimeout);
    waveCycleTimeout = null;
  }

  currentWaveRadiusKm = 0;
  clearWave();
  activeWaveMarkers.forEach((marker) => marker.remove());
  activeWaveMarkers = [];
  updateBuildingDamage(getCurrentWaveAmplitude(), null);
}

// =======================
// Utilidades geométricas
// =======================
function normalizeVulnerability(value) {
  const text = String(value || "").trim().toLowerCase();

  if (text.includes("alta") || text.includes("alto")) return "Alta";
  if (text.includes("media") || text.includes("medio")) return "Media";
  if (text.includes("baja") || text.includes("bajo")) return "Baja";

  return "Sin dato";
}

function getBarrioName(props) {
  return props.barrio || props.barrio_alt || props.barrio_alt2 || "Barrio sin nombre";
}

function getVulnerabilityExplanation(level) {
  const normalized = normalizeVulnerability(level);

  if (normalized === "Alta") {
    return "Presenta condiciones menos favorables frente al sismo. Esta clase se asocia con mayor susceptibilidad territorial, presencia de pendientes, procesos de erosión, posibles materiales menos competentes y una respuesta sísmica más crítica.";
  }

  if (normalized === "Media") {
    return "Corresponde a una condición intermedia. El sector puede presentar algunos factores de susceptibilidad, pero con menor criticidad que las zonas de vulnerabilidad alta.";
  }

  if (normalized === "Baja") {
    return "Representa condiciones relativamente más favorables. En general corresponde a sectores con mejor estabilidad relativa del terreno y menor susceptibilidad frente a la respuesta sísmica.";
  }

  return "No se dispone de una clasificación interpretativa para este barrio.";
}

function pointInRing(point, ring) {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    return geometry.coordinates.some((ring) => pointInRing(point, ring));
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      polygon.some((ring) => pointInRing(point, ring))
    );
  }

  return false;
}

function geometryBounds(geometry) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function scanRing(ring) {
    ring.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  }

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(scanRing);
  }

  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => polygon.forEach(scanRing));
  }

  if (!Number.isFinite(minLng)) return null;

  return { minLng, minLat, maxLng, maxLat };
}

function seededRandom(seedText) {
  let seed = 0;
  const text = String(seedText || "barrio");

  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }

  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(value) {
  return value * Math.PI / 180;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =======================
// Eventos
// =======================
function setMode(mode) {
  currentMode = mode;

  document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  stepEpicenter.classList.toggle("active-step", mode === "epicenter");
  stepReference.classList.toggle("active-step", mode === "reference");
  stepAnalysis.classList.toggle("active-step", mode === "analysis");
}

document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

amplitudeSlider.addEventListener("input", () => {
  updateEverything();
  if (waveInterval) startSimulation();
});

knownAmplitudeInput.addEventListener("input", () => {
  const value = Number(knownAmplitudeInput.value);
  if (!Number.isNaN(value)) {
    amplitudeSlider.value = Math.max(0, Math.min(100, value));
    updateEverything();
    if (waveInterval) startSimulation();
  }
});

applyFormulaBtn.addEventListener("click", () => {
  updateEverything();
  if (waveInterval) startSimulation();
});

simulateBtn.addEventListener("click", startSimulation);
stopBtn.addEventListener("click", stopSimulation);

clearPointsBtn.addEventListener("click", () => {
  stopSimulation();

  epicenter = null;
  referencePoint = null;
  analysisPoint = null;
  lastComputedA2 = null;

  r1Value.textContent = "—";
  r2Value.textContent = "—";
  a2Value.textContent = "—";

  clearBarrioSelection();
  selectedBarrioName.textContent = "Sin seleccionar";
  selectedBarrioInfo.innerHTML = "Ubica el punto de análisis sobre un barrio para ver su vulnerabilidad relativa.";

  setMode("epicenter");
  updateEverything();
});

toggleBuildingsBtn.addEventListener("click", () => {
  buildingsVisible = !buildingsVisible;
  toggleBuildingsBtn.textContent = buildingsVisible ? "Ocultar edificios" : "Mostrar edificios";

  if (map.getLayer("edificios-3d")) {
    map.setLayoutProperty("edificios-3d", "visibility", buildingsVisible ? "visible" : "none");
  }
});

loadCaseBtn.addEventListener("click", () => {
  stopSimulation();

  amplitudeSlider.value = 21.9;
  knownAmplitudeInput.value = 21.9;

  // Caso de referencia del terremoto del Eje Cafetero de 1999.
  // Epicentro reportado cerca de Córdoba, Quindío.
  epicenter = { lng: -75.669, lat: 4.465 };
  referencePoint = { lng: -75.6946, lat: 4.8143 };
  analysisPoint = { lng: -75.6811, lat: 4.5339 };

  updateEverything();
  fitToCase1999(true);
  setMode("analysis");
});

focusRegionBtn.addEventListener("click", () => fitToRegion(true));
focusArmeniaBtn.addEventListener("click", () => fitToArmenia(true));

reset3dBtn.addEventListener("click", () => {
  map.easeTo({
    pitch: 68,
    bearing: -32,
    zoom: Math.max(map.getZoom(), 12.2),
    duration: 850
  });
});

resetNorthBtn.addEventListener("click", () => {
  map.easeTo({
    pitch: 0,
    bearing: 0,
    duration: 850
  });
});

function fitToArmenia(animated) {
  map.fitBounds(armeniaBounds, {
    padding: 30,
    duration: animated ? 900 : 0,
    pitch: 64,
    bearing: -26
  });
}

function fitToRegion(animated) {
  map.fitBounds(regionBounds, {
    padding: 30,
    duration: animated ? 900 : 0,
    pitch: 56,
    bearing: -18
  });
}

function fitToCase1999(animated) {
  const bounds = [
    [-75.74, 4.43],
    [-75.64, 4.84]
  ];

  map.fitBounds(bounds, {
    padding: 38,
    duration: animated ? 950 : 0,
    pitch: 62,
    bearing: -24
  });
}

setMode("epicenter");
