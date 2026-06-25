let directoryData = [];
let questionsData = [];
let currentExam = [];
let currentIndex = 0;
let answers = [];
let failedQuestions = [];
let examDisplayOffset = 0;
let examDisplayTotal = 0;
let examMode = "random";

async function loadData(){
  try{
    const [dirRes, qRes] = await Promise.all([fetch("./directory.json"), fetch("./questions.json")]);
    directoryData = await dirRes.json();
    questionsData = await qRes.json();

    window.questionsData = questionsData;

    const officialTopics = [...new Set(
      questionsData
        .map(q => q.tema)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    localStorage.setItem("bat_temas_oficiales_v1", JSON.stringify(officialTopics));

    failedQuestions = JSON.parse(localStorage.getItem("failedQuestions") || "[]");
  }catch(error){
    console.error("Error cargando datos", error);
  }
}

function setContent(html){
  document.getElementById("content").innerHTML = html;
}

function renderHome(){
  setContent(`<h2>Bienvenido</h2><p>Selecciona un módulo para iniciar. La idea es simple: consultar rápido y estudiar diario.</p>`);
}

function renderDirectory(filter = ""){
  const term = filter.toLowerCase().trim();
  const list = directoryData.filter(item =>
    [item.dependencia,item.categoria,item.encargado,item.cargo,item.telefono,item.correo,item.notas]
      .join(" ").toLowerCase().includes(term)
  );

  setContent(`
    <h2>Directorio</h2>
    <p class="muted">Dependencias y contactos operativos registrados.</p>
    <input class="search-box" placeholder="Buscar dependencia, encargado o tema..." value="${escapeHtml(filter)}" oninput="renderDirectory(this.value)">
    <p class="muted">${list.length} resultado(s)</p>
    ${list.map(item => `
      <article class="directory-card" id="card-${item.id}">
        <button class="directory-summary" onclick="toggleDirectoryCard('${item.id}')">
          <div class="directory-title">
            <span class="badge">${escapeHtml(item.categoria)}</span>
            <strong>${escapeHtml(item.dependencia)}</strong>
            <small>${escapeHtml(item.encargado)}</small>
          </div>
          <span class="chevron">⌄</span>
        </button>
        <div class="directory-details">
          <p><strong>Cargo:</strong><br>${escapeHtml(item.cargo || "Por registrar")}</p>
          <p><strong>Teléfono:</strong><br>${escapeHtml(item.telefono || "Por registrar")}</p>
          <p><strong>Correo:</strong><br>${escapeHtml(item.correo || "Por registrar")}</p>
          <p><strong>Notas:</strong><br>${escapeHtml(item.notas || "Sin notas")}</p>
        </div>
      </article>
    `).join("") || `<p>No encontramos coincidencias. La base no miente, pero a veces se hace la difícil.</p>`}
  `);
}

function toggleDirectoryCard(id){
  document.getElementById(`card-${id}`)?.classList.toggle("open");
}

function escapeHtml(text){
  return String(text ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

async function loadVersionInfo() {
  try {
    const response = await fetch("version.json?v=" + Date.now());
    const info = await response.json();

    const versionElement = document.getElementById("versionInfo");
    const realQuestionCount = typeof getUnifiedQuestions === "function"
      ? getUnifiedQuestions().length
      : questionsData.length;

    if(versionElement){
      versionElement.textContent =
        `${info.version} | ${realQuestionCount} preguntas | Actualizado ${info.updated}`;
    }
  } catch(error){
    console.error("No fue posible cargar version.json", error);
  }
}

loadData().then(() => {
  renderHome();
  loadVersionInfo();
});
