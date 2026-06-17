/*
  BOARDING AGENT TOOLS - Módulo Registros
  localStorage + Exportación / Importación JSON
  Creado para integrarse dentro del módulo Examen.

  Instalación rápida:
  1) Copiar registros.js y registros.css en la carpeta del proyecto.
  2) En index.html agregar:
     <link rel="stylesheet" href="registros.css">
     <script src="registros.js"></script>
  3) Opcional: agregar un botón con id="btnRegistros".
     Si no existe, el script intentará crearlo dentro del módulo de examen.
*/

(function () {
  const STORAGE_KEY = "bat_preguntas_locales_v1";
  const VIEW_ID = "registrosView";
  const BUTTON_ID = "btnRegistros";

  let currentFilter = "";
  let editingId = null;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function safeText(value) {
    return String(value || "").trim();
  }

  function loadLocalQuestions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("Error leyendo preguntas locales:", error);
      return [];
    }
  }

  function saveLocalQuestions(questions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions, null, 2));
    window.dispatchEvent(new CustomEvent("localQuestionsUpdated", { detail: questions }));
  }

  function nextLocalId() {
    const questions = loadLocalQuestions();
    const nums = questions
      .map(q => String(q.id || "").replace("local-", ""))
      .map(n => parseInt(n, 10))
      .filter(n => !Number.isNaN(n));

    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return "local-" + String(next).padStart(3, "0");
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getAllTopics() {
    const topics = new Set(loadLocalQuestions().map(q => q.tema).filter(Boolean));
    return Array.from(topics).sort((a, b) => a.localeCompare(b));
  }

  function hideMainExamViews() {
    const candidates = [
      "#dailyExamView",
      "#fullExamView",
      "#errorsView",
      "#progressView",
      "#quizView",
      "#resultView",
      ".exam-screen",
      ".quiz-screen"
    ];

    candidates.forEach(selector => {
      $all(selector).forEach(el => {
        if (el.id !== VIEW_ID) el.classList.add("bat-hidden");
      });
    });
  }

  function showRegistrosView() {
    ensureView();
    hideMainExamViews();
    const view = $("#" + VIEW_ID);
    if (view) {
      view.classList.remove("bat-hidden");
      view.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderRegistros();
  }

  function closeRegistrosView() {
    const view = $("#" + VIEW_ID);
    if (view) view.classList.add("bat-hidden");

    $all(".bat-hidden").forEach(el => {
      if (el.id !== VIEW_ID) el.classList.remove("bat-hidden");
    });
  }

  function ensureButton() {
    if ($("#" + BUTTON_ID)) {
      $("#" + BUTTON_ID).addEventListener("click", showRegistrosView);
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "exam-btn";
    button.textContent = "Registros";
    button.addEventListener("click", showRegistrosView);

    const possibleContainers = [
      "#examButtons",
      "#examMenu",
      ".exam-buttons",
      ".exam-actions",
      ".quiz-actions",
      "#examen",
      "#exam"
    ];

    for (const selector of possibleContainers) {
      const container = $(selector);
      if (container) {
        container.appendChild(button);
        return;
      }
    }

    document.body.insertBefore(button, document.body.firstChild);
  }

  function ensureView() {
    if ($("#" + VIEW_ID)) return;

    const view = document.createElement("section");
    view.id = VIEW_ID;
    view.className = "registros-view bat-hidden";

    view.innerHTML = `
      <div class="registros-header">
        <div>
          <p class="registros-kicker">Módulo de Examen</p>
          <h2>Registros</h2>
          <p class="registros-subtitle">
            Captura, administra, importa y exporta preguntas personales para incrementar tu acervo de estudio.
          </p>
        </div>
        <button type="button" class="secondary-btn" id="cerrarRegistrosBtn">Volver al examen</button>
      </div>

      <div class="registros-tabs">
        <button type="button" class="tab-btn active" data-tab="registrar">Registrar pregunta</button>
        <button type="button" class="tab-btn" data-tab="banco">Banco personal</button>
        <button type="button" class="tab-btn" data-tab="json">Exportar / Importar JSON</button>
        <button type="button" class="tab-btn" data-tab="repaso">Repasar nuevas</button>
      </div>

      <div class="tab-panel active" id="tab-registrar">
        <form id="registroPreguntaForm" class="registro-form">
          <input type="hidden" id="registroEditId">

          <label>
            Tema
            <input id="registroTema" type="text" placeholder="Ej. Capitanía, Aduana, INM, Operación Portuaria" required>
          </label>

          <label>
            Pregunta
            <textarea id="registroPregunta" rows="3" placeholder="Escribe la pregunta completa" required></textarea>
          </label>

          <div class="opciones-grid">
            <label>Opción A <input id="opcionA" type="text" required></label>
            <label>Opción B <input id="opcionB" type="text" required></label>
            <label>Opción C <input id="opcionC" type="text" required></label>
            <label>Opción D <input id="opcionD" type="text" required></label>
          </div>

          <label>
            Respuesta correcta
            <select id="registroCorrecta" required>
              <option value="0">A</option>
              <option value="1">B</option>
              <option value="2">C</option>
              <option value="3">D</option>
            </select>
          </label>

          <label>
            Explicación
            <textarea id="registroExplicacion" rows="3" placeholder="Explica por qué esa es la respuesta correcta"></textarea>
          </label>

          <label>
            Fundamento legal
            <textarea id="registroFundamento" rows="2" placeholder="Artículo, ley, reglamento, circular o criterio operativo"></textarea>
          </label>

          <div class="form-actions">
            <button type="submit" class="primary-btn" id="guardarPreguntaBtn">Guardar pregunta</button>
            <button type="button" class="secondary-btn" id="limpiarFormularioBtn">Limpiar</button>
          </div>
        </form>
      </div>

      <div class="tab-panel" id="tab-banco">
        <div class="banco-toolbar">
          <label>
            Filtrar por tema
            <select id="filtroTema">
              <option value="">Todos los temas</option>
            </select>
          </label>
          <input id="buscarPregunta" type="search" placeholder="Buscar texto dentro de preguntas">
        </div>
        <div id="bancoPersonal"></div>
      </div>

      <div class="tab-panel" id="tab-json">
        <div class="json-actions">
          <button type="button" class="primary-btn" id="exportarJsonBtn">Exportar JSON</button>
          <label class="file-btn">
            Importar JSON
            <input id="importarJsonInput" type="file" accept=".json,application/json">
          </label>
        </div>
        <textarea id="jsonPreview" rows="14" readonly placeholder="Aquí aparecerá el JSON exportable"></textarea>
        <p class="registros-note">
          Consejo operativo: exporta este JSON y pégalo en GitHub cuando quieras incorporar oficialmente tus nuevas preguntas.
        </p>
      </div>

      <div class="tab-panel" id="tab-repaso">
        <div id="repasoNuevas"></div>
      </div>
    `;

    const target = $("#examen") || $("#exam") || $("main") || document.body;
    target.appendChild(view);

    $("#cerrarRegistrosBtn", view).addEventListener("click", closeRegistrosView);
    $("#registroPreguntaForm", view).addEventListener("submit", handleSubmit);
    $("#limpiarFormularioBtn", view).addEventListener("click", clearForm);
    $("#filtroTema", view).addEventListener("change", e => {
      currentFilter = e.target.value;
      renderBanco();
    });
    $("#buscarPregunta", view).addEventListener("input", renderBanco);
    $("#exportarJsonBtn", view).addEventListener("click", exportJson);
    $("#importarJsonInput", view).addEventListener("change", importJson);

    $all(".tab-btn", view).forEach(btn => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab));
    });
  }

  function activateTab(tabName) {
    const view = $("#" + VIEW_ID);
    $all(".tab-btn", view).forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
    $all(".tab-panel", view).forEach(panel => panel.classList.toggle("active", panel.id === "tab-" + tabName));

    if (tabName === "banco") renderBanco();
    if (tabName === "json") renderJsonPreview();
    if (tabName === "repaso") renderRepaso();
  }

  function handleSubmit(event) {
    event.preventDefault();

    const question = {
      id: editingId || nextLocalId(),
      origen: "localStorage",
      tema: safeText($("#registroTema").value),
      pregunta: safeText($("#registroPregunta").value),
      opciones: [
        safeText($("#opcionA").value),
        safeText($("#opcionB").value),
        safeText($("#opcionC").value),
        safeText($("#opcionD").value)
      ],
      correcta: Number($("#registroCorrecta").value),
      explicacion: safeText($("#registroExplicacion").value),
      fundamento: safeText($("#registroFundamento").value),
      creado_en: new Date().toISOString()
    };

    if (!question.tema || !question.pregunta || question.opciones.some(o => !o)) {
      alert("Faltan datos obligatorios. Revisa tema, pregunta y las cuatro opciones.");
      return;
    }

    const questions = loadLocalQuestions();
    const index = questions.findIndex(q => q.id === question.id);

    if (index >= 0) {
      question.creado_en = questions[index].creado_en || question.creado_en;
      question.actualizado_en = new Date().toISOString();
      questions[index] = question;
    } else {
      questions.push(question);
    }

    saveLocalQuestions(questions);
    clearForm();
    renderRegistros();
    activateTab("banco");
  }

  function clearForm() {
    editingId = null;
    const form = $("#registroPreguntaForm");
    if (form) form.reset();
    const saveBtn = $("#guardarPreguntaBtn");
    if (saveBtn) saveBtn.textContent = "Guardar pregunta";
  }

  function editQuestion(id) {
    const question = loadLocalQuestions().find(q => q.id === id);
    if (!question) return;

    editingId = id;
    $("#registroTema").value = question.tema || "";
    $("#registroPregunta").value = question.pregunta || "";
    $("#opcionA").value = question.opciones?.[0] || "";
    $("#opcionB").value = question.opciones?.[1] || "";
    $("#opcionC").value = question.opciones?.[2] || "";
    $("#opcionD").value = question.opciones?.[3] || "";
    $("#registroCorrecta").value = String(question.correcta ?? 0);
    $("#registroExplicacion").value = question.explicacion || "";
    $("#registroFundamento").value = question.fundamento || "";
    $("#guardarPreguntaBtn").textContent = "Actualizar pregunta";

    activateTab("registrar");
  }

  function deleteQuestion(id) {
    const question = loadLocalQuestions().find(q => q.id === id);
    if (!question) return;

    const ok = confirm("¿Eliminar esta pregunta del banco personal?");
    if (!ok) return;

    saveLocalQuestions(loadLocalQuestions().filter(q => q.id !== id));
    renderRegistros();
  }

  function renderRegistros() {
    renderTopicFilter();
    renderBanco();
    renderJsonPreview();
    renderRepaso();
  }

  function renderTopicFilter() {
    const select = $("#filtroTema");
    if (!select) return;

    const previous = select.value;
    const topics = getAllTopics();

    select.innerHTML = `<option value="">Todos los temas</option>` + topics.map(topic => {
      const selected = topic === previous ? "selected" : "";
      return `<option value="${escapeHtml(topic)}" ${selected}>${escapeHtml(topic)}</option>`;
    }).join("");
  }

  function renderBanco() {
    const container = $("#bancoPersonal");
    if (!container) return;

    const search = normalize($("#buscarPregunta")?.value || "");
    let questions = loadLocalQuestions();

    if (currentFilter) {
      questions = questions.filter(q => q.tema === currentFilter);
    }

    if (search) {
      questions = questions.filter(q =>
        normalize(q.pregunta).includes(search) ||
        normalize(q.tema).includes(search) ||
        normalize(q.fundamento).includes(search)
      );
    }

    if (!questions.length) {
      container.innerHTML = `<div class="empty-state">Aún no hay preguntas capturadas para este filtro.</div>`;
      return;
    }

    container.innerHTML = questions.map(q => `
      <article class="question-card">
        <div class="question-card-header">
          <span class="badge">${escapeHtml(q.tema || "Sin tema")}</span>
          <span class="question-id">${escapeHtml(q.id)}</span>
        </div>
        <h3>${escapeHtml(q.pregunta)}</h3>
        <ol type="A">
          ${(q.opciones || []).map((op, index) => `
            <li class="${Number(q.correcta) === index ? "correct-answer" : ""}">
              ${escapeHtml(op)}
            </li>
          `).join("")}
        </ol>
        ${q.explicacion ? `<p><strong>Explicación:</strong> ${escapeHtml(q.explicacion)}</p>` : ""}
        ${q.fundamento ? `<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>` : ""}
        <div class="card-actions">
          <button type="button" class="secondary-btn" data-edit="${escapeHtml(q.id)}">Editar</button>
          <button type="button" class="danger-btn" data-delete="${escapeHtml(q.id)}">Eliminar</button>
        </div>
      </article>
    `).join("");

    $all("[data-edit]", container).forEach(btn => btn.addEventListener("click", () => editQuestion(btn.dataset.edit)));
    $all("[data-delete]", container).forEach(btn => btn.addEventListener("click", () => deleteQuestion(btn.dataset.delete)));
  }

  function renderJsonPreview() {
    const preview = $("#jsonPreview");
    if (!preview) return;
    preview.value = JSON.stringify(loadLocalQuestions(), null, 2);
  }

  function exportJson() {
    const data = JSON.stringify(loadLocalQuestions(), null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `preguntas-locales-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    renderJsonPreview();
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) {
          alert("El archivo debe contener un arreglo de preguntas JSON.");
          return;
        }

        const cleaned = imported.map((q, index) => ({
          id: q.id ? String(q.id) : "import-" + String(index + 1).padStart(3, "0"),
          origen: q.origen || "importado",
          tema: safeText(q.tema),
          pregunta: safeText(q.pregunta),
          opciones: Array.isArray(q.opciones) ? q.opciones.slice(0, 4).map(safeText) : [],
          correcta: Number(q.correcta ?? 0),
          explicacion: safeText(q.explicacion),
          fundamento: safeText(q.fundamento),
          creado_en: q.creado_en || new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        })).filter(q => q.tema && q.pregunta && q.opciones.length === 4);

        const existing = loadLocalQuestions();
        const byId = new Map(existing.map(q => [q.id, q]));

        cleaned.forEach(q => {
          let id = q.id;
          if (byId.has(id)) {
            id = nextImportId(byId);
            q.id = id;
          }
          byId.set(id, q);
        });

        saveLocalQuestions(Array.from(byId.values()));
        event.target.value = "";
        renderRegistros();
        activateTab("banco");
        alert(`Importación completada: ${cleaned.length} pregunta(s).`);
      } catch (error) {
        console.error(error);
        alert("No se pudo importar el JSON. Revisa el formato.");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function nextImportId(map) {
    let counter = 1;
    let id = "";
    do {
      id = "import-" + String(counter).padStart(3, "0");
      counter++;
    } while (map.has(id));
    return id;
  }

  function renderRepaso() {
    const container = $("#repasoNuevas");
    if (!container) return;

    const questions = loadLocalQuestions();
    if (!questions.length) {
      container.innerHTML = `<div class="empty-state">Aún no hay preguntas nuevas para repasar.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="repaso-card">
        <h3>Modo repaso solo de nuevas preguntas</h3>
        <p>Tienes <strong>${questions.length}</strong> pregunta(s) capturada(s) en tu banco personal.</p>
        <button type="button" class="primary-btn" id="iniciarRepasoLocalBtn">Iniciar repaso</button>
      </div>
      <div id="repasoLocalQuiz"></div>
    `;

    $("#iniciarRepasoLocalBtn").addEventListener("click", startLocalQuiz);
  }

  function startLocalQuiz() {
    const questions = shuffle(loadLocalQuestions());
    let index = 0;
    let score = 0;

    const quiz = $("#repasoLocalQuiz");

    function renderQuestion() {
      const q = questions[index];
      if (!q) {
        quiz.innerHTML = `
          <div class="question-card">
            <h3>Resultado</h3>
            <p>Obtuviste <strong>${score}</strong> de <strong>${questions.length}</strong>.</p>
            <button type="button" class="primary-btn" id="reiniciarRepasoLocalBtn">Reiniciar</button>
          </div>
        `;
        $("#reiniciarRepasoLocalBtn").addEventListener("click", startLocalQuiz);
        return;
      }

      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>
          <div class="local-options">
            ${q.opciones.map((op, i) => `
              <button type="button" class="option-btn" data-answer="${i}">
                ${String.fromCharCode(65 + i)}) ${escapeHtml(op)}
              </button>
            `).join("")}
          </div>
          <div id="localFeedback"></div>
        </div>
      `;

      $all("[data-answer]", quiz).forEach(btn => {
        btn.addEventListener("click", () => {
          const selected = Number(btn.dataset.answer);
          const correct = Number(q.correcta);

          $all("[data-answer]", quiz).forEach(b => b.disabled = true);
          if (selected === correct) {
            score++;
            btn.classList.add("ok");
          } else {
            btn.classList.add("bad");
            const right = $(`[data-answer="${correct}"]`, quiz);
            if (right) right.classList.add("ok");
          }

          $("#localFeedback").innerHTML = `
            <div class="feedback-box">
              <p><strong>${selected === correct ? "Correcto" : "Incorrecto"}</strong></p>
              ${q.explicacion ? `<p>${escapeHtml(q.explicacion)}</p>` : ""}
              ${q.fundamento ? `<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>` : ""}
              <button type="button" class="primary-btn" id="siguienteLocalBtn">Siguiente</button>
            </div>
          `;

          $("#siguienteLocalBtn").addEventListener("click", () => {
            index++;
            renderQuestion();
          });
        });
      });
    }

    renderQuestion();
  }

  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.RegistrosPreguntas = {
    getQuestions: loadLocalQuestions,
    saveQuestions: saveLocalQuestions,
    open: showRegistrosView,
    close: closeRegistrosView,
    storageKey: STORAGE_KEY
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureButton();
    ensureView();
  });
})();
