const API_BASE = 'https://bat-api-production.up.railway.app';

const fleetImportFile = document.getElementById('fleetImportFile');
const btnFleetImport = document.getElementById('btnFleetImport');
const vesselDetailSearch = document.getElementById('vesselDetailSearch');
const btnVesselDetailSearch = document.getElementById('btnVesselDetailSearch');
const vesselDetailStatus = document.getElementById('vesselDetailStatus');
const vesselDetailResult = document.getElementById('vesselDetailResult');
const vesselSuggestions = document.getElementById('vesselSuggestions');
const detailVesselName = document.getElementById('detailVesselName');
const detailVesselFlag = document.getElementById('detailVesselFlag');
const detailVesselNationality = document.getElementById('detailVesselNationality');
const detailVesselImo = document.getElementById('detailVesselImo');

let suggestionTimer = null;
let lastSuggestions = [];

function clean(value) { return String(value || '').trim(); }
function apiUrl(path) { return `${API_BASE.replace(/\/$/, '')}${path}`; }
function normalizeVesselName(value) { return clean(value).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }

function pickBestMatch(records, query) {
  if (!records.length) return null;
  const normalizedQuery = normalizeVesselName(query);
  return records.find(record => normalizeVesselName(record.name) === normalizedQuery)
    || records.find(record => normalizeVesselName(record.name).startsWith(normalizedQuery))
    || records[0];
}

function hideSuggestions() {
  if (!vesselSuggestions) return;
  vesselSuggestions.hidden = true;
  vesselSuggestions.innerHTML = '';
}

function renderVesselDetail(vessel) {
  detailVesselName.textContent = vessel?.name || vessel?.official_name || '-';
  detailVesselFlag.textContent = vessel?.flag || '-';
  detailVesselNationality.textContent = vessel?.home_port || '-';
  detailVesselImo.textContent = vessel?.imo || '-';
  vesselDetailResult.hidden = false;
}

function renderSuggestions(records) {
  if (!vesselSuggestions) return;
  lastSuggestions = records;

  if (!records.length) {
    hideSuggestions();
    return;
  }

  vesselSuggestions.innerHTML = records.slice(0, 8).map((record, index) => {
    const name = record.name || record.official_name || 'Sin nombre';
    const imo = record.imo ? `IMO ${record.imo}` : 'IMO no registrado';
    const flag = record.flag || 'Bandera no registrada';
    const homePort = record.home_port || 'Home Port no registrado';
    return `<button type="button" class="bq-suggestion" data-index="${index}"><strong>${name}</strong><small>${imo} | ${flag} | ${homePort}</small></button>`;
  }).join('');

  vesselSuggestions.hidden = false;
}

async function fetchVesselMatches(query) {
  const response = await fetch(apiUrl(`/api/v1/vessels?q=${encodeURIComponent(query)}&limit=10`), { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Error HTTP ${response.status}`);
  return Array.isArray(payload.records) ? payload.records : [];
}

async function updateSuggestions() {
  const query = clean(vesselDetailSearch?.value);
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  try {
    const records = await fetchVesselMatches(query);
    renderSuggestions(records);
  } catch (error) {
    console.warn('No se pudieron cargar sugerencias de buques', error);
    hideSuggestions();
  }
}

async function importFleetFile() {
  const file = fleetImportFile?.files?.[0];
  if (!file) {
    vesselDetailStatus.textContent = 'Selecciona primero el archivo anual de buques.';
    return;
  }

  const form = new FormData();
  form.append('file', file);
  btnFleetImport.disabled = true;
  vesselDetailStatus.textContent = `Importando base anual de buques: ${file.name}...`;

  try {
    const response = await fetch(apiUrl('/api/v1/fleet/import/file'), { method: 'POST', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Error HTTP ${response.status}`);
    vesselDetailStatus.textContent = `Base anual importada | Procesados: ${payload.processed} | Creados: ${payload.created} | Actualizados: ${payload.updated} | Omitidos: ${payload.ignored} | Errores: ${payload.errors}`;
  } catch (error) {
    console.error('Error importando base anual de buques', error);
    vesselDetailStatus.textContent = `Error al importar base anual: ${error.message || error}`;
  } finally {
    btnFleetImport.disabled = false;
  }
}

async function searchVesselDetail() {
  const query = clean(vesselDetailSearch?.value);
  if (!query) {
    vesselDetailStatus.textContent = 'Escribe el nombre del buque para consultar.';
    vesselDetailResult.hidden = true;
    hideSuggestions();
    return;
  }

  btnVesselDetailSearch.disabled = true;
  vesselDetailStatus.textContent = `Consultando detalle de buque: ${query}...`;
  vesselDetailResult.hidden = true;

  try {
    const records = await fetchVesselMatches(query);
    const vessel = pickBestMatch(records, query);
    if (!vessel) {
      vesselDetailStatus.textContent = 'No se encontró el buque en la base central.';
      hideSuggestions();
      return;
    }

    renderVesselDetail(vessel);
    hideSuggestions();
    vesselDetailStatus.textContent = `Buque encontrado en BAT-API. Coincidencias: ${records.length}.`;
  } catch (error) {
    console.error('Error consultando detalle de buque', error);
    vesselDetailStatus.textContent = `Error al consultar BAT-API: ${error.message || error}`;
    vesselDetailResult.hidden = true;
  } finally {
    btnVesselDetailSearch.disabled = false;
  }
}

btnFleetImport?.addEventListener('click', importFleetFile);
btnVesselDetailSearch?.addEventListener('click', searchVesselDetail);

vesselDetailSearch?.addEventListener('input', () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(updateSuggestions, 250);
});

vesselDetailSearch?.addEventListener('keydown', event => {
  if (event.key === 'Enter') searchVesselDetail();
  if (event.key === 'Escape') hideSuggestions();
});

vesselSuggestions?.addEventListener('click', event => {
  const button = event.target.closest('.bq-suggestion');
  if (!button) return;
  const record = lastSuggestions[Number(button.dataset.index)];
  if (!record) return;
  vesselDetailSearch.value = record.name || record.official_name || '';
  renderVesselDetail(record);
  hideSuggestions();
  vesselDetailStatus.textContent = 'Buque seleccionado desde sugerencias.';
});

document.addEventListener('click', event => {
  if (!event.target.closest('.bq-search-wrap')) hideSuggestions();
});
