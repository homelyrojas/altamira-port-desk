const API_BASE = 'https://bat-api-production.up.railway.app';

const fleetImportFile = document.getElementById('fleetImportFile');
const btnFleetImport = document.getElementById('btnFleetImport');
const vesselDetailSearch = document.getElementById('vesselDetailSearch');
const btnVesselDetailSearch = document.getElementById('btnVesselDetailSearch');
const vesselDetailStatus = document.getElementById('vesselDetailStatus');
const vesselDetailResult = document.getElementById('vesselDetailResult');
const detailVesselName = document.getElementById('detailVesselName');
const detailVesselFlag = document.getElementById('detailVesselFlag');
const detailVesselNationality = document.getElementById('detailVesselNationality');
const detailVesselImo = document.getElementById('detailVesselImo');

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

function renderVesselDetail(vessel) {
  const flag = vessel?.flag || '-';
  detailVesselName.textContent = vessel?.name || vessel?.official_name || '-';
  detailVesselFlag.textContent = flag;
  detailVesselNationality.textContent = flag;
  detailVesselImo.textContent = vessel?.imo || '-';
  vesselDetailResult.hidden = false;
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
    return;
  }

  btnVesselDetailSearch.disabled = true;
  vesselDetailStatus.textContent = `Consultando detalle de buque: ${query}...`;
  vesselDetailResult.hidden = true;

  try {
    const response = await fetch(apiUrl(`/api/v1/vessels?q=${encodeURIComponent(query)}&limit=20`), { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Error HTTP ${response.status}`);

    const records = Array.isArray(payload.records) ? payload.records : [];
    const vessel = pickBestMatch(records, query);
    if (!vessel) {
      vesselDetailStatus.textContent = 'No se encontró el buque en la base central.';
      return;
    }

    renderVesselDetail(vessel);
    vesselDetailStatus.textContent = `Buque encontrado en BAT-API. Coincidencias: ${payload.total ?? records.length}.`;
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
vesselDetailSearch?.addEventListener('keydown', event => { if (event.key === 'Enter') searchVesselDetail(); });
