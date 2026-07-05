const API_BASE = localStorage.getItem("BAT_API_BASE_URL") || "http://127.0.0.1:8000";

let currentRows = [];
let selectedRecord = null;

const btnRefresh = document.getElementById("btnRefresh");
const btnClear = document.getElementById("btnClear");
const btnCopy = document.getElementById("btnCopy");
const loadStatus = document.getElementById("loadStatus");
const searchBox = document.getElementById("searchBox");
const results = document.getElementById("results");
const reportBox = document.getElementById("reportBox");

const REPORT_FIELDS = [
  { key: "eta_datetime", label: "F.CRUCE LIMITE DE PUERTO" },
  { key: "pilot_on_board_arrival_datetime", label: "F.PILOTO ABORDO AL ARRIBO" },
  { key: "breakwater_crossing_arrival_datetime", label: "F.CRUCE DE ESCOLLERAS" },
  { key: "berthed_datetime", label: "F.TOTALMENTE ATRACADO", tramo: true },
  { key: "operation_start_datetime", label: "F.INICIO OPERACIONES" },
  { key: "operation_end_datetime", label: "F.TERMINO DE OPERACIONES" },
  { key: "pilot_on_board_departure_datetime", label: "F. PILOTO ABORDO AL ZARPE" },
  { key: "unberthed_datetime", label: "F.LIBRE DE CABOS [DESATRAQUE]" },
  { key: "breakwater_crossing_departure_datetime", label: "F.CRUCE ESCOLLERAS" },
  { key: "pilot_disembark_datetime", label: "F. DESEMBARQUE DE PILOTO" }
];

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error("No se pudo consultar BAT-API");
  return response.json();
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function getTramo(record) {
  return record.berth || record.terminal || record.arrival_port_name || "";
}

async function loadFromApi() {
  try {
    loadStatus.textContent = "Consultando BAT-API...";
    const data = await apiGet("/api/v1/vessel-calls?limit=500");

    currentRows = data.records || [];
    selectedRecord = null;
    results.innerHTML = "";
    reportBox.value = "";

    loadStatus.textContent =
      `Base vigente desde API | Registros: ${currentRows.length} | Actualizado: ${new Date().toLocaleString("es-MX")}`;

    if (searchBox.value.trim()) searchRecords();
  } catch (error) {
    loadStatus.textContent = "Sin conexión con BAT-API.";
    alert(error.message);
  }
}

function searchRecords() {
  const q = normalizeText(searchBox.value);
  results.innerHTML = "";

  if (!q) {
    results.innerHTML = '<div class="az-status">Escribe para buscar una escala.</div>';
    return;
  }

  if (!currentRows.length) {
    results.innerHTML = '<div class="az-status">No hay datos cargados desde API.</div>';
    return;
  }

  const matches = currentRows.filter((r) => {
    const haystack = normalizeText([
      r.vessel_name,
      r.voyage,
      r.service_name,
      r.arrival_port_name,
      r.departure_port_name,
      r.terminal,
      r.berth,
      r.status_code,
      r.notes
    ].join(" "));
    return haystack.includes(q);
  }).slice(0, 30);

  if (!matches.length) {
    results.innerHTML = '<div class="az-status">Sin coincidencias.</div>';
    return;
  }

  for (const record of matches) {
    const item = document.createElement("div");
    item.className = "az-result";
    item.innerHTML = `
      <strong>${record.vessel_name} ${record.voyage || ""}</strong>
      <span>Servicio: ${record.service_name || "-"} | Puerto: ${record.arrival_port_name || "-"} | Estado: ${record.status_code || "-"}</span>
    `;

    item.addEventListener("click", () => {
      selectedRecord = record;
      reportBox.value = buildReport(record);
    });

    results.appendChild(item);
  }
}

function buildReport(record) {
  const title = `Información de Arribo / Salida del buque ${record.vessel_name}${record.voyage ? " " + record.voyage : ""}`;
  const lines = [title, ""];

  lines.push(`SERVICIO: ${record.service_name || "PENDIENTE"}`);
  lines.push(`PUERTO ARRIBO: ${record.arrival_port_name || "PENDIENTE"}`);
  lines.push(`PUERTO ZARPE: ${record.departure_port_name || "PENDIENTE"}`);
  lines.push(`ESTADO OPERATIVO: ${record.status_code || "PENDIENTE"}`);
  lines.push("");

  for (const field of REPORT_FIELDS) {
    const value = formatDateTime(record[field.key]);

    let line = value
      ? `${value} ${field.label}`
      : `PENDIENTE ......... ${field.label}`;

    if (field.tramo) {
      const tramo = getTramo(record);
      if (tramo) line += ` [${tramo}]`;
    }

    lines.push(line);
  }

  if (record.notes) {
    lines.push("");
    lines.push(`NOTAS: ${record.notes}`);
  }

  return lines.join("\n");
}

async function copyReport() {
  const text = reportBox.value.trim();

  if (!text) {
    alert("Primero genera un reporte.");
    return;
  }

  try {
    await navigator.clipboard.writeText(reportBox.value);
    alert("Reporte copiado al portapapeles.");
  } catch {
    reportBox.select();
    document.execCommand("copy");
    alert("Reporte copiado al portapapeles.");
  }
}

function clearData() {
  selectedRecord = null;
  searchBox.value = "";
  results.innerHTML = "";
  reportBox.value = "";
  loadStatus.textContent = "Pantalla limpia. Los datos en PostgreSQL no se eliminan.";
}

btnRefresh.addEventListener("click", loadFromApi);
btnClear.addEventListener("click", clearData);
btnCopy.addEventListener("click", copyReport);
searchBox.addEventListener("input", searchRecords);

loadFromApi();
