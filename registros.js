/*
  BOARDING AGENT TOOLS - Registros v0.8.1
  localStorage + Exportación/Importación JSON + Tipos de pregunta + Relacionar columnas + Preguntas abiertas + Catálogo de temas

  Tipos soportados en esta versión:
  - multiple: Opción múltiple A/B/C/D
  - vf: Verdadero / Falso
  - concepto: Elegir concepto desde lista desplegable
  - relacionar: Relacionar columnas
  - abierta: Pregunta abierta con evaluación por palabras clave

  Instalación:
  1) Reemplaza tu archivo registros.js actual por este.
  2) Reemplaza registros.css por la versión v0.8.
  3) Conserva en app.js el botón:
     <button class="pill" onclick="RegistrosPreguntas.open()">Registros</button>
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

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function getAllTopics() {
    const byNormalized = new Map();

    function addTopic(topic) {
      const clean = safeText(topic);
      if (!clean) return;

      const key = normalize(clean);
      if (!byNormalized.has(key)) {
        byNormalized.set(key, clean);
      }
    }

    if (Array.isArray(window.questionsData)) {
      window.questionsData.forEach(q => addTopic(q.tema));
    }

    loadLocalQuestions().forEach(q => addTopic(q.tema));

    return Array.from(byNormalized.values()).sort((a, b) => a.localeCompare(b));
  }

  function renderRegistroTemaOptions(selectedValue = "") {
    const select = $("#registroTema");
    if (!select) return;

    const topics = getAllTopics();
    const selected = safeText(selectedValue || select.value);
    const selectedExists = topics.some(topic => normalize(topic) === normalize(selected));

    let html = `<option value="">Selecciona un tema...</option>`;

    if (selected && !selectedExists) {
      html += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} — tema actual</option>`;
    }

    html += topics.map(topic => {
      const isSelected = normalize(topic) === normalize(selected) ? "selected" : "";
      return `<option value="${escapeHtml(topic)}" ${isSelected}>${escapeHtml(topic)}</option>`;
    }).join("");

    select.innerHTML = html;
  }

  function questionTypeLabel(tipo) {
    const labels = {
      multiple: "Opción múltiple",
      vf: "Verdadero / Falso",
      concepto: "Elegir concepto",
      relacionar: "Relacionar columnas",
      abierta: "Pregunta abierta"
    };
    return labels[tipo] || "Opción múltiple";
  }

  function normalizeQuestionForExam(question) {
    const tipo = question.tipo || "multiple";

    if (tipo === "vf") {
      return {
        ...question,
        tipo,
        opciones: ["Verdadero", "Falso"],
        correcta: Number(question.correcta || 0)
      };
    }

    if (tipo === "concepto") {
      const conceptos = Array.isArray(question.conceptos) ? question.conceptos : question.opciones || [];
      return {
        ...question,
        tipo,
        conceptos,
        opciones: conceptos,
        correcta: typeof question.correcta === "number"
          ? question.correcta
          : conceptos.findIndex(c => normalize(c) === normalize(question.correcta))
      };
    }

    if (tipo === "relacionar") {
      const izquierda = Array.isArray(question.izquierda) ? question.izquierda : [];
      const derecha = Array.isArray(question.derecha) ? question.derecha : [];
      const respuestas = question.respuestas && typeof question.respuestas === "object"
        ? question.respuestas
        : izquierda.reduce((acc, item, index) => {
            acc[item] = derecha[index] || "";
            return acc;
          }, {});

      return {
        ...question,
        tipo,
        izquierda,
        derecha,
        respuestas,
        opciones: derecha
      };
    }

    if (tipo === "abierta") {
      const palabrasClave = Array.isArray(question.palabras_clave)
        ? question.palabras_clave
        : Array.isArray(question.palabrasClave)
          ? question.palabrasClave
          : [];

      return {
        ...question,
        tipo,
        respuesta_esperada: question.respuesta_esperada || question.respuestaEsperada || "",
        palabras_clave: palabrasClave,
        minimo_coincidencia: Number(question.minimo_coincidencia || question.minimoCoincidencia || 60)
      };
    }

    return {
      ...question,
      tipo: "multiple",
      opciones: Array.isArray(question.opciones) ? question.opciones : [],
      correcta: Number(question.correcta || 0)
    };
  }

  function getQuestionsForExam() {
    return loadLocalQuestions().map(normalizeQuestionForExam);
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
    const existing = $("#" + BUTTON_ID);
    if (existing) {
      existing.addEventListener("click", showRegistrosView);
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "pill";
    button.textContent = "Registros";
    button.addEventListener("click", showRegistrosView);

    const possibleContainers = [
      "#examButtons",
      "#examMenu",
      ".exam-buttons",
      ".exam-actions",
      ".quiz-actions",
      ".toolbar",
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
            Tipo de pregunta
            <select id="registroTipo" required>
              <option value="multiple">Opción múltiple</option>
              <option value="vf">Verdadero / Falso</option>
              <option value="concepto">Elegir concepto</option>
              <option value="relacionar">Relacionar columnas</option>
              <option value="abierta">Pregunta abierta</option>
            </select>
          </label>

          <label>
            Tema
            <select id="registroTema" required>
              <option value="">Selecciona un tema...</option>
            </select>
            <small class="field-help">Catálogo tomado del banco oficial y del banco personal para evitar duplicados por typo.</small>
          </label>

          <label>
            Pregunta
            <textarea id="registroPregunta" rows="3" placeholder="Escribe la pregunta completa" required></textarea>
          </label>

          <div id="multipleFields" class="tipo-fields">
            <div class="opciones-grid">
              <label>Opción A <input id="opcionA" type="text"></label>
              <label>Opción B <input id="opcionB" type="text"></label>
              <label>Opción C <input id="opcionC" type="text"></label>
              <label>Opción D <input id="opcionD" type="text"></label>
            </div>

            <label>
              Respuesta correcta
              <select id="registroCorrectaMultiple">
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
              </select>
            </label>
          </div>

          <div id="vfFields" class="tipo-fields bat-hidden">
            <label>
              Respuesta correcta
              <select id="registroCorrectaVF">
                <option value="0">Verdadero</option>
                <option value="1">Falso</option>
              </select>
            </label>
          </div>

          <div id="conceptoFields" class="tipo-fields bat-hidden">
            <label>
              Conceptos disponibles
              <textarea id="registroConceptos" rows="4" placeholder="Escribe un concepto por línea. Ejemplo:
Despacho
Patente
Rol de tripulación
Bill of Lading"></textarea>
            </label>

            <label>
              Concepto correcto
              <input id="registroConceptoCorrecto" type="text" placeholder="Debe coincidir con uno de los conceptos capturados">
            </label>
          </div>

          <div id="relacionarFields" class="tipo-fields bat-hidden">
            <p class="registros-note">
              Captura ambas columnas en el mismo orden. La línea 1 de la columna izquierda se relaciona con la línea 1 de la columna derecha, y así sucesivamente.
            </p>

            <div class="opciones-grid">
              <label>
                Columna izquierda
                <textarea id="registroRelacionarIzquierda" rows="5" placeholder="Ejemplo:
Capitanía de Puerto
INM
SENASICA"></textarea>
              </label>

              <label>
                Columna derecha
                <textarea id="registroRelacionarDerecha" rows="5" placeholder="Ejemplo:
Despacho de embarcaciones
Control migratorio
Sanidad agropecuaria"></textarea>
              </label>
            </div>
          </div>

          <div id="abiertaFields" class="tipo-fields bat-hidden">
            <p class="registros-note">
              La evaluación será local y aproximada: compara palabras clave contra la respuesta del usuario y calcula un porcentaje de coincidencia.
            </p>

            <label>
              Respuesta esperada
              <textarea id="registroRespuestaEsperada" rows="4" placeholder="Escribe la respuesta modelo o respuesta esperada"></textarea>
            </label>

            <label>
              Palabras clave
              <textarea id="registroPalabrasClave" rows="4" placeholder="Escribe una palabra o frase clave por línea. Ejemplo:
autorización
Capitanía de Puerto
zarpar
embarcación"></textarea>
            </label>

            <label>
              Coincidencia mínima para aprobar (%)
              <input id="registroMinimoCoincidencia" type="number" min="1" max="100" value="60">
            </label>
          </div>

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
          <label>
            Tipo
            <select id="filtroTipo">
              <option value="">Todos los tipos</option>
              <option value="multiple">Opción múltiple</option>
              <option value="vf">Verdadero / Falso</option>
              <option value="concepto">Elegir concepto</option>
              <option value="relacionar">Relacionar columnas</option>
              <option value="abierta">Pregunta abierta</option>
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

    const target = $("#content") || $("#examen") || $("#exam") || $("main") || document.body;
    target.appendChild(view);

    $("#cerrarRegistrosBtn", view).addEventListener("click", closeRegistrosView);
    $("#registroPreguntaForm", view).addEventListener("submit", handleSubmit);
    $("#limpiarFormularioBtn", view).addEventListener("click", clearForm);
    $("#registroTipo", view).addEventListener("change", updateTipoFields);
    $("#filtroTema", view).addEventListener("change", e => {
      currentFilter = e.target.value;
      renderBanco();
    });
    $("#filtroTipo", view).addEventListener("change", renderBanco);
    $("#buscarPregunta", view).addEventListener("input", renderBanco);
    $("#exportarJsonBtn", view).addEventListener("click", exportJson);
    $("#importarJsonInput", view).addEventListener("change", importJson);

    $all(".tab-btn", view).forEach(btn => {
      btn.addEventListener("click", () => activateTab(btn.dataset.tab));
    });

    renderRegistroTemaOptions();
    updateTipoFields();
  }

  function updateTipoFields() {
    const tipo = $("#registroTipo")?.value || "multiple";

    $("#multipleFields")?.classList.toggle("bat-hidden", tipo !== "multiple");
    $("#vfFields")?.classList.toggle("bat-hidden", tipo !== "vf");
    $("#conceptoFields")?.classList.toggle("bat-hidden", tipo !== "concepto");
    $("#relacionarFields")?.classList.toggle("bat-hidden", tipo !== "relacionar");
    $("#abiertaFields")?.classList.toggle("bat-hidden", tipo !== "abierta");
  }

  function activateTab(tabName) {
    const view = $("#" + VIEW_ID);
    $all(".tab-btn", view).forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
    $all(".tab-panel", view).forEach(panel => panel.classList.toggle("active", panel.id === "tab-" + tabName));

    if (tabName === "banco") renderBanco();
    if (tabName === "json") renderJsonPreview();
    if (tabName === "repaso") renderRepaso();
  }

  function buildQuestionFromForm() {
    const tipo = $("#registroTipo").value || "multiple";

    const base = {
      id: editingId || nextLocalId(),
      origen: "localStorage",
      tipo,
      tema: safeText($("#registroTema").value),
      pregunta: safeText($("#registroPregunta").value),
      explicacion: safeText($("#registroExplicacion").value),
      fundamento: safeText($("#registroFundamento").value),
      creado_en: new Date().toISOString()
    };

    if (tipo === "vf") {
      return {
        ...base,
        opciones: ["Verdadero", "Falso"],
        correcta: Number($("#registroCorrectaVF").value)
      };
    }

    if (tipo === "concepto") {
      const conceptos = safeText($("#registroConceptos").value)
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      const correctaTexto = safeText($("#registroConceptoCorrecto").value);
      const correctaIndex = conceptos.findIndex(c => normalize(c) === normalize(correctaTexto));

      return {
        ...base,
        conceptos,
        opciones: conceptos,
        correcta: correctaIndex >= 0 ? correctaIndex : 0,
        correcta_texto: correctaTexto
      };
    }

    if (tipo === "relacionar") {
      const izquierda = safeText($("#registroRelacionarIzquierda").value)
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      const derecha = safeText($("#registroRelacionarDerecha").value)
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      const respuestas = izquierda.reduce((acc, item, index) => {
        acc[item] = derecha[index] || "";
        return acc;
      }, {});

      return {
        ...base,
        izquierda,
        derecha,
        respuestas
      };
    }

    if (tipo === "abierta") {
      const palabrasClave = safeText($("#registroPalabrasClave").value)
        .split("
")
        .map(safeText)
        .filter(Boolean);

      return {
        ...base,
        respuesta_esperada: safeText($("#registroRespuestaEsperada").value),
        palabras_clave: palabrasClave,
        minimo_coincidencia: Number($("#registroMinimoCoincidencia").value || 60)
      };
    }

    return {
      ...base,
      opciones: [
        safeText($("#opcionA").value),
        safeText($("#opcionB").value),
        safeText($("#opcionC").value),
        safeText($("#opcionD").value)
      ],
      correcta: Number($("#registroCorrectaMultiple").value)
    };
  }

  function validateQuestion(question) {
    if (!question.tema || !question.pregunta) {
      return "Faltan datos obligatorios: tema y pregunta.";
    }

    if (question.tipo === "multiple") {
      if (!Array.isArray(question.opciones) || question.opciones.length !== 4 || question.opciones.some(o => !o)) {
        return "En opción múltiple debes capturar las cuatro opciones.";
      }
    }

    if (question.tipo === "vf") {
      if (![0, 1].includes(Number(question.correcta))) {
        return "Selecciona Verdadero o Falso como respuesta correcta.";
      }
    }

    if (question.tipo === "concepto") {
      if (!Array.isArray(question.conceptos) || question.conceptos.length < 2) {
        return "En elegir concepto debes capturar al menos dos conceptos.";
      }

      const correctaTexto = safeText(question.correcta_texto);
      const existe = question.conceptos.some(c => normalize(c) === normalize(correctaTexto));
      if (!correctaTexto || !existe) {
        return "El concepto correcto debe coincidir con uno de los conceptos disponibles.";
      }
    }

    if (question.tipo === "relacionar") {
      if (!Array.isArray(question.izquierda) || !Array.isArray(question.derecha)) {
        return "En relacionar columnas debes capturar ambas columnas.";
      }

      if (question.izquierda.length < 2 || question.derecha.length < 2) {
        return "En relacionar columnas debes capturar al menos dos elementos por columna.";
      }

      if (question.izquierda.length !== question.derecha.length) {
        return "Ambas columnas deben tener la misma cantidad de líneas.";
      }
    }

    if (question.tipo === "abierta") {
      if (!question.respuesta_esperada) {
        return "En pregunta abierta debes capturar una respuesta esperada.";
      }

      if (!Array.isArray(question.palabras_clave) || question.palabras_clave.length < 2) {
        return "En pregunta abierta debes capturar al menos dos palabras clave.";
      }

      if (Number(question.minimo_coincidencia) < 1 || Number(question.minimo_coincidencia) > 100) {
        return "La coincidencia mínima debe estar entre 1 y 100.";
      }
    }

    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();

    const question = buildQuestionFromForm();
    const error = validateQuestion(question);

    if (error) {
      alert(error);
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

    renderRegistroTemaOptions();
    updateTipoFields();
  }

  function editQuestion(id) {
    const question = loadLocalQuestions().find(q => q.id === id);
    if (!question) return;

    const normalized = normalizeQuestionForExam(question);

    editingId = id;
    $("#registroTipo").value = normalized.tipo || "multiple";
    renderRegistroTemaOptions(normalized.tema || "");
    $("#registroPregunta").value = normalized.pregunta || "";
    $("#registroExplicacion").value = normalized.explicacion || "";
    $("#registroFundamento").value = normalized.fundamento || "";

    updateTipoFields();

    if (normalized.tipo === "vf") {
      $("#registroCorrectaVF").value = String(normalized.correcta ?? 0);
    } else if (normalized.tipo === "concepto") {
      const conceptos = normalized.conceptos || normalized.opciones || [];
      $("#registroConceptos").value = conceptos.join("\n");
      $("#registroConceptoCorrecto").value = conceptos[normalized.correcta] || normalized.correcta_texto || "";
    } else if (normalized.tipo === "relacionar") {
      $("#registroRelacionarIzquierda").value = (normalized.izquierda || []).join("\n");
      $("#registroRelacionarDerecha").value = (normalized.derecha || []).join("\n");
    } else if (normalized.tipo === "abierta") {
      $("#registroRespuestaEsperada").value = normalized.respuesta_esperada || "";
      $("#registroPalabrasClave").value = (normalized.palabras_clave || []).join("
");
      $("#registroMinimoCoincidencia").value = String(normalized.minimo_coincidencia || 60);
    } else {
      $("#opcionA").value = normalized.opciones?.[0] || "";
      $("#opcionB").value = normalized.opciones?.[1] || "";
      $("#opcionC").value = normalized.opciones?.[2] || "";
      $("#opcionD").value = normalized.opciones?.[3] || "";
      $("#registroCorrectaMultiple").value = String(normalized.correcta ?? 0);
    }

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
    renderRegistroTemaOptions();
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
    const tipoFilter = $("#filtroTipo")?.value || "";

    let questions = loadLocalQuestions().map(normalizeQuestionForExam);

    if (currentFilter) {
      questions = questions.filter(q => q.tema === currentFilter);
    }

    if (tipoFilter) {
      questions = questions.filter(q => q.tipo === tipoFilter);
    }

    if (search) {
      questions = questions.filter(q =>
        normalize(q.pregunta).includes(search) ||
        normalize(q.tema).includes(search) ||
        normalize(q.fundamento).includes(search) ||
        normalize(questionTypeLabel(q.tipo)).includes(search)
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
          <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
          <span class="question-id">${escapeHtml(q.id)}</span>
        </div>
        <h3>${escapeHtml(q.pregunta)}</h3>
        ${renderQuestionPreview(q)}
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

  function renderQuestionPreview(q) {
    if (q.tipo === "concepto") {
      const conceptos = q.conceptos || q.opciones || [];
      return `
        <p><strong>Concepto correcto:</strong> ${escapeHtml(conceptos[q.correcta] || q.correcta_texto || "")}</p>
        <ol>
          ${conceptos.map((c, index) => `
            <li class="${Number(q.correcta) === index ? "correct-answer" : ""}">
              ${escapeHtml(c)}
            </li>
          `).join("")}
        </ol>
      `;
    }

    if (q.tipo === "relacionar") {
      const izquierda = q.izquierda || [];
      const respuestas = q.respuestas || {};
      return `
        <div class="relation-preview">
          ${izquierda.map(item => `
            <div class="relation-preview-row">
              <strong>${escapeHtml(item)}</strong>
              <span>→</span>
              <span>${escapeHtml(respuestas[item] || "")}</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    if (q.tipo === "abierta") {
      return `
        <p><strong>Respuesta esperada:</strong> ${escapeHtml(q.respuesta_esperada || "")}</p>
        <p><strong>Coincidencia mínima:</strong> ${escapeHtml(q.minimo_coincidencia || 60)}%</p>
        <p><strong>Palabras clave:</strong> ${(q.palabras_clave || []).map(escapeHtml).join(", ")}</p>
      `;
    }

    return `
      <ol type="A">
        ${(q.opciones || []).map((op, index) => `
          <li class="${Number(q.correcta) === index ? "correct-answer" : ""}">
            ${escapeHtml(op)}
          </li>
        `).join("")}
      </ol>
    `;
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

        const cleaned = imported
          .map(cleanImportedQuestion)
          .filter(Boolean);

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

  function cleanImportedQuestion(q, index) {
    const tipo = q.tipo || "multiple";

    const base = {
      id: q.id ? String(q.id) : "import-" + String(index + 1).padStart(3, "0"),
      origen: q.origen || "importado",
      tipo,
      tema: safeText(q.tema),
      pregunta: safeText(q.pregunta),
      explicacion: safeText(q.explicacion),
      fundamento: safeText(q.fundamento),
      creado_en: q.creado_en || new Date().toISOString(),
      actualizado_en: new Date().toISOString()
    };

    if (!base.tema || !base.pregunta) return null;

    if (tipo === "vf") {
      return {
        ...base,
        opciones: ["Verdadero", "Falso"],
        correcta: Number(q.correcta ?? 0)
      };
    }

    if (tipo === "concepto") {
      const conceptos = Array.isArray(q.conceptos) ? q.conceptos.map(safeText).filter(Boolean) :
        Array.isArray(q.opciones) ? q.opciones.map(safeText).filter(Boolean) : [];

      if (conceptos.length < 2) return null;

      return {
        ...base,
        conceptos,
        opciones: conceptos,
        correcta: Number(q.correcta ?? 0),
        correcta_texto: safeText(q.correcta_texto || conceptos[Number(q.correcta ?? 0)])
      };
    }

    if (tipo === "relacionar") {
      const izquierda = Array.isArray(q.izquierda) ? q.izquierda.map(safeText).filter(Boolean) : [];
      const derecha = Array.isArray(q.derecha) ? q.derecha.map(safeText).filter(Boolean) : [];

      if (izquierda.length < 2 || derecha.length < 2 || izquierda.length !== derecha.length) return null;

      const respuestas = q.respuestas && typeof q.respuestas === "object"
        ? q.respuestas
        : izquierda.reduce((acc, item, i) => {
            acc[item] = derecha[i] || "";
            return acc;
          }, {});

      return {
        ...base,
        izquierda,
        derecha,
        respuestas
      };
    }

    if (tipo === "abierta") {
      const palabrasClave = Array.isArray(q.palabras_clave) ? q.palabras_clave.map(safeText).filter(Boolean) :
        Array.isArray(q.palabrasClave) ? q.palabrasClave.map(safeText).filter(Boolean) : [];

      if (!safeText(q.respuesta_esperada || q.respuestaEsperada) || palabrasClave.length < 2) return null;

      return {
        ...base,
        respuesta_esperada: safeText(q.respuesta_esperada || q.respuestaEsperada),
        palabras_clave: palabrasClave,
        minimo_coincidencia: Number(q.minimo_coincidencia || q.minimoCoincidencia || 60)
      };
    }

    const opciones = Array.isArray(q.opciones) ? q.opciones.slice(0, 4).map(safeText) : [];
    if (opciones.length !== 4 || opciones.some(o => !o)) return null;

    return {
      ...base,
      tipo: "multiple",
      opciones,
      correcta: Number(q.correcta ?? 0)
    };
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

    const questions = getQuestionsForExam();
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
    const questions = shuffle(getQuestionsForExam());
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

      if (q.tipo === "concepto") {
        renderConceptQuestion(q);
      } else if (q.tipo === "relacionar") {
        renderRelacionarQuestion(q);
      } else if (q.tipo === "abierta") {
        renderAbiertaQuestion(q);
      } else {
        renderOptionQuestion(q);
      }
    }

    function renderOptionQuestion(q) {
      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>
          <div class="local-options">
            ${q.opciones.map((op, i) => `
              <button type="button" class="option-btn" data-answer="${i}">
                ${q.tipo === "vf" ? "" : String.fromCharCode(65 + i) + ") "}${escapeHtml(op)}
              </button>
            `).join("")}
          </div>
          <div id="localFeedback"></div>
        </div>
      `;

      $all("[data-answer]", quiz).forEach(btn => {
        btn.addEventListener("click", () => {
          const selected = Number(btn.dataset.answer);
          checkAnswer(q, selected);
        });
      });
    }

    function renderRelacionarQuestion(q) {
      const izquierda = q.izquierda || [];
      const derecha = shuffle(q.derecha || []);
      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>
          <div class="relation-quiz">
            ${izquierda.map((item, i) => `
              <label class="relation-row">
                <span>${escapeHtml(item)}</span>
                <select data-relation-left="${escapeHtml(item)}">
                  <option value="">Selecciona...</option>
                  ${derecha.map(op => `<option value="${escapeHtml(op)}">${escapeHtml(op)}</option>`).join("")}
                </select>
              </label>
            `).join("")}
          </div>
          <button type="button" class="primary-btn" id="validarRelacionarBtn">Validar</button>
          <div id="localFeedback"></div>
        </div>
      `;

      $("#validarRelacionarBtn").addEventListener("click", () => {
        const selects = $all("[data-relation-left]", quiz);
        const respuestasUsuario = {};
        let completas = true;

        selects.forEach(select => {
          if (!select.value) completas = false;
          respuestasUsuario[select.dataset.relationLeft] = select.value;
        });

        if (!completas) {
          alert("Relaciona todos los elementos antes de validar.");
          return;
        }

        checkRelacionarAnswer(q, respuestasUsuario);
      });
    }

    function renderAbiertaQuestion(q) {
      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>
          <label class="concept-select-label">
            Escribe tu respuesta
            <textarea id="respuestaAbiertaLocal" rows="5" placeholder="Redacta tu respuesta con tus propias palabras"></textarea>
          </label>
          <button type="button" class="primary-btn" id="validarAbiertaBtn">Validar respuesta</button>
          <div id="localFeedback"></div>
        </div>
      `;

      $("#validarAbiertaBtn").addEventListener("click", () => {
        const respuesta = safeText($("#respuestaAbiertaLocal").value);
        if (!respuesta) {
          alert("Escribe una respuesta antes de validar.");
          return;
        }
        checkAbiertaAnswer(q, respuesta);
      });
    }

    function renderConceptQuestion(q) {
      const conceptos = q.conceptos || q.opciones || [];
      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>
          <label class="concept-select-label">
            Selecciona el concepto correcto
            <select id="conceptAnswer">
              <option value="">Selecciona...</option>
              ${conceptos.map((concepto, i) => `<option value="${i}">${escapeHtml(concepto)}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="primary-btn" id="validarConceptoBtn">Validar</button>
          <div id="localFeedback"></div>
        </div>
      `;

      $("#validarConceptoBtn").addEventListener("click", () => {
        const selected = $("#conceptAnswer").value;
        if (selected === "") {
          alert("Selecciona un concepto.");
          return;
        }
        checkAnswer(q, Number(selected));
      });
    }

    function evaluateOpenAnswer(q, userText) {
      const keywords = q.palabras_clave || [];
      const normalizedAnswer = normalize(userText);
      const hits = keywords.filter(keyword => normalizedAnswer.includes(normalize(keyword)));
      const total = keywords.length || 1;
      const percent = Math.round((hits.length / total) * 100);
      const minimum = Number(q.minimo_coincidencia || 60);

      return {
        percent,
        minimum,
        hits,
        missing: keywords.filter(keyword => !hits.includes(keyword)),
        passed: percent >= minimum
      };
    }

    function checkAbiertaAnswer(q, userText) {
      const result = evaluateOpenAnswer(q, userText);
      if (result.passed) score++;

      const textarea = $("#respuestaAbiertaLocal");
      if (textarea) textarea.disabled = true;

      const feedback = $("#localFeedback");
      feedback.innerHTML = `
        <div class="feedback-box">
          <p><strong>${result.passed ? "Probablemente correcto" : "Revisar respuesta"}</strong></p>
          <p>Coincidencia de palabras clave: <strong>${result.percent}%</strong> / mínimo requerido: <strong>${result.minimum}%</strong>.</p>
          <p><strong>Palabras encontradas:</strong> ${result.hits.length ? result.hits.map(escapeHtml).join(", ") : "Ninguna"}</p>
          ${result.missing.length ? `<p><strong>Palabras pendientes:</strong> ${result.missing.map(escapeHtml).join(", ")}</p>` : ""}
          <p><strong>Respuesta esperada:</strong><br>${escapeHtml(q.respuesta_esperada || "")}</p>
          ${q.explicacion ? `<p>${escapeHtml(q.explicacion)}</p>` : ""}
          ${q.fundamento ? `<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>` : ""}
          <button type="button" class="primary-btn" id="siguienteLocalBtn">Siguiente</button>
        </div>
      `;

      $("#siguienteLocalBtn").addEventListener("click", () => {
        index++;
        renderQuestion();
      });
    }

    function checkRelacionarAnswer(q, respuestasUsuario) {
      const respuestas = q.respuestas || {};
      const izquierda = q.izquierda || [];
      const total = izquierda.length;
      const correctas = izquierda.filter(item => normalize(respuestasUsuario[item]) === normalize(respuestas[item])).length;
      const isCorrect = correctas === total;

      if (isCorrect) score++;

      $all("[data-relation-left]", quiz).forEach(select => {
        const left = select.dataset.relationLeft;
        select.disabled = true;
        select.classList.add(normalize(select.value) === normalize(respuestas[left]) ? "ok" : "bad");
      });

      const feedback = $("#localFeedback");
      feedback.innerHTML = `
        <div class="feedback-box">
          <p><strong>${isCorrect ? "Correcto" : "Incorrecto"}</strong></p>
          <p>Relaciones correctas: <strong>${correctas}</strong> de <strong>${total}</strong>.</p>
          ${!isCorrect ? `
            <div class="relation-preview">
              ${izquierda.map(item => `
                <div class="relation-preview-row">
                  <strong>${escapeHtml(item)}</strong>
                  <span>→</span>
                  <span>${escapeHtml(respuestas[item] || "")}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}
          ${q.explicacion ? `<p>${escapeHtml(q.explicacion)}</p>` : ""}
          ${q.fundamento ? `<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>` : ""}
          <button type="button" class="primary-btn" id="siguienteLocalBtn">Siguiente</button>
        </div>
      `;

      $("#siguienteLocalBtn").addEventListener("click", () => {
        index++;
        renderQuestion();
      });
    }

    function checkAnswer(q, selected) {
      const correct = Number(q.correcta);
      const isCorrect = selected === correct;

      if (isCorrect) score++;

      $all("[data-answer]", quiz).forEach(b => {
        b.disabled = true;
        if (Number(b.dataset.answer) === correct) b.classList.add("ok");
        if (Number(b.dataset.answer) === selected && !isCorrect) b.classList.add("bad");
      });

      const select = $("#conceptAnswer");
      if (select) select.disabled = true;

      const feedback = $("#localFeedback");
      feedback.innerHTML = `
        <div class="feedback-box">
          <p><strong>${isCorrect ? "Correcto" : "Incorrecto"}</strong></p>
          ${!isCorrect ? `<p><strong>Respuesta correcta:</strong> ${escapeHtml((q.opciones || q.conceptos || [])[correct] || "")}</p>` : ""}
          ${q.explicacion ? `<p>${escapeHtml(q.explicacion)}</p>` : ""}
          ${q.fundamento ? `<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>` : ""}
          <button type="button" class="primary-btn" id="siguienteLocalBtn">Siguiente</button>
        </div>
      `;

      $("#siguienteLocalBtn").addEventListener("click", () => {
        index++;
        renderQuestion();
      });
    }

    renderQuestion();
  }

  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  window.RegistrosPreguntas = {
    getQuestions: loadLocalQuestions,
    getQuestionsForExam,
    normalizeQuestionForExam,
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
