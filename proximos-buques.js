const STORAGE_KEY = 'bat_proximos_buques_v070_current';

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

function clean(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function parseDateMX(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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

function formatHour(value) {
  const text = clean(value);
  if (!text) return '';

  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;

  return text;
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
  const day = today.getDay(); // 0 domingo, 1 lunes...
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

function isHeaderRow(values) {
  const joined = values.map(normalize).join('|');
  return EXPECTED_HEADERS.some(header => joined.includes(header));
}

function parseTabular(text) {
  const rows = text
    .split('\n')
    .map(line => line.replace(/\r/g, ''))
    .filter(line => line.trim())
    .map(line => line.split('\t').map(clean));

  if (!rows.some(row => row.length >= 5)) return [];

  const dataRows = rows.filter(row => !isHeaderRow(row) && row.length >= 5);

  return dataRows.map(row => ({
    buque: row[0] || '',
    service: row[1] || '',
    etaFecha: row[2] || '',
    hora: formatHour(row[3] || ''),
    puertoArribo: row[4] || '',
    puertoZarpe: row[5] || '',
    notas: row[6] || ''
  })).filter(item => item.buque && item.etaFecha);
}

function parseLineBlocks(text) {
  let lines = text.split('\n').map(line => line.replace(/\r/g, '').trim());

  // Si el usuario pegó encabezados línea por línea, se eliminan los primeros 7.
  const firstSeven = lines.slice(0, 7).map(normalize);
  const hasHeaders = EXPECTED_HEADERS.every((header, index) => firstSeven[index] === header);
  if (hasHeaders) lines = lines.slice(7);

  // Conservamos líneas vacías porque Notas puede venir en blanco.
  const records = [];
  for (let i = 0; i < lines.length; i += 7) {
    const chunk = lines.slice(i, i + 7);
    if (chunk.length < 5) continue;

    const [buque, service, etaFecha, hora, puertoArribo, puertoZarpe, notas] = chunk;
    if (!clean(buque) || !clean(etaFecha)) continue;

    records.push({
      buque: clean(buque),
      service: clean(service),
      etaFecha: clean(etaFecha),
      hora: formatHour(hora),
      puertoArribo: clean(puertoArribo),
      puertoZarpe: clean(puertoZarpe),
      notas: clean(notas)
    });
  }

  return records;
}

function parseSchedule(text) {
  const tabular = parseTabular(text);
  if (tabular.length) return tabular;
  return parseLineBlocks(text);
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
    alert('No pude interpretar la programación. Revisa que venga en columnas de Excel o en bloques de 7 campos.');
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
