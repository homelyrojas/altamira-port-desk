let directoryData = [];
let lastResult = "";

async function loadDirectory() {
  const response = await fetch("directory.json?v=" + Date.now());
  directoryData = await response.json();
  populateDependencyFilter();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  const select = document.getElementById("dependencyFilter");
  if (!select) return;

  const dependencies = [...new Set(
    directoryData
      .map(item => item.dependencia)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="">Selecciona una dependencia...</option>`;

  dependencies.forEach(dep => {
    const option = document.createElement("option");
    option.value = dep;
    option.textContent = dep;
    select.appendChild(option);
  });
}

function getMatches(query) {
  const cleanQuery = normalize(query.trim());

  if (!cleanQuery) return [];

  return directoryData.filter(item => {
    const searchable = normalize(Object.values(item).join(" "));
    return searchable.includes(cleanQuery);
  });
}

function renderResultCard(item, targetBox) {
  const card = document.createElement("button");
  card.className = "result-card";
  card.innerHTML = `
    <strong>${item.dependencia || ""}</strong>
    <small>${item.categoria || ""} | ${item.encargado || ""}</small>
  `;

  card.onclick = () => {
    lastResult = formatContact(item);
    document.getElementById("resultBox").textContent = lastResult;
  };

  targetBox.appendChild(card);
}

function renderMatches() {
  const query = document.getElementById("searchInput").value;
  const resultBox = document.getElementById("resultBox");
  const matchesBox = document.getElementById("matchesBox");

  const matches = getMatches(query);

  matchesBox.innerHTML = "";

  if (!query.trim()) {
    resultBox.textContent = "Aquí aparecerá la información del directorio...";
    lastResult = "";
    return;
  }

  if (matches.length === 0) {
    resultBox.textContent = "No se encontraron coincidencias.";
    lastResult = "";
    return;
  }

  matches.forEach(item => renderResultCard(item, matchesBox));
}

function consultDependency() {
  const selected = document.getElementById("dependencyFilter").value;
  const resultBox = document.getElementById("resultBox");
  const dependencyMatchesBox = document.getElementById("dependencyMatchesBox");

  dependencyMatchesBox.innerHTML = "";

  if (!selected) {
    resultBox.textContent = "Selecciona una dependencia para consultar.";
    lastResult = "";
    return;
  }

  const matches = directoryData.filter(item => item.dependencia === selected);

  if (matches.length === 0) {
    resultBox.textContent = "No se encontró la dependencia seleccionada.";
    lastResult = "";
    return;
  }

  matches.forEach(item => renderResultCard(item, dependencyMatchesBox));

  lastResult = matches.map(formatContact).join("\n\n------------------------------\n\n");
  resultBox.textContent = lastResult;
}

function searchDirectory() {
  renderMatches();
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  document.getElementById("matchesBox").innerHTML = "";
  lastResult = "";
  document.getElementById("resultBox").textContent = "Aquí aparecerá la información del directorio...";
}

function clearDependency() {
  document.getElementById("dependencyFilter").value = "";
  document.getElementById("dependencyMatchesBox").innerHTML = "";
  lastResult = "";
  document.getElementById("resultBox").textContent = "Aquí aparecerá la información del directorio...";
}

async function copyResult() {
  if (!lastResult) return;
  await navigator.clipboard.writeText(lastResult);
  alert("Información copiada.");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadDirectory();

  const input = document.getElementById("searchInput");
  input.addEventListener("input", renderMatches);

  const select = document.getElementById("dependencyFilter");
  if (select) {
    select.addEventListener("change", consultDependency);
  }
});
