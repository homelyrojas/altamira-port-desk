const STORAGE_KEY = "bat_prestadores_servicios_v140";

let providersData = [];
let lastResult = "";

const $ = (id) => document.getElementById(id);

async function loadProviders() {
  const local = loadLocalProviders();

  if (local?.length) {
    providersData = local;
  } else {
    const response = await fetch("prestadores.json?v=" + Date.now());
    providersData = await response.json();
    providersData = providersData.map(normalizeProviderRecord);
    saveLocalProviders();
  }

  populateServiceFilter();
  renderMatches();
  renderBank();
}

function saveLocalProviders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providersData));
}

function loadLocalProviders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).map(normalizeProviderRecord) : null;
  } catch {
    return null;
  }
}

function normalize(text) {
  if (window.BATCatalog?.normalize) return window.BATCatalog.normalize(text);
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function safeText(value) {
  return String(value || "").trim();
}

function slugify(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `prestador-${Date.now()}`;
}

function normalizeProviderRecord(item) {
  return {
    id: item.id || slugify(`${item.denominacion || ""}-${item.servicio || ""}-${item.contacto || ""}`),
    denominacion: item.denominacion || item.nombre || "",
    servicio: item.servicio || "",
    alta_msc: normalizeAltaMsc(item.alta_msc || item.altaMSC || ""),
    direccion: item.direccion || "",
    telefono: item.telefono || "",
    contacto: item.contacto || "",
    email: item.email || item.correo || ""
  };
}

function normalizeAltaMsc(value) {
  const text = safeText(value).toUpperCase();
  if (!text || text === "X" || text === "NO" || text === "N/A") return "NO";
  return text;
}

function isAltaMSC(item) {
  const alta = String(item.alta_msc || "").toUpperCase();
  return alta.startsWith("MX");
}

function getMxCode(item) {
  return item.alta_msc || "";
}

function formatProvider(item) {
  const altaTexto = isAltaMSC(item)
    ? `✅ Alta en MSC: ${getMxCode(item)}`
    : `⚪ Alta en MSC: No registrada`;

  return `${item.denominacion || ""}

Servicio: ${item.servicio || ""}
${altaTexto}
Dirección: ${item.direccion || ""}
Teléfono: ${item.telefono || ""}
Contacto: ${item.contacto || ""}
Email: ${item.email || ""}`;
}

function populateServiceFilter() {
  const select = $("serviceFilter");
  if (!select) return;

  const currentValue = select.value || "";
  const servicios = [...new Set(providersData.map(item => item.servicio).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="">Todos los servicios</option>`;

  servicios.forEach(servicio => {
    const option = document.createElement("option");
    option.value = servicio;
    option.textContent = servicio;
    select.appendChild(option);
  });

  if (servicios.includes(currentValue)) select.value = currentValue;
}

function getMatches(query = "") {
  const cleanQuery = normalize((query || $("searchInput")?.value || "").trim());
  const selectedService = $("serviceFilter")?.value || "";
  const onlyMsc = Boolean($("onlyMscCheck")?.checked);

  return providersData.filter(item => {
    const serviceMatch = !selectedService || item.servicio === selectedService;
    const searchable = normalize(Object.values(item).join(" "));
    const textMatch = !cleanQuery || searchable.includes(cleanQuery);
    const mscMatch = !onlyMsc || isAltaMSC(item);
    return serviceMatch && textMatch && mscMatch;
  });
}

function renderResultCounter(matches) {
  const counter = $("resultCounter");
  if (!counter) return;

  const selectedService = $("serviceFilter")?.value || "";
  const query = $("searchInput")?.value || "";
  const onlyMsc = Boolean($("onlyMscCheck")?.checked);

  if (!selectedService && !query.trim() && !onlyMsc) {
    counter.textContent = "Selecciona un servicio o escribe una palabra clave para buscar.";
    return;
  }

  const suffix = onlyMsc ? " con Alta MSC" : "";
  counter.textContent = `${matches.length} prestador(es) encontrado(s)${suffix}.`;
}

function renderMatches() {
  const query = $("searchInput")?.value || "";
  const resultBox = $("resultBox");
  const matchesBox = $("matchesBox");
  const selectedService = $("serviceFilter")?.value || "";
  const onlyMsc = Boolean($("onlyMscCheck")?.checked);
  if (!resultBox || !matchesBox) return;

  const matches = getMatches(query);
  matchesBox.innerHTML = "";
  renderResultCounter(matches);

  if (!query.trim() && !selectedService && !onlyMsc) {
    resultBox.textContent = "Selecciona un servicio o escribe una palabra clave para buscar.";
    lastResult = "";
    return;
  }

  if (!matches.length) {
    resultBox.textContent = "No se encontraron coincidencias.";
    lastResult = "";
    return;
  }

  matches.forEach(item => {
    const card = document.createElement("button");
    card.className = "result-card";

    const altaBadge = isAltaMSC(item)
      ? `<span class="badge-ok">✅ Alta MSC ${getMxCode(item)}</span>`
      : `<span class="badge-neutral">⚪ Sin Alta MSC</span>`;

    card.innerHTML = `
      <strong>${escapeHtml(item.denominacion || "")}</strong>
      <small>${escapeHtml(item.servicio || "")}</small>
      <small>${altaBadge}</small>
      <small>${escapeHtml(item.contacto || "")}</small>
    `;

    card.onclick = () => {
      lastResult = formatProvider(item);
      resultBox.textContent = lastResult;
    };

    matchesBox.appendChild(card);
  });
}

function searchProviders() {
  renderMatches();
}

function clearSearch() {
  $("searchInput").value = "";
  $("serviceFilter").value = "";
  $("onlyMscCheck").checked = false;
  $("matchesBox").innerHTML = "";
  lastResult = "";
  $("resultBox").textContent = "Aquí aparecerá la información del prestador de servicios...";
  renderMatches();
}

async function copyResult() {
  if (!lastResult) return;
  await navigator.clipboard.writeText(lastResult);
  alert("Información copiada.");
}

function showTab(tab) {
  $("consultaView").classList.toggle("hidden", tab !== "consulta");
  $("registrosView").classList.toggle("hidden", tab !== "registros");

  $("tabConsulta").classList.toggle("active", tab === "consulta");
  $("tabRegistros").classList.toggle("active", tab === "registros");
}

function showRegistrySection(section) {
  $("registryFormSection").classList.toggle("hidden", section !== "form");
  $("registryBankSection").classList.toggle("hidden", section !== "bank");
  $("registryJsonSection").classList.toggle("hidden", section !== "json");

  $("registryTabForm").classList.toggle("active", section === "form");
  $("registryTabBank").classList.toggle("active", section === "bank");
  $("registryTabJson").classList.toggle("active", section === "json");

  if (section === "bank") renderBank();
  if (section === "json") renderJsonBox();
}

function getFormData() {
  return normalizeProviderRecord({
    id: $("recordId").value || "",
    denominacion: safeText($("formDenominacion").value),
    servicio: safeText($("formServicio").value),
    alta_msc: safeText($("formAltaMsc").value),
    direccion: safeText($("formDireccion").value),
    telefono: safeText($("formTelefono").value),
    contacto: safeText($("formContacto").value),
    email: safeText($("formEmail").value)
  });
}

function saveRecord() {
  const record = getFormData();

  if (!record.denominacion || !record.servicio) {
    alert("Registra al menos Denominación y Servicio.");
    return;
  }

  const existingIndex = providersData.findIndex(item => item.id === record.id);

  if (existingIndex >= 0) {
    providersData[existingIndex] = record;
  } else {
    record.id = record.id || slugify(`${record.denominacion}-${record.servicio}-${Date.now()}`);
    providersData.unshift(record);
  }

  saveLocalProviders();
  populateServiceFilter();
  renderMatches();
  renderBank();
  resetForm();

  alert("Prestador guardado.");
}

function resetForm() {
  $("recordId").value = "";
  $("formDenominacion").value = "";
  $("formServicio").value = "";
  $("formAltaMsc").value = "";
  $("formDireccion").value = "";
  $("formTelefono").value = "";
  $("formContacto").value = "";
  $("formEmail").value = "";
}

function editRecord(id) {
  const item = providersData.find(record => record.id === id);
  if (!item) return;

  showTab("registros");
  showRegistrySection("form");

  $("recordId").value = item.id || "";
  $("formDenominacion").value = item.denominacion || "";
  $("formServicio").value = item.servicio || "";
  $("formAltaMsc").value = item.alta_msc || "";
  $("formDireccion").value = item.direccion || "";
  $("formTelefono").value = item.telefono || "";
  $("formContacto").value = item.contacto || "";
  $("formEmail").value = item.email || "";
}

function deleteRecord(id) {
  const item = providersData.find(record => record.id === id);
  if (!item) return;

  if (!confirm(`¿Eliminar ${item.denominacion}?`)) return;

  providersData = providersData.filter(record => record.id !== id);
  saveLocalProviders();
  populateServiceFilter();
  renderMatches();
  renderBank();
}

function renderBank() {
  const bankBox = $("bankBox");
  if (!bankBox) return;

  if (!providersData.length) {
    bankBox.innerHTML = `<p class="muted">No hay prestadores registrados.</p>`;
    return;
  }

  bankBox.innerHTML = providersData.map(item => `
    <article class="bank-card">
      <strong>${escapeHtml(item.denominacion || "")}</strong>
      <small>${escapeHtml(item.servicio || "")}</small>
      <small>${isAltaMSC(item) ? `✅ Alta MSC ${escapeHtml(getMxCode(item))}` : "⚪ Sin Alta MSC"}</small>
      <small>${escapeHtml(item.contacto || "")}</small>
      <div class="bank-actions">
        <button onclick="editRecord('${escapeHtml(item.id)}')">Editar</button>
        <button class="danger" onclick="deleteRecord('${escapeHtml(item.id)}')">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function getExportJson() {
  return JSON.stringify(providersData.map(normalizeProviderRecord), null, 2);
}

function renderJsonBox() {
  const box = $("jsonBox");
  if (box) box.textContent = getExportJson();
}

function downloadProvidersJson() {
  const blob = new Blob([getExportJson()], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prestadores.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyProvidersJson() {
  await navigator.clipboard.writeText(getExportJson());
  renderJsonBox();
  alert("JSON copiado.");
}

function importProvidersJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!Array.isArray(data)) {
        alert("El archivo debe contener un arreglo JSON.");
        return;
      }

      providersData = data.map(normalizeProviderRecord);
      saveLocalProviders();
      populateServiceFilter();
      renderMatches();
      renderBank();
      renderJsonBox();

      alert("Prestadores importados correctamente.");
    } catch (error) {
      console.error(error);
      alert("No se pudo importar el JSON.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file, "utf-8");
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[c]));
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProviders();

  $("searchInput")?.addEventListener("input", renderMatches);
  $("serviceFilter")?.addEventListener("change", renderMatches);
  $("onlyMscCheck")?.addEventListener("change", renderMatches);
  $("importJsonFile")?.addEventListener("change", importProvidersJson);
});
