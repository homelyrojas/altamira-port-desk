let providersData = [];
let lastResult = "";

async function loadProviders() {
  const response = await fetch("prestadores.json?v=" + Date.now());
  providersData = await response.json();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatProvider(item) {
  return `${item.denominacion || ""}

Servicio: ${item.servicio || ""}
Alta en MSC: ${item.alta_msc || ""}
Dirección: ${item.direccion || ""}
Teléfono: ${item.telefono || ""}
Contacto: ${item.contacto || ""}
Email: ${item.email || ""}`;
}

function getMatches(query) {
  const cleanQuery = normalize(query.trim());
  if (!cleanQuery) return [];

  return providersData.filter(item => {
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
    resultBox.textContent = "Aquí aparecerá la información del prestador de servicios...";
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
      <strong>${item.denominacion || ""}</strong>
      <small>${item.servicio || ""} | Alta MSC: ${item.alta_msc || ""}</small>
      <small>${item.contacto || ""}</small>
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
  document.getElementById("searchInput").value = "";
  document.getElementById("matchesBox").innerHTML = "";
  lastResult = "";
  document.getElementById("resultBox").textContent = "Aquí aparecerá la información del prestador de servicios...";
}

async function copyResult() {
  if (!lastResult) return;
  await navigator.clipboard.writeText(lastResult);
  alert("Información copiada.");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProviders();
  const input = document.getElementById("searchInput");
  input.addEventListener("input", renderMatches);
});
