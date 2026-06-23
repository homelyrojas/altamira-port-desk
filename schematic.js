const STORAGE_KEY = 'bat_schematic_v093_current';

let currentSchematic = [];

const schematicFile = document.getElementById('schematicFile');
const schematicInput = document.getElementById('schematicInput');
const reportOutput = document.getElementById('reportOutput');
const rangeOutput = document.getElementById('rangeOutput');
const processStatus = document.getElementById('processStatus');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');

const btnProcessFile = document.getElementById('btnProcessFile');
const btnProcessText = document.getElementById('btnProcessText');
const btnGenerate = document.getElementById('btnGenerate');
const btnGenerateMsc = document.getElementById('btnGenerateMsc');
const btnCopy = document.getElementById('btnCopy');
const btnRange = document.getElementById('btnRange');
const btnRangeMsc = document.getElementById('btnRangeMsc');
const btnCopyRange = document.getElementById('btnCopyRange');
const btnClear = document.getElementById('btnClear');

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

function abbreviateTerminal(value) {
  const text = clean(value);
  if (!text) return '';

  const normalized = normalize(text)
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases = {
    'altamira terminal portuaria sa de cv': 'ATP',
    'altamira terminal portuaria s a de c v': 'ATP',
    'infraestructura portuaria mexicana sa de cv': 'IPM',
    'infraestructura portuaria mexicana s a de c v': 'IPM'
  };

  return aliases[normalized] || text;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function excelSerialToDate(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.round(86400 * fractionalDay);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, 0, 0);
}

function parseDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') return excelSerialToDate(value);

  const text = clean(value);
  if (!text) return null;

  if (/^\d+(\.\d+)?$/.test(text)) return excelSerialToDate(Number(text));

  let match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const date = new Date(year, month, day, hour, minute, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{1,2}):(\d{2})(?:\s+(\d{4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const monthName = normalize(match[2]).slice(0, 3);
    const months = {
      jan: 0, ene: 0,
      feb: 1,
      mar: 2,
      apr: 3, abr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7, ago: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11, dic: 11
    };
    const month = months[monthName];
    const hour = Number(match[3]);
    const minute = Number(match[4]);
    const year = Number(match[5] || new Date().getFullYear());
    if (month === undefined) return null;
    const date = new Date(year, month, day, hour, minute, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimeMX(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatShortScheduleDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad2(date.getDate())} ${monthNames[date.getMonth()]} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateMX(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  const copy = startOfDay(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getOperationalRange(today = new Date()) {
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

function saveSchematic(records) {
  const payload = {
    loadedAt: new Date().toISOString(),
    records
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSchematic() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateStatus(payload) {
  if (!payload || !payload.records?.length) {
    processStatus.textContent = 'Sin schematic cargado.';
    return;
  }

  const loadedAt = new Date(payload.loadedAt).toLocaleString('es-MX');
  processStatus.textContent = `Schematic vigente: ${payload.records.length} registro(s) | Actualizado: ${loadedAt}`;
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = rows[i].map(normalize);
    const hasVessel = normalized.includes('vessel');
    const hasTerminal = normalized.includes('terminal');
    const hasEtb = normalized.includes('etb');
    const hasEtd = normalized.includes('etd');
    if (hasVessel && hasTerminal && hasEtb && hasEtd) return i;
  }
  return -1;
}

function indexOfHeader(headers, candidates) {
  const normalized = headers.map(normalize);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalize(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function recordFromRow(row, index) {
  const get = key => index[key] >= 0 ? clean(row[index[key]]) : '';

  const etbRaw = index.etb >= 0 ? row[index.etb] : '';
  const etdRaw = index.etd >= 0 ? row[index.etd] : '';
  const etbDate = parseDateTime(etbRaw);
  const etdDate = parseDateTime(etdRaw);

  return {
    terminal: get('terminal'),
    vessel: get('vessel'),
    voyageImp: get('voyageImp'),
    voyageExp: get('voyageExp'),
    service: get('service'),
    prev: get('prev'),
    next: get('next'),
    etb: etbDate ? formatDateTimeMX(etbDate) : clean(etbRaw),
    etd: etdDate ? formatDateTimeMX(etdDate) : clean(etdRaw),
    etbDisplay: etbDate ? formatShortScheduleDate(etbDate) : clean(etbRaw),
    etdDisplay: etdDate ? formatShortScheduleDate(etdDate) : clean(etdRaw),
    etbIso: etbDate ? etbDate.toISOString() : '',
    etdIso: etdDate ? etdDate.toISOString() : ''
  };
}

function parseRows(rows) {
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(clean);
  const index = {
    terminal: indexOfHeader(headers, ['terminal']),
    vessel: indexOfHeader(headers, ['vessel']),
    voyageImp: indexOfHeader(headers, ['imp']),
    voyageExp: indexOfHeader(headers, ['exp']),
    service: indexOfHeader(headers, ['service']),
    prev: indexOfHeader(headers, ['prev']),
    next: indexOfHeader(headers, ['next']),
    etb: indexOfHeader(headers, ['etb']),
    etd: indexOfHeader(headers, ['etd'])
  };

  const records = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const item = recordFromRow(row, index);
    const statusText = normalize(row.join(' '));

    if (!item.vessel || !item.terminal || !item.etb) continue;
    if (statusText.includes('live schedule terminal')) continue;
    if (normalize(item.vessel) === 'vessel') continue;

    records.push(item);
  }

  return records;
}

function parseText(text) {
  const rows = text
    .split('\n')
    .map(line => line.replace(/\r/g, ''))
    .filter(line => line.trim())
    .map(line => line.includes('\t') ? line.split('\t').map(clean) : line.split(/\s{2,}/).map(clean));

  return parseRows(rows);
}

async function processFile() {
  const file = schematicFile.files?.[0];
  if (!file) {
    alert('Selecciona primero el archivo Excel del schematic.');
    return;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames.includes('Linear') ? 'Linear' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const records = parseRows(rows);

  if (!records.length) {
    alert('No pude interpretar el schematic. Revisa que el archivo tenga columnas Vessel, Imp, Prev, Next, ETB, ETD y Terminal.');
    return;
  }

  currentSchematic = records;
  const payload = { loadedAt: new Date().toISOString(), records };
  saveSchematic(records);
  updateStatus(payload);
  alert(`Schematic procesado: ${records.length} buque(s).`);
}

function processText() {
  const text = schematicInput.value.trim();
  if (!text) {
    alert('Pega primero el contenido del schematic.');
    return;
  }

  const records = parseText(text);
  if (!records.length) {
    alert('No pude interpretar el texto pegado. Intenta pegarlo desde Excel con columnas visibles.');
    return;
  }

  currentSchematic = records;
  const payload = { loadedAt: new Date().toISOString(), records };
  saveSchematic(records);
  updateStatus(payload);
  alert(`Schematic procesado: ${records.length} buque(s).`);
}

function ensureLoaded() {
  if (!currentSchematic.length) {
    const payload = loadSchematic();
    currentSchematic = payload?.records || [];
    updateStatus(payload);
  }
  return currentSchematic.length > 0;
}

function getRecordsBetween(start, end) {
  return currentSchematic
    .map(item => ({ ...item, etbDateObject: item.etbIso ? new Date(item.etbIso) : parseDateTime(item.etb) }))
    .filter(item => item.etbDateObject && item.etbDateObject >= start && item.etbDateObject <= end)
    .sort((a, b) => a.etbDateObject - b.etbDateObject);
}

function hasImpVoyage(item) {
  return Boolean(clean(item?.voyageImp));
}

function filterMsc(records) {
  return records.filter(hasImpVoyage);
}

function buildReport(records, title = 'Schematic') {
  const lines = [title, ''];

  if (!records.length) {
    lines.push('Sin buques programados para el periodo.');
    return lines.join('\n');
  }

  records.forEach(item => {
    const vessel = item.vessel || '';
    const imp = item.voyageImp ? ` ${item.voyageImp}` : '';
    const prev = item.prev ? ` Prev: ${item.prev}` : '';
    const next = item.next ? ` Next: ${item.next}` : '';
    const etb = item.etbDisplay || item.etb || '';
    const etd = item.etdDisplay || item.etd || '';
    const etbText = etb ? ` ETB: ${etb}` : '';
    const etdText = etd ? ` ETD: ${etd}` : '';
    const terminal = abbreviateTerminal(item.terminal || '');
    const terminalText = terminal ? ` - ${terminal}` : '';

    lines.push(`${vessel}${imp}${prev}${next}${etbText}${etdText}${terminalText}`);
  });

  return lines.join('\n');
}

function generateOperationalBlock(onlyMsc = false) {
  if (!ensureLoaded()) {
    alert('Primero procesa o carga un schematic.');
    return;
  }

  const { start, end } = getOperationalRange(new Date());
  const records = getRecordsBetween(start, end);
  const outputRecords = onlyMsc ? filterMsc(records) : records;
  const suffix = onlyMsc ? ' - Solo MSC' : '';
  reportOutput.value = buildReport(outputRecords, `Schematic - Bloque operativo${suffix} ${formatDateMX(start)} al ${formatDateMX(end)}`);
}

function getDateInputValue(input) {
  if (!input.value) return null;
  const [year, month, day] = input.value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function generateRangeReport(onlyMsc = false) {
  if (!ensureLoaded()) {
    alert('Primero procesa o carga un schematic.');
    return;
  }

  const start = getDateInputValue(rangeStart);
  const rawEnd = getDateInputValue(rangeEnd);

  if (!start || !rawEnd) {
    alert('Selecciona fecha inicio y fecha fin.');
    return;
  }

  if (rawEnd < start) {
    alert('La fecha fin no puede ser menor a la fecha inicio.');
    return;
  }

  const end = endOfDay(rawEnd);
  const records = getRecordsBetween(startOfDay(start), end);
  const outputRecords = onlyMsc ? filterMsc(records) : records;
  const suffix = onlyMsc ? ' - Solo MSC' : '';
  rangeOutput.value = buildReport(outputRecords, `Schematic - Rango${suffix} ${formatDateMX(start)} al ${formatDateMX(rawEnd)}`);
}

async function copyTextFrom(textarea, emptyMessage) {
  const text = textarea.value.trim();
  if (!text) {
    alert(emptyMessage);
    return;
  }

  try {
    await navigator.clipboard.writeText(textarea.value);
    alert('Reporte copiado al portapapeles.');
  } catch {
    textarea.select();
    document.execCommand('copy');
    alert('Reporte copiado al portapapeles.');
  }
}

function clearData() {
  if (!confirm('Esto eliminará el schematic vigente de este navegador. ¿Continuamos?')) return;
  localStorage.removeItem(STORAGE_KEY);
  currentSchematic = [];
  schematicInput.value = '';
  schematicFile.value = '';
  reportOutput.value = '';
  rangeOutput.value = '';
  updateStatus(null);
}

function hydrateFromStorage() {
  const payload = loadSchematic();
  if (payload?.records?.length) {
    currentSchematic = payload.records;
    updateStatus(payload);
  }
}

btnProcessFile.addEventListener('click', processFile);
btnProcessText.addEventListener('click', processText);
btnGenerate.addEventListener('click', () => generateOperationalBlock(false));
btnGenerateMsc.addEventListener('click', () => generateOperationalBlock(true));
btnCopy.addEventListener('click', () => copyTextFrom(reportOutput, 'Primero genera el bloque operativo.'));
btnRange.addEventListener('click', () => generateRangeReport(false));
btnRangeMsc.addEventListener('click', () => generateRangeReport(true));
btnCopyRange.addEventListener('click', () => copyTextFrom(rangeOutput, 'Primero genera la consulta por rango.'));
btnClear.addEventListener('click', clearData);
hydrateFromStorage();