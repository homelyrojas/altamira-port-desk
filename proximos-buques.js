const STORAGE_KEY = 'bat_proximos_buques_v143_current';

let currentSchedule = [];

const scheduleInput = document.getElementById('scheduleInput');
const reportOutput = document.getElementById('reportOutput');
const processStatus = document.getElementById('processStatus');
const btnProcess = document.getElementById('btnProcess');
const btnGenerate = document.getElementById('btnGenerate');
const btnCopy = document.getElementById('btnCopy');
const btnClear = document.getElementById('btnClear');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const btnGenerateRange = document.getElementById('btnGenerateRange');
const btnCopyRange = document.getElementById('btnCopyRange');
const rangeOutput = document.getElementById('rangeOutput');

const EXPECTED_HEADERS = ['buque', 'service', 'eta fecha', 'hora', 'puerto de arribo', 'puerto de zarpe', 'notas'];

const KNOWN_SERVICES = [
  'CANADA GULF BRIDGE',
  'MEXICO GULF EXPRESS',
  'MEDGULF SERVICE',
  'PAMEX SERVICE',
  'N/A'
];

const KNOWN_PORTS = [
  'Altamira',
  'Veracruz',
  'Cristobal',
  'Cartagena',
  'Tampico',
  'Progreso',
  'Manzanillo',
  'Lazaro Cardenas',
  'Lázaro Cárdenas'
];

function clean(value) {
  return BATImport.clean(value);
}

function normalize(value) {
  return BATImport.normalize(value);
}

function parseDateMX(value) {
  return BATImport.parseDateMX(value);
}

function formatHour(value) {
  return BATImport.formatHour(value);
}

