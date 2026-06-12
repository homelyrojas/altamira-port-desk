let directoryData = [];
let questionsData = [];
let currentExam = [];
let currentIndex = 0;
let answers = [];

async function loadData(){
  try{
    const [dirRes, qRes] = await Promise.all([
      fetch("./directory.json"),
      fetch("./questions.json")
    ]);
    directoryData = await dirRes.json();
    questionsData = await qRes.json();
  }catch(error){
    console.error("Error cargando datos", error);
  }
}

function setContent(html){ document.getElementById("content").innerHTML = html; }

function renderHome(){
  setContent(`<h2>Bienvenido</h2><p>Selecciona un módulo para iniciar. La idea es simple: consultar rápido y estudiar diario.</p>`);
}

function renderDirectory(){
  const html = `
    <h2>Directorio</h2>
    <p class="muted">Dependencias y contactos operativos registrados.</p>
    ${directoryData.map(item => `
      <div class="item">
        <span class="badge">${item.categoria}</span>
        <strong>${item.dependencia}</strong>
        <small>${item.encargado}</small>
        <div class="details">
          <p><strong>Cargo:</strong> ${item.cargo || "Por registrar"}</p>
          <p><strong>Teléfono:</strong> ${item.telefono || "Por registrar"}</p>
          <p><strong>Correo:</strong> ${item.correo || "Por registrar"}</p>
          <p><strong>Notas:</strong> ${item.notas || "Sin notas"}</p>
        </div>
      </div>
    `).join("")}
  `;
  setContent(html);
}

function renderExamHome(){
  const history = getHistory();
  const avg = history.length ? Math.round(history.reduce((a,b)=>a+b.score,0)/history.length) : 0;
  setContent(`
    <h2>Examen</h2>
    <p class="muted">Simulador de estudio diario. Responde, revisa errores y mide avance.</p>
    <div class="toolbar">
      <button class="action" onclick="startExam(10)">Examen diario</button>
      <button class="pill" onclick="startExam(questionsData.length)">Simulador completo</button>
      <button class="pill" onclick="renderProgress()">Mi progreso</button>
    </div>
    <div class="progress-card">
      <strong>Banco actual:</strong> ${questionsData.length} preguntas<br>
      <strong>Promedio histórico:</strong> ${history.length ? avg + "%" : "Sin intentos"}
    </div>
  `);
}

function shuffle(array){
  return [...array].sort(() => Math.random() - 0.5);
}

function startExam(count){
  currentExam = shuffle(questionsData).slice(0, Math.min(count, questionsData.length));
  currentIndex = 0;
  answers = [];
  renderQuestion();
}

function renderQuestion(){
  const q = currentExam[currentIndex];
  setContent(`
    <h2>Pregunta ${currentIndex + 1} de ${currentExam.length}</h2>
    <span class="badge">${q.tema}</span>
    <p><strong>${q.pregunta}</strong></p>
    ${q.opciones.map((op, i) => `<button class="option" onclick="answerQuestion(${i})">${op}</button>`).join("")}
  `);
}

function answerQuestion(selected){
  const q = currentExam[currentIndex];
  const correct = selected === q.correcta;
  answers.push({ questionId:q.id, selected, correct, tema:q.tema });
  const buttons = q.opciones.map((op, i) => {
    let cls = "option";
    if(i === q.correcta) cls += " correct";
    else if(i === selected) cls += " wrong";
    return `<button class="${cls}" disabled>${op}</button>`;
  }).join("");

  setContent(`
    <h2>${correct ? "Correcto" : "Incorrecto"}</h2>
    <span class="badge">${q.tema}</span>
    <p><strong>${q.pregunta}</strong></p>
    ${buttons}
    <div class="details"><strong>Explicación:</strong><p>${q.explicacion}</p></div>
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
  setContent(`
    <h2>Resultado</h2>
    <div class="score">${score}%</div>
    <p>Respuestas correctas: <strong>${correct}</strong> de <strong>${currentExam.length}</strong>.</p>
    <div class="toolbar">
      <button class="action" onclick="renderExamHome()">Volver a Examen</button>
      <button class="pill" onclick="startExam(10)">Nuevo diario</button>
    </div>
  `);
}

function getHistory(){
  return JSON.parse(localStorage.getItem("examHistory") || "[]");
}

function saveHistory(score, correct, total){
  const history = getHistory();
  history.unshift({ date:new Date().toISOString(), score, correct, total });
  localStorage.setItem("examHistory", JSON.stringify(history.slice(0,50)));
}

function renderProgress(){
  const history = getHistory();
  if(!history.length){
    setContent(`<h2>Mi progreso</h2><p class="muted">Todavía no hay intentos registrados. Hora de generar tracción.</p><button class="action" onclick="startExam(10)">Iniciar examen</button>`);
    return;
  }
  const avg = Math.round(history.reduce((a,b)=>a+b.score,0)/history.length);
  setContent(`
    <h2>Mi progreso</h2>
    <div class="score">${avg}%</div>
    <p class="muted">Promedio histórico basado en ${history.length} intento(s).</p>
    ${history.slice(0,10).map(h => `
      <div class="item">
        <strong>${h.score}%</strong>
        <small>${new Date(h.date).toLocaleString()} · ${h.correct}/${h.total} correctas</small>
      </div>
    `).join("")}
  `);
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

loadData().then(renderHome);
