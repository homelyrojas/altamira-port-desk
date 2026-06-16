let directoryData = [];
let lastResult = "";

async function loadDirectory() {
  const response = await fetch("directory.json?v=" + Date.now());
  directoryData = await response.json();
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

function getMatches(query) {
  const cleanQuery = normalize(query.trim());

  if (!cleanQuery) return [];

  return directoryData.filter(item => {
    const searchable = normalize(Object.values(item).join(" "));
    return searchable.includes(cleanQuery);
  });
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

  matches.forEach(item => {
    const card = document.createElement("button");
    card.className = "result-card";
    card.innerHTML = `
      <strong>${item.dependencia || ""}</strong>
      <small>${item.categoria || ""} | ${item.encargado || ""}</small>
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
  document.getElementById("searchInput").value = "";
  document.getElementById("matchesBox").innerHTML = "";
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
});