function formatDateMX(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateInput(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getRange(today = new Date()) {
  const start = addDays(startOfDay(today), -1);
  const day = today.getDay();
  let targetDay;

  if (day === 1 || day === 2) targetDay = 3;       // lunes/martes → miércoles
  else if (day === 3 || day === 4) targetDay = 5;  // miércoles/jueves → viernes
  else targetDay = 1;                              // viernes/sábado/domingo → lunes

  let diff = targetDay - day;
  if (diff < 0) diff += 7;

  const end = addDays(startOfDay(today), diff);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function isValidScheduleItem(item) {
  return Boolean(clean(item?.buque) && clean(item?.etaFecha) && parseDateMX(item.etaFecha));
}

function parseSchedule(text) {
  return BATImport.parseSchedule(text, {
    expectedHeaders: EXPECTED_HEADERS,
    services: KNOWN_SERVICES,
    ports: KNOWN_PORTS,
    validate: isValidScheduleItem
  });
}

function saveSchedule(records) {
  const payload = {
    loadedAt: new Date().toISOString(),
    records
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSchedule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateStatus(payload) {
  if (!payload || !payload.records?.length) {
    processStatus.textContent = 'Sin programación cargada.';
    return;
  }

  const loadedAt = new Date(payload.loadedAt).toLocaleString('es-MX');
  processStatus.textContent = `Programación vigente: ${payload.records.length} registro(s) | Actualizado: ${loadedAt}`;
}

function processSchedule() {
  const text = scheduleInput.value.trim();
  if (!text) {
    alert('Pega primero la programación de próximos buques.');
    return;
  }

  const records = parseSchedule(text);
  if (!records.length) {
    alert('No pude interpretar la programación. Revisa que venga en columnas de Excel, texto tabulado o líneas con fecha y hora.');
    return;
  }

  currentSchedule = records;
  const payload = { loadedAt: new Date().toISOString(), records };
  saveSchedule(records);
  updateStatus(payload);
  alert(`Programación procesada: ${records.length} buque(s).`);
}

function getUpcomingRecords() {
  const { start, end } = getRange(new Date());

  return currentSchedule
    .map(item => ({ ...item, etaDateObject: parseDateMX(item.etaFecha) }))
    .filter(item => item.etaDateObject && item.etaDateObject >= start && item.etaDateObject <= end)
    .sort((a, b) => {
      const dateDiff = a.etaDateObject - b.etaDateObject;
      if (dateDiff !== 0) return dateDiff;
      return formatHour(a.hora).localeCompare(formatHour(b.hora));
    });
}

function abbreviatePort(port) {
  const cleanPort = clean(port);
  if (!cleanPort) return '';

  const normalized = normalize(cleanPort);
  const aliases = {
    'veracruz': 'Ver',
    'altamira': 'Alt',
    'cristobal': 'Cri',
    'cartagena': 'Car',
    'tampico': 'Tam',
    'progreso': 'Pro',
    'manzanillo': 'Man',
    'lazaro cardenas': 'Lzc'
  };

  return aliases[normalized] || cleanPort.slice(0, 3);
}

function buildReport(records, title = 'Próximos Buques', subtitle = '') {
  const lines = [title];

  if (subtitle) {
    lines.push(subtitle);
  }

  lines.push('');

  if (!records.length) {
    lines.push('Sin buques programados para el periodo.');
    return lines.join('\n');
  }

  records.forEach(item => {
    const prevPort = abbreviatePort(item.puertoZarpe);
    const prevText = prevPort ? ` [Prev. ${prevPort}]` : '';
    const hourText = item.hora ? ` ${item.hora}` : '';

    lines.push(`${item.buque} ETA ${item.etaFecha}${hourText}${prevText}`);
  });

  return lines.join('\n');
}

function generateUpcoming() {
  if (!currentSchedule.length) {
    const payload = loadSchedule();
    currentSchedule = payload?.records || [];
    updateStatus(payload);
  }

  if (!currentSchedule.length) {
    alert('Primero procesa o carga una programación.');
    return;
  }

  const records = getUpcomingRecords();
  reportOutput.value = buildReport(records);
}

function getRecordsByDateRange(start, end) {
  const startDate = startOfDay(start);
  const endDate = startOfDay(end);
  endDate.setHours(23, 59, 59, 999);

  return currentSchedule
    .map(item => ({ ...item, etaDateObject: parseDateMX(item.etaFecha) }))
    .filter(item => item.etaDateObject && item.etaDateObject >= startDate && item.etaDateObject <= endDate)
    .sort((a, b) => {
      const dateDiff = a.etaDateObject - b.etaDateObject;
      if (dateDiff !== 0) return dateDiff;
      return formatHour(a.hora).localeCompare(formatHour(b.hora));
    });
}

function generateRangeReport() {
  if (!currentSchedule.length) {
    const payload = loadSchedule();
    currentSchedule = payload?.records || [];
    updateStatus(payload);
  }

  if (!currentSchedule.length) {
    alert('Primero procesa o carga una programación.');
    return;
  }

  const start = parseDateInput(rangeStart?.value);
  const end = parseDateInput(rangeEnd?.value);

  if (!start || !end) {
    alert('Selecciona fecha inicio y fecha fin.');
    return;
  }

  if (start > end) {
    alert('La fecha inicio no puede ser mayor que la fecha fin.');
    return;
  }

  const records = getRecordsByDateRange(start, end);
  const subtitle = `Del ${formatDateMX(start)} al ${formatDateMX(end)}`;
  rangeOutput.value = buildReport(records, 'Buques por rango de fecha', subtitle);
}

async function copyRangeReport() {
  const text = rangeOutput.value.trim();
  if (!text) {
    alert('Primero genera el reporte por rango de fecha.');
    return;
  }

  try {
    await navigator.clipboard.writeText(rangeOutput.value);
    alert('Reporte copiado al portapapeles.');
  } catch {
    rangeOutput.select();
    document.execCommand('copy');
    alert('Reporte copiado al portapapeles.');
  }
}

function setDefaultRangeDates() {
  if (!rangeStart || !rangeEnd) return;

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  if (!rangeStart.value) rangeStart.value = formatDateInput(today);
  if (!rangeEnd.value) rangeEnd.value = formatDateInput(nextWeek);
}

async function copyReport() {
  const text = reportOutput.value.trim();
  if (!text) {
    alert('Primero genera el reporte de próximos buques.');
    return;
  }

  try {
    await navigator.clipboard.writeText(reportOutput.value);
    alert('Reporte copiado al portapapeles.');
  } catch {
    reportOutput.select();
    document.execCommand('copy');
    alert('Reporte copiado al portapapeles.');
  }
}

function clearData() {
  if (!confirm('Esto eliminará la programación vigente de este navegador. ¿Continuamos?')) return;
  localStorage.removeItem(STORAGE_KEY);
  currentSchedule = [];
  scheduleInput.value = '';
  reportOutput.value = '';
  if (rangeOutput) rangeOutput.value = '';
  updateStatus(null);
}

function hydrateFromStorage() {
  const payload = loadSchedule();
  if (payload?.records?.length) {
    currentSchedule = payload.records;
    updateStatus(payload);
  }
}

btnProcess.addEventListener('click', processSchedule);
btnGenerate.addEventListener('click', generateUpcoming);
btnCopy.addEventListener('click', copyReport);
btnClear.addEventListener('click', clearData);
btnGenerateRange.addEventListener('click', generateRangeReport);
btnCopyRange.addEventListener('click', copyRangeReport);
setDefaultRangeDates();
hydrateFromStorage();
