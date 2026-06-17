let directoryData = [];
let questionsData = [];
let currentExam = [];
let currentIndex = 0;
let answers = [];
let failedQuestions = [];

async function loadData(){
  try{
    const [dirRes, qRes] = await Promise.all([fetch("./directory.json"), fetch("./questions.json")]);
    directoryData = await dirRes.json();
    questionsData = await qRes.json();
    failedQuestions = JSON.parse(localStorage.getItem("failedQuestions") || "[]");
  }catch(error){
    console.error("Error cargando datos", error);
  }
}

function setContent(html){ document.getElementById("content").innerHTML = html; }

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
            <span class="badge">${item.categoria}</span>
            <strong>${item.dependencia}</strong>
            <small>${item.encargado}</small>
          </div>
          <span class="chevron">⌄</span>
        </button>
        <div class="directory-details">
          <p><strong>Cargo:</strong><br>${item.cargo || "Por registrar"}</p>
          <p><strong>Teléfono:</strong><br>${item.telefono || "Por registrar"}</p>
          <p><strong>Correo:</strong><br>${item.correo || "Por registrar"}</p>
          <p><strong>Notas:</strong><br>${item.notas || "Sin notas"}</p>
        </div>
      </article>
    `).join("") || `<p>No encontramos coincidencias. La base no miente, pero a veces se hace la difícil.</p>`}
  `);
}

function toggleDirectoryCard(id){
  document.getElementById(`card-${id}`)?.classList.toggle("open");
}

function renderExamHome(){
  const history = getHistory();
  const avg = history.length ? Math.round(history.reduce((a,b)=>a+b.score,0)/history.length) : 0;
  const last = history.length ? history[0].score + "%" : "Sin datos";

  setContent(`
    <h2>Examen</h2>
    <p class="muted">Simulador de estudio diario. Responde, revisa errores y mide avance.</p>
    <div class="stats-grid">
      <div class="stat-card"><strong>${questionsData.length}</strong><small>Preguntas</small></div>
      <div class="stat-card"><strong>${history.length}</strong><small>Intentos</small></div>
      <div class="stat-card"><strong>${avg ? avg + "%" : "—"}</strong><small>Promedio</small></div>
    </div>
    <div class="toolbar">
      <button class="action" onclick="startExam(10)">Examen diario</button>
      <button class="pill" onclick="startExam(questionsData.length)">Simulador completo</button>
      <button class="pill" onclick="startFailedReview()">Repasar errores</button>
      <button class="pill" onclick="renderProgress()">Mi progreso</button>
      <button class="pill" onclick="RegistrosPreguntas.open()">Registros</button>
    </div>
    <div class="progress-card">
      <strong>Último examen:</strong> ${last}<br>
      <strong>Errores guardados:</strong> ${failedQuestions.length}
    </div>
  `);
}

function shuffle(array){ return [...array].sort(() => Math.random() - 0.5); }

function startExam(count){
  currentExam = shuffle(questionsData).slice(0, Math.min(count, questionsData.length));
  currentIndex = 0;
  answers = [];
  renderQuestion();
}

function startFailedReview(){
  const failedIds = [...new Set(failedQuestions.map(f => f.questionId))];
  const pool = questionsData.filter(q => failedIds.includes(q.id));
  if(!pool.length){
    setContent(`<h2>Repasar errores</h2><p class="muted">No tienes errores guardados todavía. Buen indicador, o todavía falta generar data.</p><button class="action" onclick="startExam(10)">Iniciar examen diario</button>`);
    return;
  }
  currentExam = shuffle(pool);
  currentIndex = 0;
  answers = [];
  renderQuestion();
}

function renderQuestion(){
  const q = currentExam[currentIndex];
  const percent = Math.round((currentIndex / currentExam.length) * 100);
  setContent(`
    <div class="question-counter">
      <h2>Pregunta ${currentIndex + 1} / ${currentExam.length}</h2>
      <span class="badge">${q.tema}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <p><strong>${q.pregunta}</strong></p>
    ${q.opciones.map((op, i) => `<button class="option" onclick="answerQuestion(${i})">${op}</button>`).join("")}
  `);
}

