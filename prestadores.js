let providersData = [];
let lastResult = "";

async function loadProviders() {
  const response = await fetch("prestadores.json?v=" + Date.now());
  providersData = await response.json();
  populateServiceFilter();
  renderMatches();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAltaMSC(item) {
  const alta = normalize(item.alta_msc || "");
  const mx = normalize(item.mx_code || item.codigo_mx || "");
  return alta === "x" || mx.startsWith("mxa") || mx.startsWith("mx");
}

function getMxCode(item) {
  return item.mx_code || item.codigo_mx || item.alta_msc || "";
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
  const select = document.getElementById("serviceFilter");
  if (!select) return;

  const servicios = [...new Set(
    providersData
      .map(item => item.servicio)
      .filter(Boolean)
  )].sort();

  select.innerHTML = `<option value="">Todos los servicios</option>`;

  servicios.forEach(servicio => {
    const option = document.createElement("option");
    option.value = servicio;
    option.textContent = servicio;
    select.appendChild(option);
  });
}

function getMatches(query = "") {
  const cleanQuery = normalize(query.trim());
  const selectedService = document.getElementById("serviceFilter")?.value || "";

  return providersData.filter(item => {
    const serviceMatch = !selectedService || item.servicio === selectedService;
    const searchable = normalize(Object.values(item).join(" "));
    const textMatch = !cleanQuery || searchable.includes(cleanQuery);

    return serviceMatch && textMatch;
  });
}

function renderMatches() {
  const query = document.getElementById("searchInput").value;
  const resultBox = document.getElementById("resultBox");
  const matchesBox = document.getElementById("matchesBox");
  const selectedService = document.getElementById("serviceFilter")?.value || "";

  const matches = getMatches(query);

  matchesBox.innerHTML = "";

  if (!query.trim() && !selectedService) {
    resultBox.textContent = "Selecciona un servicio o escribe una palabra clave para buscar.";
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

    const altaBadge = isAltaMSC(item)
      ? `<span class="badge-ok">✅ Alta MSC ${getMxCode(item)}</span>`
      : `<span class="badge-neutral">⚪ Sin Alta MSC</span>`;

    card.innerHTML = `
      <strong>${item.denominacion || ""}</strong>
      <small>${item.servicio || ""}</small>
      <small>${altaBadge}</small>
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
  document.getElementById("serviceFilter").value = "";
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

  document.getElementById("searchInput").addEventListener("input", renderMatches);
  document.getElementById("serviceFilter").addEventListener("change", renderMatches);
});
