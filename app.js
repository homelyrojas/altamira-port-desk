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

function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeQuestion(q){
  const tipo = q.tipo || "multiple";

  if(tipo === "vf"){
    return {
      ...q,
      tipo: "vf",
      opciones: ["Verdadero", "Falso"],
      correcta: Number(q.correcta || 0)
    };
  }

  if(tipo === "concepto"){
    const conceptos = Array.isArray(q.conceptos) ? q.conceptos : (Array.isArray(q.opciones) ? q.opciones : []);
    let correcta = typeof q.correcta === "number" ? q.correcta : conceptos.findIndex(c => normalizeText(c) === normalizeText(q.correcta || q.correcta_texto));

    if(correcta < 0) correcta = 0;

    return {
      ...q,
      tipo: "concepto",
      conceptos,
      opciones: conceptos,
      correcta
    };
  }

  return {
    ...q,
    tipo: "multiple",
    opciones: Array.isArray(q.opciones) ? q.opciones : [],
    correcta: Number(q.correcta || 0)
  };
}

function getLocalExamQuestions(){
  if(window.RegistrosPreguntas && typeof RegistrosPreguntas.getQuestionsForExam === "function"){
    return RegistrosPreguntas.getQuestionsForExam();
  }

  if(window.RegistrosPreguntas && typeof RegistrosPreguntas.getQuestions === "function"){
    return RegistrosPreguntas.getQuestions().map(normalizeQuestion);
  }

  return [];
}

function getUnifiedQuestions(){
  return [
    ...questionsData.map(normalizeQuestion),
    ...getLocalExamQuestions().map(normalizeQuestion)
  ];
}

function getQuestionTypeLabel(tipo){
  const labels = {
    multiple: "Opción múltiple",
    vf: "Verdadero / Falso",
    concepto: "Elegir concepto",
    relacionar: "Relacionar columnas",
    abierta: "Pregunta abierta"
  };

  return labels[tipo] || "Opción múltiple";
}

