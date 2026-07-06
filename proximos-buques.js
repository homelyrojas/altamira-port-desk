const API_BASE = "https://bat-api-production.up.railway.app";

let currentSchedule = [];

const scheduleInput = document.getElementById("scheduleInput");
const reportOutput = document.getElementById("reportOutput");
const processStatus = document.getElementById("processStatus");
const btnProcess = document.getElementById("btnProcess");
const btnGenerate = document.getElementById("btnGenerate");
const btnCopy = document.getElementById("btnCopy");
const btnClear = document.getElementById("btnClear");
const rangeStart = document.getElementById("rangeStart");
const rangeEnd = document.getElementById("rangeEnd");
const btnGenerateRange = document.getElementById("btnGenerateRange");
const btnCopyRange = document.getElementById("btnCopyRange");
const rangeOutput = document.getElementById("rangeOutput");

function apiUrl(path) {
  return `${API_BASE.replace(/\/$/, "")}${path}`;
}

async function apiGet(path) {
  const response = await fetch(apiUrl(path), { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `No se pudo consultar BAT-API. HTTP ${response.status}`);
  return payload;
}

async function apiPost(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `No se pudo enviar informacion a BAT-API. HTTP ${response.status}`);
  return data;
}

function clean(value) {
  return String(value || "").replace(/\r/g, "").replace(/\u00a0/g, " ").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDateMX(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateInput(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value) {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseScheduleDate(value) {
  if (!value) return null;
  const text = clean(value);
  const dateOnly = text.slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTime(value) {
  const text = clean(value);
  if (!text) return "";
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function getRange(today = new Date()) {
  const start = addDays(startOfDay(today), -1);
  const day = today.getDay();
  let targetDay;

  if (day === 1 || day === 2) targetDay = 3;
  else if (day === 3 || day === 4) targetDay = 5;
  else targetDay = 1;

  let diff = targetDay - day;
  if (diff < 0) diff += 7;

  const end = addDays(startOfDay(today), diff);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function abbreviatePort(port) {
  const cleanPort = clean(port);
  if (!cleanPort) return "";

  const aliases = {
    "veracruz": "Ver",
    "altamira": "Alt",
    "cristobal": "Cri",
    "cartagena": "Car",
    "tampico": "Tam",
    "progreso": "Pro",
    "manzanillo": "Man",
    "lazaro cardenas": "Lzc",
    "lázaro cárdenas": "Lzc"
  };

  return aliases[normalize(cleanPort)] || cleanPort.slice(0, 3);
}

function toScheduleItem(record) {
  const etaDate = parseScheduleDate(record.eta_date || record.eta_datetime);

  return {
    id: record.id,
    buque: record.vessel_name || record.buque || "",
    service: record.service_name || record.service || "",
    etaFecha: etaDate ? formatDateMX(etaDate) : "",
    hora: normalizeTime(record.eta_time || record.hora || ""),
    puertoArribo: record.arrival_port || record.arrival_port_name || record.puertoArribo || "",
    puertoZarpe: record.departure_port || record.departure_port_name || record.puertoZarpe || "",
    notas: record.notes || record.notas || "",
    statusCode: record.status_code || "",
    etaDateObject: etaDate
  };
}

async function loadScheduleFromApi(params = "") {
  processStatus.textContent = "Consultando programación central en BAT-API...";
  const data = await apiGet(`/api/v1/vessels/schedule${params}`);
  currentSchedule = (Array.isArray(data) ? data : data.records || []).map(toScheduleItem);
  processStatus.textContent = `Programación central disponible: ${currentSchedule.length} registro(s).`;
  return currentSchedule;
}

async function processSchedule() {
  const text = scheduleInput.value.trim();

  if (!text) {
    alert("Pega primero la programación de próximos buques.");
    return;
  }

  btnProcess.disabled = true;

  try {
    processStatus.textContent = "Guardando programación en BAT-API/PostgreSQL...";

    const result = await apiPost("/api/v1/vessels/schedule/import-text", {
      text,
      source: "proximos-buques"
    });

    currentSchedule = (result.records || []).map(toScheduleItem);

    processStatus.textContent =
      `Programación guardada | Importados: ${result.imported} | Duplicados: ${result.duplicates} | Omitidos: ${result.ignored} | Batch: ${result.import_batch_id}`;

    alert("Programación guardada correctamente en PostgreSQL.");
  } catch (error) {
    console.error("Error guardando programación", error);
    processStatus.textContent = `Error al guardar programación: ${error.message || error}`;
    alert(error.message || error);
  } finally {
    btnProcess.disabled = false;
  }
}

function getUpcomingRecords() {
  const { start, end } = getRange(new Date());

  return currentSchedule
    .filter(item => item.etaDateObject && item.etaDateObject >= start && item.etaDateObject <= end)
    .sort((a, b) => {
      const dateDiff = a.etaDateObject - b.etaDateObject;
      if (dateDiff !== 0) return dateDiff;
      return clean(a.hora).localeCompare(clean(b.hora));
    });
}

function buildReport(records, title = "Proximos Buques", subtitle = "") {
  const lines = [title];

  if (subtitle) lines.push(subtitle);
  lines.push("");

  if (!records.length) {
    lines.push("Sin buques programados para el periodo.");
    return lines.join("\n");
  }

  records.forEach(item => {
    const prevPort = abbreviatePort(item.puertoZarpe);
    const prevText = prevPort ? ` [Prev. ${prevPort}]` : "";
    const hourText = item.hora ? ` ${item.hora}` : "";
    const serviceText = item.service ? ` | ${item.service}` : "";

    lines.push(`${item.buque} ETA ${item.etaFecha}${hourText}${prevText}${serviceText}`);
  });

  return lines.join("\n");
}

async function generateUpcoming() {
  try {
    await loadScheduleFromApi();
    reportOutput.value = buildReport(getUpcomingRecords());
  } catch (error) {
    alert(error.message || error);
  }
}

function getRecordsByDateRange(start, end) {
  const startDate = startOfDay(start);
  const endDate = startOfDay(end);
  endDate.setHours(23, 59, 59, 999);

  return currentSchedule
    .filter(item => item.etaDateObject && item.etaDateObject >= startDate && item.etaDateObject <= endDate)
    .sort((a, b) => {
      const dateDiff = a.etaDateObject - b.etaDateObject;
      if (dateDiff !== 0) return dateDiff;
      return clean(a.hora).localeCompare(clean(b.hora));
    });
}

async function generateRangeReport() {
  const start = parseDateInput(rangeStart?.value);
  const end = parseDateInput(rangeEnd?.value);

  if (!start || !end) {
    alert("Selecciona fecha inicio y fecha fin.");
    return;
  }

  if (start > end) {
    alert("La fecha inicio no puede ser mayor que la fecha fin.");
    return;
  }

  try {
    const params = `?start=${formatDateInput(start)}&end=${formatDateInput(end)}`;
    await loadScheduleFromApi(params);
    const records = getRecordsByDateRange(start, end);
    const subtitle = `Del ${formatDateMX(start)} al ${formatDateMX(end)}`;
    rangeOutput.value = buildReport(records, "Buques por rango de fecha", subtitle);
  } catch (error) {
    alert(error.message || error);
  }
}

async function copyTextFrom(textarea, message) {
  const text = textarea.value.trim();

  if (!text) {
    alert(message);
    return;
  }

  try {
    await navigator.clipboard.writeText(textarea.value);
    alert("Reporte copiado al portapapeles.");
  } catch {
    textarea.select();
    document.execCommand("copy");
    alert("Reporte copiado al portapapeles.");
  }
}

function clearData() {
  scheduleInput.value = "";
  reportOutput.value = "";
  if (rangeOutput) rangeOutput.value = "";
  processStatus.textContent = "Pantalla limpia. Los datos en PostgreSQL no se eliminan.";
}

function setDefaultRangeDates() {
  if (!rangeStart || !rangeEnd) return;

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  if (!rangeStart.value) rangeStart.value = formatDateInput(today);
  if (!rangeEnd.value) rangeEnd.value = formatDateInput(nextWeek);
}

btnProcess?.addEventListener("click", processSchedule);
btnGenerate?.addEventListener("click", generateUpcoming);
btnCopy?.addEventListener("click", () => copyTextFrom(reportOutput, "Primero genera el reporte de próximos buques."));
btnClear?.addEventListener("click", clearData);
btnGenerateRange?.addEventListener("click", generateRangeReport);
btnCopyRange?.addEventListener("click", () => copyTextFrom(rangeOutput, "Primero genera el reporte por rango de fecha."));

setDefaultRangeDates();
loadScheduleFromApi().catch((error) => {
  console.warn("No se pudo cargar programación inicial", error);
  processStatus.textContent = "No se pudo consultar BAT-API. Verifica Railway.";
});
