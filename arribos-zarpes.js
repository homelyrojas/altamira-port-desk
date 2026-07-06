const API_BASE = "https://bat-api-production.up.railway.app";
let currentRows = [];
let selectedRecord = null;

const btnRefresh = document.getElementById("btnRefresh");
const btnClear = document.getElementById("btnClear");
const btnCopy = document.getElementById("btnCopy");
const btnUploadExcel = document.getElementById("btnUploadExcel");
const excelFile = document.getElementById("excelFile");
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

function clean(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function pick(record, keys) {
  for (const key of keys) {
    if (record[key]) return record[key];
  }
  return "";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function normalizeRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.records)) return payload.records;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadLocalData() {
  const storageKeys = ["bat_arribos_zarpes_v060_current", "BAT_ARRIBOS_ZARPES_CURRENT", "arribos_zarpes_data"];

  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const rows = normalizeRecords(JSON.parse(raw));
        if (rows.length) return rows;
      }
    } catch (_) {}
  }

  const files = [
    "arribos-zarpes-data.json?v=" + Date.now(),
    "data/arribos-zarpes.json?v=" + Date.now(),
    "vessel-calls.json?v=" + Date.now(),
    "data/vessel-calls.json?v=" + Date.now()
  ];

  for (const file of files) {
    try {
      const rows = normalizeRecords(await fetchJson(file));
      if (rows.length) return rows;
    } catch (_) {}
  }

  return [];
}

async function loadData() {
  loadStatus.textContent = "Cargando datos operativos...";

      try {
      const data = await fetchJson(`${API_BASE.replace(/\/$/, "")}/api/v1/vessel-calls?limit=200`);
      currentRows = normalizeRecords(data);
      loadStatus.textContent =
          `Base vigente desde BAT-API | Registros: ${currentRows.length}`;

      if (searchBox.value.trim()) {
          searchRecords();
      }

      return;

  } catch (error) {
      console.warn("BAT-API no disponible.", error);
  }

  currentRows = await loadLocalData();
  selectedRecord = null;
  results.innerHTML = "";
  reportBox.value = "";

  if (currentRows.length) {
    loadStatus.textContent = `Modo web recuperado | Registros locales: ${currentRows.length}`;
  } else {
    loadStatus.textContent = "Modo web activo, pero no se encontro base local de Arribos y Zarpes.";
  }

  if (searchBox.value.trim()) searchRecords();
}

async function uploadExcel() {
  const file = excelFile && excelFile.files ? excelFile.files[0] : null;

  if (!file) {
    loadStatus.textContent = "Selecciona primero un archivo Excel.";
    alert("Selecciona primero un archivo Excel.");
    return;
  }

  const apiUrl = `${API_BASE.replace(/\/$/, "")}/api/v1/imports/arribos-zarpes`;

  const form = new FormData();
  form.append("file", file);

  btnUploadExcel.disabled = true;
  loadStatus.textContent = `Subiendo Excel a BAT-API: ${file.name}`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: form
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail || `Error HTTP ${response.status}`);
    }

    loadStatus.textContent =
      `Excel importado correctamente | Creados: ${payload.created} | Actualizados: ${payload.updated} | Omitidos: ${payload.skipped}`;

    await loadData();

  } catch (error) {
    console.error("Error importando Excel:", error);
    loadStatus.textContent = `Error al importar Excel: ${error.message || error}`;
    alert(`Error al importar Excel: ${error.message || error}`);
  } finally {
    btnUploadExcel.disabled = false;
  }
}

function getVessel(record) {
  return pick(record, ["vessel_name", "BUQUE", "Buque", "buque", "vessel"]);
}

function getVoyage(record) {
  return pick(record, ["voyage", "VIAJE", "Viaje", "viaje"]);
}

function getService(record) {
  return pick(record, ["service_name", "SERVICIO", "Servicio", "servicio"]);
}