function renderExamHome(){
  const allQuestions = getUnifiedQuestions();
  const localQuestions = getLocalExamQuestions();
  const history = getHistory();
  const avg = history.length ? Math.round(history.reduce((a,b)=>a+b.score,0)/history.length) : 0;
  const last = history.length ? history[0].score + "%" : "Sin datos";

  setContent(`
    <h2>Examen</h2>
    <p class="muted">Simulador de estudio diario. Responde, revisa errores y mide avance.</p>
    <div class="stats-grid">
      <div class="stat-card"><strong>${allQuestions.length}</strong><small>Preguntas</small></div>
      <div class="stat-card"><strong>${questionsData.length}</strong><small>Banco oficial</small></div>
      <div class="stat-card"><strong>${localQuestions.length}</strong><small>Banco personal</small></div>
      <div class="stat-card"><strong>${history.length}</strong><small>Intentos</small></div>
      <div class="stat-card"><strong>${avg ? avg + "%" : "—"}</strong><small>Promedio</small></div>
    </div>
    <div class="toolbar">
      <button class="action" onclick="startExam(10)">Examen diario</button>
      <button class="pill" onclick="startExam(getUnifiedQuestions().length)">Simulador completo</button>
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
  const pool = getUnifiedQuestions();
  currentExam = shuffle(pool).slice(0, Math.min(count, pool.length));
  currentIndex = 0;
  answers = [];
  renderQuestion();
}

function startFailedReview(){
  const failedIds = [...new Set(failedQuestions.map(f => String(f.questionId)))];
  const pool = getUnifiedQuestions().filter(q => failedIds.includes(String(q.id)));

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
  const q = normalizeQuestion(currentExam[currentIndex]);

  if(!q){
    setContent(`
      <h2>Sin preguntas disponibles</h2>
      <p class="muted">No hay preguntas cargadas para este examen.</p>
      <button class="action" onclick="renderExamHome()">Volver a Examen</button>
    `);
    return;
  }

  const percent = Math.round((currentIndex / currentExam.length) * 100);

  if(q.tipo === "concepto"){
    renderConceptQuestion(q, percent);
    return;
  }

  renderOptionQuestion(q, percent);
}

function renderQuestionHeader(q, percent){
  return `
    <div class="question-counter">
      <h2>Pregunta ${currentIndex + 1} / ${currentExam.length}</h2>
      <span class="badge">${escapeHtml(q.tema)}</span>
      <span class="badge">${escapeHtml(getQuestionTypeLabel(q.tipo))}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <p><strong>${escapeHtml(q.pregunta)}</strong></p>
  `;
}

function renderOptionQuestion(q, percent){
  setContent(`
    ${renderQuestionHeader(q, percent)}
    ${(q.opciones || []).map((op, i) => `
      <button class="option" onclick="answerQuestion(${i})">
        ${q.tipo === "vf" ? "" : String.fromCharCode(65 + i) + ") "}${escapeHtml(op)}
      </button>
    `).join("")}
  `);
}

function renderConceptQuestion(q, percent){
  const options = q.conceptos || q.opciones || [];

  setContent(`
    ${renderQuestionHeader(q, percent)}
    <label class="concept-select-label">
      Selecciona el concepto correcto
      <select id="conceptAnswer" class="search-box">
        <option value="">Selecciona...</option>
        ${options.map((op, i) => `<option value="${i}">${escapeHtml(op)}</option>`).join("")}
      </select>
    </label>
    <div class="toolbar">
      <button class="action" onclick="answerConceptQuestion()">Validar respuesta</button>
    </div>
  `);
}

function answerConceptQuestion(){
  const select = document.getElementById("conceptAnswer");

  if(!select || select.value === ""){
    alert("Selecciona un concepto.");
    return;
  }

  answerQuestion(Number(select.value));
}

function answerQuestion(selected){
  const q = normalizeQuestion(currentExam[currentIndex]);
  const correct = selected === Number(q.correcta);

  answers.push({ questionId:q.id, selected, correct, tema:q.tema, tipo:q.tipo });

  if(!correct){
    saveFailedQuestion(q.id, q.tema);
  }

  const percent = Math.round(((currentIndex + 1) / currentExam.length) * 100);

  if(q.tipo === "concepto"){
    renderConceptFeedback(q, selected, correct, percent);
    return;
  }

  renderOptionFeedback(q, selected, correct, percent);
}

function renderOptionFeedback(q, selected, correct, percent){
  const buttons = (q.opciones || []).map((op, i) => {
    let cls = "option";
    if(i === Number(q.correcta)) cls += " correct";
    else if(i === selected) cls += " wrong";

    return `
      <button class="${cls}" disabled>
        ${q.tipo === "vf" ? "" : String.fromCharCode(65 + i) + ") "}${escapeHtml(op)}
      </button>
    `;
  }).join("");

  renderFeedbackBase(q, correct, percent, buttons);
}

function renderConceptFeedback(q, selected, correct, percent){
  const options = q.conceptos || q.opciones || [];
  const selectedText = options[selected] || "";
  const correctText = options[q.correcta] || "";

  const conceptResult = `
    <div class="details">
      <strong>Tu respuesta:</strong>
      <p>${escapeHtml(selectedText)}</p>
      <strong>Respuesta correcta:</strong>
      <p>${escapeHtml(correctText)}</p>
    </div>
  `;

  renderFeedbackBase(q, correct, percent, conceptResult);
}

function renderFeedbackBase(q, correct, percent, answerHtml){
  setContent(`
    <h2>${correct ? "Correcto" : "Incorrecto"}</h2>
    <span class="badge">${escapeHtml(q.tema)}</span>
    <span class="badge">${escapeHtml(getQuestionTypeLabel(q.tipo))}</span>
    <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    <p><strong>${escapeHtml(q.pregunta)}</strong></p>
    ${answerHtml}
    <div class="details">
      <strong>Explicación:</strong>
      <p>${escapeHtml(q.explicacion || "Sin explicación registrada.")}</p>
    </div>
    ${q.fundamento ? `
      <div class="legal-box">
        <strong>📖 Fundamento Legal:</strong>
        <p>${escapeHtml(q.fundamento)}</p>
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
        <strong>${escapeHtml(tema)}</strong>
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
  return String(text ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

loadData().then(renderHome);
