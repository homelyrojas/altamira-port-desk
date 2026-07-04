const API_BASE = localStorage.getItem("BAT_API_BASE_URL") || "http://127.0.0.1:8000";
let allRecords = [];

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
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

function getFilteredRecords() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;

  return allRecords.filter(r => {
    const text = `${r.vessel_name} ${r.service_name || ""} ${r.arrival_port_name || ""}`.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchStatus = !status || r.status_code === status;
    return matchSearch && matchStatus;
  });
}

function renderCards(records) {
  const delayed = records.filter(r => r.status_code === "DELAYED");
  const today = records.filter(r => isToday(r.eta_datetime));
  const completed = records.filter(r => r.status_code === "COMPLETED");

  document.getElementById("totalCalls").textContent = records.length;
  document.getElementById("delayedCalls").textContent = delayed.length;
  document.getElementById("todayCalls").textContent = today.length;
  document.getElementById("attentionCalls").textContent = delayed.length;
  document.getElementById("completedCalls").textContent = completed.length;
}

function vesselItem(r) {
  const badgeClass = r.status_code === "DELAYED" ? "delay" : "ok";
  return `
    <div class="item" onclick="loadTimeline('${r.id}')">
      <strong>${r.vessel_name}</strong>
      <span class="badge ${badgeClass}">${r.status_code}</span>
      <div>${r.service_name || "Sin servicio"} · ${r.arrival_port_name || "Sin puerto"}</div>
      <small>ETA: ${formatDateTime(r.eta_datetime)}</small>
    </div>
  `;
}

function renderLists(records) {
  const upcoming = [...records]
    .filter(r => r.eta_datetime)
    .sort((a, b) => new Date(a.eta_datetime) - new Date(b.eta_datetime))
    .slice(0, 10);

  const alerts = records.filter(r => r.status_code === "DELAYED");

  document.getElementById("fleetList").innerHTML =
    records.length ? records.map(vesselItem).join("") : "<p>Sin escalas.</p>";

  document.getElementById("upcomingList").innerHTML =
    upcoming.length ? upcoming.map(vesselItem).join("") : "<p>Sin próximos ETA.</p>";

  document.getElementById("alertsList").innerHTML =
    alerts.length ? alerts.map(vesselItem).join("") : "<p>Sin alertas operativas.</p>";
}

function renderDashboard() {
  const records = getFilteredRecords();
  renderCards(records);
  renderLists(records);
}

async function loadTimeline(id) {
  const data = await apiGet(`/api/v1/vessel-calls/${id}/timeline`);

  document.getElementById("timelineBox").innerHTML = `
    <h3>${data.summary.vessel_name}</h3>
    <p>Estado: <strong>${data.summary.status_code}</strong></p>
    <p>${data.summary.completed_steps} de ${data.summary.total_steps} pasos completados · ${data.summary.attention_items} alertas</p>
    ${data.steps.map(step => `
      <div class="timeline-step ${step.is_completed ? "done" : "pending"}">
        <strong>${step.label}</strong><br>
        <small>${step.event_datetime ? formatDateTime(step.event_datetime) : "Pendiente"}</small>
      </div>
    `).join("")}
  `;
}

async function loadDashboard() {
  try {
    document.getElementById("apiStatus").textContent = "Conectando...";
    const data = await apiGet("/api/v1/vessel-calls?limit=200");
    allRecords = data.records || [];
    renderDashboard();

    document.getElementById("apiStatus").textContent = "API conectada";
    document.getElementById("lastUpdate").textContent =
      `Última actualización: ${new Date().toLocaleTimeString("es-MX")}`;
  } catch (error) {
    document.getElementById("apiStatus").textContent = "Sin conexión API";
    document.getElementById("lastUpdate").textContent = error.message;
  }
}

document.getElementById("searchInput").addEventListener("input", renderDashboard);
document.getElementById("statusFilter").addEventListener("change", renderDashboard);

loadDashboard();
setInterval(loadDashboard, 300000);