function getPort(record) {
  return pick(record, ["arrival_port_name", "PUERTO", "Puerto", "puerto"]);
}

function getStatus(record) {
  return pick(record, ["status_code", "ESTADO", "Estado", "estado"]);
}

function getTramo(record) {
  return pick(record, ["berth", "terminal", "TRAMO", "Tramo", "tramo", "arrival_port_name"]);
}

function searchRecords() {
  const q = normalizeText(searchBox.value);
  results.innerHTML = "";

  if (!q) {
    results.innerHTML = '<div class="az-status">Escribe para buscar una escala.</div>';
    return;
  }

  if (!currentRows.length) {
    results.innerHTML = '<div class="az-status">No hay datos cargados.</div>';
    return;
  }

  const matches = currentRows.filter((r) => normalizeText(Object.values(r).join(" ")).includes(q)).slice(0, 30);

  if (!matches.length) {
    results.innerHTML = '<div class="az-status">Sin coincidencias.</div>';
    return;
  }

  for (const record of matches) {
    const item = document.createElement("div");
    item.className = "az-result";
    item.innerHTML = `<strong>${getVessel(record)} ${getVoyage(record)}</strong><span>Servicio: ${getService(record) || "-"} | Puerto: ${getPort(record) || "-"} | Estado: ${getStatus(record) || "-"}</span>`;

    item.addEventListener("click", () => {
      selectedRecord = record;
      generateReport(record);
    });

    results.appendChild(item);
  }
}

function readField(record, key) {
  const aliases = {
    eta_datetime: ["eta_datetime", "F.CRUCE LIMITE DE PUERTO", "CRUCE LIMITE DE PUERTO"],
    pilot_on_board_arrival_datetime: ["pilot_on_board_arrival_datetime", "F.PILOTO ABORDO AL ARRIBO"],
    breakwater_crossing_arrival_datetime: ["breakwater_crossing_arrival_datetime", "F.CRUCE DE ESCOLLERAS"],
    berthed_datetime: ["berthed_datetime", "F.TOTALMENTE ATRACADO"],
    operation_start_datetime: ["operation_start_datetime", "F.INICIO OPERACIONES"],
    operation_end_datetime: ["operation_end_datetime", "F.TERMINO DE OPERACIONES"],
    pilot_on_board_departure_datetime: ["pilot_on_board_departure_datetime", "F. PILOTO ABORDO AL ZARPE"],
    unberthed_datetime: ["unberthed_datetime", "F.LIBRE DE CABOS [DESATRAQUE]"],
    breakwater_crossing_departure_datetime: ["breakwater_crossing_departure_datetime", "F.CRUCE ESCOLLERAS"],
    pilot_disembark_datetime: ["pilot_disembark_datetime", "F. DESEMBARQUE DE PILOTO"]
  };

  return pick(record, aliases[key] || [key]);
}

function generateReport(record) {
  const header = `${getVessel(record)} ${getVoyage(record)}`.trim();
  const lines = [header, ""];

  for (const field of REPORT_FIELDS) {
    const value = formatDateTime(readField(record, field.key));
    const tramo = field.tramo ? ` ${getTramo(record)}`.trimEnd() : "";
    lines.push(`${field.label}${tramo ? " " + tramo : ""}: ${value || "PENDIENTE"}`);
  }

  reportBox.value = lines.join("\n");
}

btnUploadExcel?.addEventListener("click", uploadExcel);
btnRefresh?.addEventListener("click", loadData);
btnClear?.addEventListener("click", () => {
  selectedRecord = null;
  searchBox.value = "";
  results.innerHTML = "";
  reportBox.value = "";
});
btnCopy?.addEventListener("click", async () => {
  if (!reportBox.value) return;
  await navigator.clipboard.writeText(reportBox.value);
});
searchBox?.addEventListener("input", searchRecords);

document.addEventListener("DOMContentLoaded", loadData);
loadData();
