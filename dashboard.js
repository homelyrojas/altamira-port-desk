const API_BASE = localStorage.getItem("BAT_API_BASE_URL") || "http://127.0.0.1:8000";

async function getVesselCalls() {
  const response = await fetch(`${API_BASE}/api/v1/vessel-calls?limit=200`);
  if (!response.ok) throw new Error("No se pudo consultar BAT-API");
  return response.json();
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderDashboard(data) {
  const records = data.records || [];

  const delayed = records.filter(r => r.status_code === "DELAYED");
  const today = records.filter(r => isToday(r.eta_datetime));
  const attention = delayed;

  document.getElementById("totalCalls").textContent = records.length;
  document.getElementById("delayedCalls").textContent = delayed.length;
  document.getElementById("todayCalls").textContent = today.length;
  document.getElementById("attentionCalls").textContent = attention.length;

  const upcoming = [...records]
    .filter(r => r.eta_datetime)
    .sort((a, b) => new Date(a.eta_datetime) - new Date(b.eta_datetime))
    .slice(0, 8);

  document.getElementById("upcomingList").innerHTML = upcoming.length
    ? upcoming.map(r => `
      <div class="item">
        <strong>${r.vessel_name}</strong>
        <div>${r.service_name || "Sin servicio"} · ${r.arrival_port_name || "Sin puerto"}</div>
        <small>ETA: ${formatDateTime(r.eta_datetime)}</small>
      </div>
    `).join("")
    : "<p>Sin próximos ETA.</p>";

  document.getElementById("alertsList").innerHTML = attention.length
    ? attention.map(r => `
      <div class="item">
        <strong>${r.vessel_name}</strong><span class="badge">${r.status_code}</span>
        <div>ETA vencida o requiere atención operativa.</div>
        <small>${formatDateTime(r.eta_datetime)}</small>
      </div>
    `).join("")
    : "<p>Sin alertas operativas.</p>";
}

async function init() {
  try {
    const data = await getVesselCalls();
    renderDashboard(data);
  } catch (error) {
    document.body.innerHTML = `<main class="dashboard"><h1>Error</h1><p>${error.message}</p></main>`;
  }
}

init();
