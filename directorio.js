const API_BASE = localStorage.getItem("BAT_API_BASE_URL") || "http://127.0.0.1:8000";

let directoryData = [];
let lastResult = "";

const $ = (id) => document.getElementById(id);

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error("No se pudo consultar BAT-API");
  return response.json();
}

async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("No se pudo enviar información a BAT-API");
  return response.json();
}

async function apiPatch(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("No se pudo actualizar información en BAT-API");
  return response.json();
}

async function apiDelete(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!response.ok) throw new Error("No se pudo eliminar información en BAT-API");
  return response.json();
}

async function loadDirectory() {
  try {
    const data = await apiGet("/api/v1/directory");
    directoryData = data.records || [];
  } catch {
    directoryData = [];
    alert("Sin conexión con BAT-API. Enciende el backend para consultar el Directorio.");
  }

  populateDependencyFilter();
  renderMatches();
  renderBank();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function safeText(value) {
  return String(value || "").trim();
}

function formatContact(item) {
  return `${item.dependencia || ""}

Categoría: ${item.categoria || ""}
Encargado: ${item.encargado || ""}
Cargo: ${item.cargo || ""}
Teléfono: ${item.telefono || ""}
Correo: ${item.correo || ""}
Notas: ${item.notas || ""}`;
}

function populateDependencyFilter() {
  const select = $("dependencyFilter");
  if (!select) return;

  const currentValue = select.value || "";
  const dependencies = [...new Set(directoryData.map(item => item.dependencia).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="">Todas las dependencias</option>`;

  dependencies.forEach(dep => {
    const option = document.createElement("option");
    option.value = dep;
    option.textContent = dep;
    select.appendChild(option);
  });

  if (dependencies.includes(currentValue)) select.value = currentValue;
}

function getMatches() {
  const query = normalize($("searchInput")?.value || "");
  const selectedDependency = $("dependencyFilter")?.value || "";

  return directoryData.filter(item => {
    const dependencyMatch = !selectedDependency || item.dependencia === selectedDependency;
    const searchable = normalize(Object.values(item).join(" "));
    const textMatch = !query || searchable.includes(query);
    return dependencyMatch && textMatch;
  });
}

function renderMatches() {
  const resultBox = $("resultBox");
  const matchesBox = $("matchesBox");
  if (!resultBox || !matchesBox) return;

  const query = $("searchInput")?.value || "";
  const selectedDependency = $("dependencyFilter")?.value || "";
  const matches = getMatches();

  matchesBox.innerHTML = "";

  if (!query.trim() && !selectedDependency) {
    resultBox.textContent = "Selecciona una dependencia o escribe una palabra clave para buscar.";
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
    card.innerHTML = `
      <span class="badge">${item.categoria || "Sin categoría"}</span>
      <strong>${item.dependencia || ""}</strong>
      <small>${item.encargado || "Sin encargado"}</small>
      <small>${item.cargo || ""}</small>
    `;

    card.onclick = () => {
      lastResult = formatContact(item);
      resultBox.textContent = lastResult;
    };

    matchesBox.appendChild(card);
  });
}

function searchDirectory() {
  renderMatches();
}

function clearSearch() {
  $("searchInput").value = "";
  $("dependencyFilter").value = "";
  $("matchesBox").innerHTML = "";
  lastResult = "";
  $("resultBox").textContent = "Aquí aparecerá la información del directorio...";
}

async function copyResult() {
  if (!lastResult) return;
  await navigator.clipboard.writeText(lastResult);
  alert("Información copiada.");
}

function showTab(tab) {
  const consulta = $("consultaView");
  const registros = $("registrosView");
  const tabConsulta = $("tabConsulta");
  const tabRegistros = $("tabRegistros");

  if (tab === "registros") {
    consulta.classList.add("hidden");
    registros.classList.remove("hidden");
    tabConsulta.classList.remove("active");
    tabRegistros.classList.add("active");
    showRegistrySection("form");
  } else {
    registros.classList.add("hidden");
    consulta.classList.remove("hidden");
    tabRegistros.classList.remove("active");
    tabConsulta.classList.add("active");
    renderMatches();
  }
}

function showRegistrySection(section) {
  const sections = {
    form: $("registryFormSection"),
    bank: $("registryBankSection"),
    json: $("registryJsonSection")
  };

  const tabs = {
    form: $("registryTabForm"),
    bank: $("registryTabBank"),
    json: $("registryTabJson")
  };

  Object.values(sections).forEach(item => item?.classList.add("hidden"));
  Object.values(tabs).forEach(item => item?.classList.remove("active"));

  const selectedSection = sections[section] || sections.form;
  const selectedTab = tabs[section] || tabs.form;

  selectedSection?.classList.remove("hidden");
  selectedTab?.classList.add("active");

  if (section === "bank") renderBank();
  if (section === "json") renderJsonBox();
}

function getFormRecord() {
  return {
    dependencia: safeText($("formDependencia").value),
    categoria: safeText($("formCategoria").value),
    encargado: safeText($("formEncargado").value),
    cargo: safeText($("formCargo").value),
    telefono: safeText($("formTelefono").value),
    correo: safeText($("formCorreo").value),
    notas: safeText($("formNotas").value)
  };
}

function validateRecord(record) {
  if (!record.dependencia) return "Captura la dependencia.";
  if (!record.categoria) return "Captura la categoría.";
  return "";
}

async function saveRecord() {
  const record = getFormRecord();
  const error = validateRecord(record);

  if (error) {
    alert(error);
    return;
  }

  const id = safeText($("recordId").value);

  try {
    if (id) {
      await apiPatch(`/api/v1/directory/${id}`, record);
    } else {
      await apiPost("/api/v1/directory", record);
    }

    resetForm();
    await loadDirectory();
    alert("Registro guardado en PostgreSQL.");
  } catch (error) {
    alert(error.message);
  }
}

function editRecord(id) {
  const item = directoryData.find(record => record.id === id);
  if (!item) return;

  $("recordId").value = item.id || "";
  $("formDependencia").value = item.dependencia || "";
  $("formCategoria").value = item.categoria || "";
  $("formEncargado").value = item.encargado || "";
  $("formCargo").value = item.cargo || "";
  $("formTelefono").value = item.telefono || "";
  $("formCorreo").value = item.correo || "";
  $("formNotas").value = item.notas || "";

  showRegistrySection("form");
  $("registrosView")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteRecord(id) {
  const item = directoryData.find(record => record.id === id);
  if (!item) return;

  if (!confirm(`¿Eliminar ${item.dependencia}?`)) return;

  try {
    await apiDelete(`/api/v1/directory/${id}`);
    await loadDirectory();
  } catch (error) {
    alert(error.message);
  }
}

function resetForm() {
  $("recordId").value = "";
  $("formDependencia").value = "";
  $("formCategoria").value = "";
  $("formEncargado").value = "";
  $("formCargo").value = "";
  $("formTelefono").value = "";
  $("formCorreo").value = "";
  $("formNotas").value = "";
}

function renderBank() {
  const bankBox = $("bankBox");
  if (!bankBox) return;

  bankBox.innerHTML = "";

  if (!directoryData.length) {
    bankBox.innerHTML = `<p class="muted">No hay registros disponibles en PostgreSQL.</p>`;
    return;
  }

  directoryData.forEach(item => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <span class="badge">${item.categoria || "Sin categoría"}</span>
      <strong>${item.dependencia || ""}</strong>
      <small>${item.encargado || "Sin encargado"}</small>
      <small>${item.cargo || ""}</small>
      <div class="actions-row" style="margin-top:12px">
        <button type="button" onclick="editRecord('${item.id}')">Editar</button>
        <button type="button" class="secondary" onclick="deleteRecord('${item.id}')">Eliminar</button>
      </div>
    `;
    bankBox.appendChild(card);
  });
}

function getExportJson() {
  return JSON.stringify(directoryData, null, 2);
}

function renderJsonBox() {
  $("jsonBox").textContent = getExportJson();
}

function downloadDirectoryJson() {
  const blob = new Blob([getExportJson()], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "directory.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  renderJsonBox();
}

async function copyDirectoryJson() {
  const json = getExportJson();
  await navigator.clipboard.writeText(json);
  $("jsonBox").textContent = json;
  alert("JSON copiado.");
}

function importDirectoryJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("El JSON debe ser una lista.");

      const records = imported.map(item => ({
        dependencia: safeText(item.dependencia),
        categoria: safeText(item.categoria),
        encargado: safeText(item.encargado),
        cargo: safeText(item.cargo),
        telefono: safeText(item.telefono),
        correo: safeText(item.correo),
        notas: safeText(item.notas)
      })).filter(item => item.dependencia);

      const result = await apiPost("/api/v1/directory/import", { records });
      await loadDirectory();
      renderJsonBox();

      alert(`Importación a PostgreSQL completa: ${result.created} registro(s).`);
    } catch (error) {
      alert("No se pudo importar el JSON. Revisa el formato o la conexión API.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file, "utf-8");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadDirectory();

  $("searchInput").addEventListener("input", renderMatches);
  $("dependencyFilter").addEventListener("change", renderMatches);
  $("importJsonFile").addEventListener("change", importDirectoryJson);
});
