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

function searchDirectory() {
  const query = normalize(document.getElementById("searchInput").value.trim());
  const resultBox = document.getElementById("resultBox");

  if (!query) {
    resultBox.textContent = "Escribe una palabra clave para buscar.";
    return;
  }

  const results = directoryData.filter(item => {
    const searchable = normalize(Object.values(item).join(" "));
    return searchable.includes(query);
  });

  if (results.length === 0) {
    lastResult = "No se encontraron coincidencias.";
    resultBox.textContent = lastResult;
    return;
  }

  lastResult = results.map(formatContact).join("\n\n------------------------------\n\n");
  resultBox.textContent = lastResult;
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  lastResult = "";
  document.getElementById("resultBox").textContent = "Aquí aparecerá la información del directorio...";
}

async function copyResult() {
  if (!lastResult) return;
  await navigator.clipboard.writeText(lastResult);
  alert("Información copiada.");
}

document.addEventListener("DOMContentLoaded", loadDirectory);