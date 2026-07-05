let directoryData = [];
let questionsData = [];
let currentExam = [];
let currentIndex = 0;
let answers = [];
let failedQuestions = [];
let examDisplayOffset = 0;
let examDisplayTotal = 0;
let examMode = "random";

const BAT_API_BASE = localStorage.getItem("BAT_API_BASE_URL") || "";

async function fetchOfficialQuestions(){
  const sources = [];

  if(BAT_API_BASE){
    sources.push(`${BAT_API_BASE.replace(/\/$/, "")}/api/v1/exam/questions`);
  }

  sources.push(`questions.json?v=${Date.now()}`);

  let lastError = null;

  for(const source of sources){
    try{
      const response = await fetch(source, { cache: "no-store" });
      if(!response.ok) throw new Error(`HTTP ${response.status} al cargar ${source}`);

      const payload = await response.json();
      const records = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.records)
          ? payload.records
          : [];

      const normalized = records
        .map(item => item && item.raw && item.raw.pregunta ? item.raw : item)
        .filter(item => item && item.pregunta);

      if(normalized.length){
        return normalized;
      }

      throw new Error(`Fuente sin preguntas válidas: ${source}`);
    }catch(error){
      lastError = error;
      console.warn("No fue posible cargar preguntas desde", source, error);
    }
  }

  throw lastError || new Error("No fue posible cargar el banco oficial de preguntas.");
}

async function loadData(){
  try{
    const officialQuestions = await fetchOfficialQuestions();

    questionsData.splice(0, questionsData.length, ...officialQuestions);
    window.questionsData = questionsData;

    const officialTopics = [...new Set(
      questionsData
        .map(q => q.tema)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    localStorage.setItem("bat_temas_oficiales_v1", JSON.stringify(officialTopics));
    failedQuestions = JSON.parse(localStorage.getItem("failedQuestions") || "[]");
  }catch(error){
    console.error("Error cargando banco oficial de preguntas", error);
    questionsData.splice(0, questionsData.length);
    window.questionsData = questionsData;
    failedQuestions = JSON.parse(localStorage.getItem("failedQuestions") || "[]");
  }
}

function setContent(html){
  document.getElementById("content").innerHTML = html;
}

function renderHome(){
  setContent(`<h2>Bienvenido</h2><p>Selecciona un módulo para iniciar. La idea es simple: consultar rápido y estudiar diario.</p>`);
}

function renderDirectory(filter = ""){
  setContent(`<h2>Directorio</h2><p>El Directorio ahora vive en su módulo dedicado conectado a BAT-API.</p><button class="action" onclick="window.location.href='directorio.html'">Abrir Directorio</button>`);
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