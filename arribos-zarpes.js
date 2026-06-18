const STORAGE_KEY = 'bat_arribos_zarpes_v060_current';
const HEADER_ROW_INDEX = 3; // Excel row 4, zero-based.
let currentRows = [];
let selectedRecord = null;

const excelFile = document.getElementById('excelFile');
const btnLoad = document.getElementById('btnLoad');
const btnClear = document.getElementById('btnClear');
const btnCopy = document.getElementById('btnCopy');
const loadStatus = document.getElementById('loadStatus');
const searchBox = document.getElementById('searchBox');
const results = document.getElementById('results');
const reportBox = document.getElementById('reportBox');

const REPORT_FIELDS = [
  { header: 'F.CRUCE LIMITE DE PUERTO', occurrence: 1, label: 'F.CRUCE LIMITE DE PUERTO' },
  { header: 'F.PILOTO ABORDO AL ARRIBO', occurrence: 1, label: 'F.PILOTO ABORDO AL ARRIBO' },
  { header: 'F.CRUCE DE ESCOLLERAS', occurrence: 1, label: 'F.CRUCE DE ESCOLLERAS' },
  { header: 'F.TOTALMENTE ATRACADO', occurrence: 1, label: 'F.TOTALMENTE ATRACADO', tramo: true },
  { header: 'F.INICIO OPERACIONES', occurrence: 1, label: 'F.INICIO OPERACIONES' },
  { header: 'F.TERMINO DE OPERACIONES', occurrence: 1, label: 'F.TERMINO DE OPERACIONES' },
  { header: 'F. PILOTO ABORDO AL ZARPE', occurrence: 1, label: 'F. PILOTO ABORDO AL ZARPE' },
  { header: 'F.LIBRE DE CABOS', occurrence: 1, label: 'F.LIBRE DE CABOS [DESATRAQUE]' },
  { header: 'F.CRUCE ESCOLLERAS', occurrence: 1, label: 'F.CRUCE ESCOLLERAS' },
  { header: 'F. DESEMBARQUE DE PILOTO', occurrence: 1, label: 'F. DESEMBARQUE DE PILOTO' },
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toUpperCase()
    .trim();
}

function clean(value) {
  const text = String(value ?? '').trim();
  return text === ' ' ? '' : text;
}

function findColumn(headers, headerName, occurrence = 1) {
  const target = normalizeText(headerName);
  let count = 0;
  for (let i = 0; i < headers.length; i += 1) {
    if (normalizeText(headers[i]) === target) {
      count += 1;
      if (count === occurrence) return i;
    }
  }
  return -1;
}

function readCell(record, headerName, occurrence = 1) {
  const index = findColumn(record.headers, headerName, occurrence);
  if (index < 0) return '';
  return clean(record.row[index]);
}

function buildRecord(headers, row) {
  return {
    headers,
    row,
    folio: readByIndex(headers, row, 'FOLIO'),
    buque: readByIndex(headers, row, 'BUQUE'),
    viaje: readByIndex(headers, row, 'N. DE VIAJE'),
    imo: readByIndex(headers, row, 'IMO'),
    tramo: readByIndex(headers, row, 'TRAMO'),
  };
}

function readByIndex(headers, row, headerName, occurrence = 1) {
  const index = findColumn(headers, headerName, occurrence);
  return index >= 0 ? clean(row[index]) : '';
}

function saveCurrentData(rows, fileName) {
  const payload = {
    fileName,
    loadedAt: new Date().toISOString(),
    rows,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadCurrentData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateStatus(payload) {
  if (!payload || !payload.rows?.length) {
    loadStatus.textContent = 'Sin archivo cargado.';
    return;
  }
  const date = new Date(payload.loadedAt).toLocaleString('es-MX');
  loadStatus.textContent = `Base vigente: ${payload.fileName} | Registros: ${payload.rows.length} | Actualizado: ${date}`;
}

function hydrateFromStorage() {
  const payload = loadCurrentData();
  if (payload?.rows?.length) {
    currentRows = payload.rows;
    updateStatus(payload);
  }
}

async function importExcel() {
  const file = excelFile.files?.[0];
  if (!file) {
    alert('Selecciona primero el archivo Excel.');
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const headers = (matrix[HEADER_ROW_INDEX] || []).map(clean);
  const folioIdx = findColumn(headers, 'FOLIO');
  const buqueIdx = findColumn(headers, 'BUQUE');

  if (folioIdx < 0 || buqueIdx < 0) {
    alert('No encontré las columnas FOLIO y BUQUE en la fila 4. Revisa el layout del archivo.');
    return;
  }

  const records = [];
  for (let i = HEADER_ROW_INDEX + 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const folio = clean(row[folioIdx]);
    const buque = clean(row[buqueIdx]);
    if (!folio || !buque) continue;
    records.push(buildRecord(headers, row));
  }

  // Sin histórico: se reemplaza completamente la base vigente.
  currentRows = records;
  const payload = { fileName: file.name, loadedAt: new Date().toISOString(), rows: records };
  saveCurrentData(records, file.name);
  updateStatus(payload);
  results.innerHTML = '';
  reportBox.value = '';
  alert(`Información actualizada. Registros cargados: ${records.length}`);
}

function searchRecords() {
  const q = normalizeText(searchBox.value);
  results.innerHTML = '';
  if (!q || !currentRows.length) return;

  const matches = currentRows.filter((r) => {
    const haystack = normalizeText(`${r.buque} ${r.viaje} ${r.imo} ${r.folio}`);
    return haystack.includes(q);
  }).slice(0, 30);

  if (!matches.length) {
    results.innerHTML = '<div class="az-status">Sin coincidencias.</div>';
    return;
  }

  for (const record of matches) {
    const item = document.createElement('div');
    item.className = 'az-result';
    item.innerHTML = `
      <strong>${record.buque} ${record.viaje || ''}</strong>
      <span>Folio: ${record.folio || '-'} | IMO: ${record.imo || '-'} | Tramo: ${record.tramo || '-'}</span>
    `;
    item.addEventListener('click', () => {
      selectedRecord = record;
      reportBox.value = buildReport(record);
    });
    results.appendChild(item);
  }
}

function buildReport(record) {
  const title = `Información de Arribo / Salida del buque ${record.buque}${record.viaje ? ' ' + record.viaje : ''}`;
  const lines = [title, ''];

  for (const field of REPORT_FIELDS) {
    const value = readCell(record, field.header, field.occurrence);

    let line = value
      ? `${value} ${field.label}`
      : `PENDIENTE ......... ${field.label}`;

    if (field.tramo && record.tramo) {
      line += ` [${record.tramo}]`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

async function copyReport() {
  const text = reportBox.value.trim();
  if (!text) {
    alert('Primero genera un reporte.');
    return;
  }
  try {
    await navigator.clipboard.writeText(reportBox.value);
    alert('Reporte copiado al portapapeles.');
  } catch {
    reportBox.select();
    document.execCommand('copy');
    alert('Reporte copiado al portapapeles.');
  }
}

function clearData() {
  if (!confirm('Esto eliminará la base vigente de este navegador. ¿Continuamos?')) return;
  localStorage.removeItem(STORAGE_KEY);
  currentRows = [];
  selectedRecord = null;
  searchBox.value = '';
  results.innerHTML = '';
  reportBox.value = '';
  updateStatus(null);
}

btnLoad.addEventListener('click', importExcel);
btnClear.addEventListener('click', clearData);
btnCopy.addEventListener('click', copyReport);
searchBox.addEventListener('input', searchRecords);
hydrateFromStorage();