function answerQuestion(selected){
  const q = currentExam[currentIndex];
  const correct = selected === q.correcta;
  answers.push({ questionId:q.id, selected, correct, tema:q.tema });

  if(!correct){
    saveFailedQuestion(q.id, q.tema);
  }

  const buttons = q.opciones.map((op, i) => {
    let cls = "option";
    if(i === q.correcta) cls += " correct";
    else if(i === selected) cls += " wrong";
    return `<button class="${cls}" disabled>${op}</button>`;
  }).join("");

  const percent = Math.round(((currentIndex + 1) / currentExam.length) * 100);

  setContent(`
    <h2>${correct ? "Correcto" : "Incorrecto"}</h2>
    <span class="badge">${q.tema}</span>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <p><strong>${q.pregunta}</strong></p>
    ${buttons}
    <div class="details">
      <strong>Explicación:</strong>
      <p>${q.explicacion}</p>
    </div>
    ${q.fundamento ? `
      <div class="legal-box">
        <strong>📖 Fundamento Legal:</strong>
        <p>${q.fundamento}</p>
      </div>
    ` : ""}
    <div class="toolbar">
      <button class="action" onclick="nextQuestion()">${currentIndex + 1 === currentExam.length ? "Ver resultado" : "Siguiente"}</button>
    </div>
  `);
}

function nextQuestion(){
  currentIndex++;
  if(currentIndex >= currentExam.length) renderResult();
  else renderQuestion();
}

function renderResult(){
  const correct = answers.filter(a => a.correct).length;
  const score = Math.round((correct / currentExam.length) * 100);
  saveHistory(score, correct, currentExam.length);

  const byTopic = {};
  answers.forEach(a => {
    byTopic[a.tema] = byTopic[a.tema] || { total:0, correct:0 };
    byTopic[a.tema].total++;
    if(a.correct) byTopic[a.tema].correct++;
  });

  setContent(`
    <h2>Resultado</h2>
    <div class="score">${score}%</div>
    <p>Respuestas correctas: <strong>${correct}</strong> de <strong>${currentExam.length}</strong>.</p>
    <h3>Resultado por tema</h3>
    ${Object.entries(byTopic).map(([tema, data]) => `
      <div class="item">
        <strong>${tema}</strong>
        <small>${data.correct}/${data.total} correctas · ${Math.round((data.correct/data.total)*100)}%</small>
      </div>
    `).join("")}
    <div class="toolbar">
      <button class="action" onclick="renderExamHome()">Volver a Examen</button>
      <button class="pill" onclick="startExam(10)">Nuevo diario</button>
      <button class="pill" onclick="startFailedReview()">Repasar errores</button>
    </div>
  `);
}

function getHistory(){ return JSON.parse(localStorage.getItem("examHistory") || "[]"); }

function saveHistory(score, correct, total){
  const history = getHistory();
  history.unshift({ date:new Date().toISOString(), score, correct, total });
  localStorage.setItem("examHistory", JSON.stringify(history.slice(0,50)));
}

function saveFailedQuestion(questionId, tema){
  failedQuestions.unshift({ questionId, tema, date:new Date().toISOString() });
  failedQuestions = failedQuestions.slice(0,100);
  localStorage.setItem("failedQuestions", JSON.stringify(failedQuestions));
}

function renderProgress(){
  const history = getHistory();
  if(!history.length){
    setContent(`<h2>Mi progreso</h2><p class="muted">Todavía no hay intentos registrados. Hora de generar tracción.</p><button class="action" onclick="startExam(10)">Iniciar examen</button>`);
    return;
  }
  const avg = Math.round(history.reduce((a,b)=>a+b.score,0)/history.length);
  const best = Math.max(...history.map(h => h.score));
  const last = history[0].score;

  setContent(`
    <h2>Mi progreso</h2>
    <div class="stats-grid">
      <div class="stat-card"><strong>${avg}%</strong><small>Promedio</small></div>
      <div class="stat-card"><strong>${best}%</strong><small>Mejor</small></div>
      <div class="stat-card"><strong>${last}%</strong><small>Último</small></div>
    </div>
    <p class="muted">Historial basado en ${history.length} intento(s).</p>
    ${history.slice(0,10).map(h => `
      <div class="item">
        <strong>${h.score}%</strong>
        <small>${new Date(h.date).toLocaleString()} · ${h.correct}/${h.total} correctas</small>
      </div>
    `).join("")}
    <div class="toolbar">
      <button class="pill" onclick="clearProgress()">Limpiar progreso</button>
    </div>
  `);
}

function clearProgress(){
  if(confirm("¿Seguro que deseas limpiar el historial local de este dispositivo?")){
    localStorage.removeItem("examHistory");
    localStorage.removeItem("failedQuestions");
    failedQuestions = [];
    renderExamHome();
  }
}

function escapeHtml(text){
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

loadData().then(renderHome);
