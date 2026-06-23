const STORAGE_KEY = "bat_directorio_operativo_v097";

let directoryData = [];
let lastResult = "";

const $ = (id) => document.getElementById(id);

async function loadDirectory() {
  const local = loadLocalDirectory();

  if (local?.length) {
    directoryData = local;
  } else {
    const response = await fetch("directory.json?v=" + Date.now());
    directoryData = await response.json();
    saveLocalDirectory();
  }

  populateDependencyFilter();
  renderMatches();
  renderBank();
}

function saveLocalDirectory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(directoryData));
}

function loadLocalDirectory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

function slugify(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `registro-${Date.now()}`;
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
  const id = safeText($("recordId").value) || slugify($("formDependencia").value);

  return {
    id,
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

function saveRecord() {
  const record = getFormRecord();
  const error = validateRecord(record);

  if (error) {
    alert(error);
    return;
  }

  const index = directoryData.findIndex(item => item.id === record.id);

  if (index >= 0) {
    directoryData[index] = record;
  } else {
    let newId = record.id;
    let counter = 2;
    while (directoryData.some(item => item.id === newId)) {
      newId = `${record.id}-${counter}`;
      counter += 1;
    }
    record.id = newId;
    directoryData.push(record);
  }

  directoryData.sort((a, b) => (a.dependencia || "").localeCompare(b.dependencia || ""));
  saveLocalDirectory();
  populateDependencyFilter();
  renderBank();
  resetForm();
  alert("Registro guardado.");
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

function deleteRecord(id) {
  const item = directoryData.find(record => record.id === id);
  if (!item) return;

  if (!confirm(`¿Eliminar ${item.dependencia}?`)) return;

  directoryData = directoryData.filter(record => record.id !== id);
  saveLocalDirectory();
  populateDependencyFilter();
  renderBank();
  renderMatches();
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
    bankBox.innerHTML = `<p class="muted">No hay registros disponibles.</p>`;
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

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("El JSON debe ser una lista.");

      directoryData = imported.map(item => ({
        id: safeText(item.id) || slugify(item.dependencia),
        dependencia: safeText(item.dependencia),
        categoria: safeText(item.categoria),
        encargado: safeText(item.encargado),
        cargo: safeText(item.cargo),
        telefono: safeText(item.telefono),
        correo: safeText(item.correo),
        notas: safeText(item.notas)
      })).filter(item => item.dependencia);

      saveLocalDirectory();
      populateDependencyFilter();
      renderBank();
      renderMatches();
      renderJsonBox();
      alert(`JSON importado: ${directoryData.length} registro(s).`);
    } catch (error) {
      console.error(error);
      alert("No se pudo importar el JSON. Revisa el formato.");
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