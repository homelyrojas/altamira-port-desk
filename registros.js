/*
  BOARDING AGENT TOOLS - Registros v0.8.6
  localStorage + Exportación/Importación JSON + Tipos de pregunta + Relacionar columnas + Preguntas abiertas + Catálogo de temas + Opción múltiple flexible + Exportación inteligente + Búsqueda

  Tipos soportados en esta versión:
  - multiple: Opción múltiple A/B/C/D
  - vf: Verdadero / Falso
  - concepto: Elegir concepto desde lista desplegable
  - relacionar: Relacionar columnas
  - abierta: Pregunta abierta con evaluación por palabras clave
  - completar_fichas: Completar espacios seleccionando fichas en orden

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

    /*
      Fuente 1: banco oficial expuesto desde app.js.
      Nota: app.js usa let questionsData, así que registros.js no puede leerlo
      como window.questionsData a menos que app.js lo exponga.
    */
    if (Array.isArray(window.questionsData)) {
      window.questionsData.forEach(q => addTopic(q.tema));
    }

    /*
      Fuente 2: copia oficial de respaldo guardada por app.js.
      Este es el camino más estable para GitHub Pages + PWA.
    */
    try {
      const officialTopics = JSON.parse(localStorage.getItem("bat_temas_oficiales_v1") || "[]");
      if (Array.isArray(officialTopics)) {
        officialTopics.forEach(addTopic);
      }
    } catch (error) {
      console.warn("No se pudieron leer temas oficiales desde localStorage", error);
    }

    /*
      Fuente 3: banco personal local.
    */
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
      abierta: "Pregunta abierta",
      completar_fichas: "Completar con fichas"
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

    if (tipo === "completar_fichas") {
      const opciones = Array.isArray(question.opciones) ? question.opciones.map(safeText).filter(Boolean) : [];
      const correctas = Array.isArray(question.correctas) ? question.correctas.map(safeText).filter(Boolean) : [];

      return {
        ...question,
        tipo,
        opciones,
        correctas,
        espacios: Number(question.espacios || correctas.length || 0)
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
        <button type="button" class="tab-btn" data-tab="busqueda">Búsqueda</button>
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
              <option value="completar_fichas">Completar con fichas</option>
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
              <label>Opción E <input id="opcionE" type="text"></label>
              <label>Opción F <input id="opcionF" type="text"></label>
            </div>

            <label>
              Respuesta correcta
              <select id="registroCorrectaMultiple">
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
                <option value="4">E</option>
                <option value="5">F</option>
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

          <div id="completarFichasFields" class="tipo-fields bat-hidden">
            <p class="registros-note">
              Usa marcadores en la pregunta como {1}, {2}, {3}. El alumno seleccionará fichas en orden para completar los espacios.
            </p>

            <label>
              Fichas disponibles
              <textarea id="registroFichasOpciones" rows="6" placeholder="Escribe una ficha por línea. Ejemplo:
Capitanía de Puerto
Despacho
Mercancías Peligrosas
48 horas
INCOTERMS"></textarea>
            </label>

            <label>
              Respuestas correctas en orden
              <textarea id="registroFichasCorrectas" rows="4" placeholder="Escribe la respuesta correcta de cada espacio, una por línea. Ejemplo:
Despacho
Capitanía de Puerto
48 horas"></textarea>
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
              <option value="completar_fichas">Completar con fichas</option>
            </select>
          </label>
          <input id="buscarPregunta" type="search" placeholder="Buscar texto dentro de preguntas">
        </div>
        <div id="bancoPersonal"></div>
      </div>

      <div class="tab-panel" id="tab-busqueda">
        <div class="search-manager">
          <label>
            Buscar pregunta
            <input id="busquedaPreguntaInput" type="search" placeholder="Escribe una palabra, frase, tema, fundamento o respuesta...">
          </label>
          <div class="search-actions">
            <button type="button" class="primary-btn" id="buscarPreguntaBtn">Buscar</button>
            <button type="button" class="secondary-btn" id="limpiarBusquedaBtn">Limpiar búsqueda</button>
          </div>
          <p class="registros-note">
            Busca dentro del banco personal para localizar preguntas capturadas y corregir sintaxis, respuesta, palabras clave o fundamento.
          </p>
        </div>
        <div id="busquedaResultados" class="search-results"></div>
      </div>

      <div class="tab-panel" id="tab-json">
        <div class="json-actions">
          <button type="button" class="primary-btn" id="exportarJsonBtn">Exportar JSON</button>
          <button type="button" class="secondary-btn" id="copiarJsonBtn">📋 Copiar JSON</button>
          <button type="button" class="secondary-btn" id="generarQuestionsJsonBtn">📦 Generar questions.json completo</button>
          <label class="file-btn">
            Importar JSON
            <input id="importarJsonInput" type="file" accept=".json,application/json">
          </label>
        </div>

        <div class="export-mode-box">
          <strong>📄 Archivo destino: questions.json</strong>
          <p>Exporta este JSON y pégalo en GitHub reemplazando <strong>questions.json</strong>.</p>
          <p class="registros-note">Recomendación: conserva una copia de respaldo antes de reemplazarlo.</p>
          <p id="jsonCopyStatus" class="copy-status" aria-live="polite"></p>
        </div>

        <textarea id="jsonPreview" rows="16" readonly placeholder="Aquí aparecerá el JSON exportable"></textarea>
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
    $("#buscarPreguntaBtn", view).addEventListener("click", renderBusqueda);
    $("#limpiarBusquedaBtn", view).addEventListener("click", clearBusqueda);
    $("#busquedaPreguntaInput", view).addEventListener("input", renderBusqueda);
    $("#exportarJsonBtn", view).addEventListener("click", exportJson);
    $("#copiarJsonBtn", view).addEventListener("click", copyJsonPreview);
    $("#generarQuestionsJsonBtn", view).addEventListener("click", generateFullQuestionsJson);
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
    $("#completarFichasFields")?.classList.toggle("bat-hidden", tipo !== "completar_fichas");
  }

  function activateTab(tabName) {
    const view = $("#" + VIEW_ID);
    $all(".tab-btn", view).forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
    $all(".tab-panel", view).forEach(panel => panel.classList.toggle("active", panel.id === "tab-" + tabName));

    if (tabName === "banco") renderBanco();
    if (tabName === "busqueda") renderBusqueda();
    if (tabName === "json") {
      setCopyStatus("");
      renderJsonPreview();
    }
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
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      return {
        ...base,
        respuesta_esperada: safeText($("#registroRespuestaEsperada").value),
        palabras_clave: palabrasClave,
        minimo_coincidencia: Number($("#registroMinimoCoincidencia").value || 60)
      };
    }

    if (tipo === "completar_fichas") {
      const opciones = safeText($("#registroFichasOpciones").value)
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      const correctas = safeText($("#registroFichasCorrectas").value)
        .split("\n")
        .map(safeText)
        .filter(Boolean);

      return {
        ...base,
        opciones,
        correctas,
        espacios: correctas.length
      };
    }

    const rawOptions = [
      safeText($("#opcionA").value),
      safeText($("#opcionB").value),
      safeText($("#opcionC").value),
      safeText($("#opcionD").value),
      safeText($("#opcionE").value),
      safeText($("#opcionF").value)
    ];

    const selectedOriginalIndex = Number($("#registroCorrectaMultiple").value);
    const originalToFilteredIndex = {};
    const opciones = [];

    rawOptions.forEach((option, originalIndex) => {
      if (option) {
        originalToFilteredIndex[originalIndex] = opciones.length;
        opciones.push(option);
      }
    });

    return {
      ...base,
      opciones,
      correcta: originalToFilteredIndex[selectedOriginalIndex] ?? -1
    };
  }

  function validateQuestion(question) {
    if (!question.tema || !question.pregunta) {
      return "Faltan datos obligatorios: tema y pregunta.";
    }

    if (question.tipo === "multiple") {
      if (!Array.isArray(question.opciones) || question.opciones.length < 2 || question.opciones.length > 6 || question.opciones.some(o => !o)) {
        return "En opción múltiple debes capturar mínimo 2 y máximo 6 opciones.";
      }

      if (Number(question.correcta) < 0 || Number(question.correcta) >= question.opciones.length) {
        return "Selecciona como respuesta correcta una opción que sí esté capturada.";
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

    if (question.tipo === "completar_fichas") {
      if (!Array.isArray(question.opciones) || question.opciones.length < 2) {
        return "En completar con fichas debes capturar al menos dos fichas disponibles.";
      }

      if (!Array.isArray(question.correctas) || question.correctas.length < 1) {
        return "En completar con fichas debes capturar al menos una respuesta correcta.";
      }

      const faltantes = question.correctas.filter(correcta =>
        !question.opciones.some(opcion => normalize(opcion) === normalize(correcta))
      );

      if (faltantes.length) {
        return "Todas las respuestas correctas deben existir dentro de las fichas disponibles.";
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
      $("#registroPalabrasClave").value = (normalized.palabras_clave || []).join("\n");
      $("#registroMinimoCoincidencia").value = String(normalized.minimo_coincidencia || 60);
    } else if (normalized.tipo === "completar_fichas") {
      $("#registroFichasOpciones").value = (normalized.opciones || []).join("\n");
      $("#registroFichasCorrectas").value = (normalized.correctas || []).join("\n");
    } else {
      $("#opcionA").value = normalized.opciones?.[0] || "";
      $("#opcionB").value = normalized.opciones?.[1] || "";
      $("#opcionC").value = normalized.opciones?.[2] || "";
      $("#opcionD").value = normalized.opciones?.[3] || "";
      $("#opcionE").value = normalized.opciones?.[4] || "";
      $("#opcionF").value = normalized.opciones?.[5] || "";
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
    renderBusqueda();
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

    if (q.tipo === "completar_fichas") {
      return `
        <p><strong>Fichas disponibles:</strong> ${(q.opciones || []).map(escapeHtml).join(" | ")}</p>
        <p><strong>Orden correcto:</strong> ${(q.correctas || []).map(escapeHtml).join(" → ")}</p>
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


  function clearBusqueda() {
    const input = $("#busquedaPreguntaInput");
    const results = $("#busquedaResultados");

    if (input) input.value = "";
    if (results) {
      results.innerHTML = `<div class="empty-state">Escribe una palabra o frase para buscar en tu banco personal.</div>`;
    }
  }

  function getQuestionSearchText(q) {
    const parts = [
      q.id,
      q.tipo,
      questionTypeLabel(q.tipo),
      q.tema,
      q.pregunta,
      q.explicacion,
      q.fundamento,
      q.respuesta_esperada,
      q.respuestaEsperada,
      q.palabras_clave,
      q.palabrasClave,
      q.correcta_texto
    ];

    if (Array.isArray(q.opciones)) parts.push(...q.opciones);
    if (Array.isArray(q.conceptos)) parts.push(...q.conceptos);
    if (Array.isArray(q.correctas)) parts.push(...q.correctas);
    if (Array.isArray(q.palabrasClave)) parts.push(...q.palabrasClave);
    if (Array.isArray(q.palabras_clave)) parts.push(...q.palabras_clave);

    if (Array.isArray(q.pares)) {
      q.pares.forEach(pair => parts.push(pair.izquierda, pair.derecha));
    }

    if (Array.isArray(q.relaciones)) {
      q.relaciones.forEach(pair => parts.push(pair.izquierda, pair.derecha));
    }

    return normalize(parts.filter(Boolean).join(" "));
  }

  function renderBusqueda() {
    const container = $("#busquedaResultados");
    const input = $("#busquedaPreguntaInput");

    if (!container || !input) return;

    const term = normalize(input.value);

    if (!term) {
      container.innerHTML = `<div class="empty-state">Escribe una palabra o frase para buscar en tu banco personal.</div>`;
      return;
    }

    const questions = loadLocalQuestions()
      .map(normalizeQuestionForExam)
      .filter(q => getQuestionSearchText(q).includes(term));

    if (!questions.length) {
      container.innerHTML = `<div class="empty-state">No encontramos coincidencias en el banco personal.</div>`;
      return;
    }

    container.innerHTML = `
      <p class="registros-note"><strong>${questions.length}</strong> resultado(s) encontrado(s).</p>
      ${questions.map(q => `
        <article class="question-card search-result-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema || "Sin tema")}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span class="question-id">${escapeHtml(q.id)}</span>
          </div>
          <h3>${highlightSearchTerm(q.pregunta, input.value)}</h3>
          ${renderSearchMiniPreview(q)}
          <div class="card-actions">
            <button type="button" class="primary-btn" data-search-edit="${escapeHtml(q.id)}">Editar pregunta</button>
            <button type="button" class="danger-btn" data-search-delete="${escapeHtml(q.id)}">Eliminar</button>
          </div>
        </article>
      `).join("")}
    `;

    $all("[data-search-edit]", container).forEach(btn => {
      btn.addEventListener("click", () => editQuestion(btn.dataset.searchEdit));
    });

    $all("[data-search-delete]", container).forEach(btn => {
      btn.addEventListener("click", () => deleteQuestion(btn.dataset.searchDelete));
    });
  }

  function highlightSearchTerm(text, term) {
    const cleanText = escapeHtml(text || "");
    const rawTerm = safeText(term);

    if (!rawTerm) return cleanText;

    const escapedTerm = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    try {
      return cleanText.replace(new RegExp(`(${escapedTerm})`, "gi"), "<mark>$1</mark>");
    } catch (error) {
      return cleanText;
    }
  }

  function renderSearchMiniPreview(q) {
    const details = [];

    if (q.tipo === "abierta") {
      details.push(`<p><strong>Respuesta esperada:</strong> ${escapeHtml(q.respuesta_esperada || q.respuestaEsperada || "Sin respuesta esperada registrada.")}</p>`);
      details.push(`<p><strong>Palabras clave:</strong> ${escapeHtml(Array.isArray(q.palabrasClave) ? q.palabrasClave.join(" | ") : q.palabras_clave || q.palabrasClave || "Sin palabras clave registradas.")}</p>`);
    } else if (q.tipo === "completar_fichas") {
      details.push(`<p><strong>Orden correcto:</strong> ${escapeHtml((q.correctas || []).join(" → "))}</p>`);
    } else if (q.tipo === "relacionar") {
      details.push(`<p><strong>Relacionar columnas:</strong> ${(q.pares || q.relaciones || q.izquierda || []).length} elemento(s) capturado(s).</p>`);
    } else {
      const correctText = (q.opciones || q.conceptos || [])[Number(q.correcta)] || "";
      details.push(`<p><strong>Respuesta correcta:</strong> ${escapeHtml(correctText)}</p>`);
    }

    if (q.fundamento) {
      details.push(`<p><strong>Fundamento:</strong> ${escapeHtml(q.fundamento)}</p>`);
    }

    return details.join("");
  }

  function getOfficialQuestionsForExport() {
    if (Array.isArray(window.questionsData)) {
      return window.questionsData;
    }

    return [];
  }

  function cleanQuestionForOfficialBank(question, indexOffset = 0) {
    const cleaned = { ...question };

    delete cleaned.origen;
    delete cleaned.creado_en;
    delete cleaned.actualizado_en;

    if (String(cleaned.id || "").startsWith("local-") || String(cleaned.id || "").startsWith("import-")) {
      cleaned.id = indexOffset;
    }

    return cleaned;
  }

  function buildFullQuestionsJson() {
    const officialQuestions = getOfficialQuestionsForExport();
    const localQuestions = loadLocalQuestions();

    const nextIdBase = officialQuestions.reduce((max, q) => {
      const id = Number(q.id);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);

    const cleanedLocalQuestions = localQuestions.map((q, index) => {
      return cleanQuestionForOfficialBank(q, nextIdBase + index + 1);
    });

    return [
      ...officialQuestions,
      ...cleanedLocalQuestions
    ];
  }

  function renderJsonPreview(mode = "local") {
    const preview = $("#jsonPreview");
    if (!preview) return;

    if (mode === "full") {
      preview.value = JSON.stringify(buildFullQuestionsJson(), null, 2);
      setCopyStatus("questions.json completo generado. Puedes copiarlo y reemplazar el archivo en GitHub.");
      return;
    }

    preview.value = JSON.stringify(loadLocalQuestions(), null, 2);
  }

  function setCopyStatus(message) {
    const status = $("#jsonCopyStatus");
    if (!status) return;

    status.textContent = message || "";
  }

  async function copyJsonPreview() {
    const preview = $("#jsonPreview");
    if (!preview) return;

    const text = preview.value || "";

    if (!text.trim()) {
      setCopyStatus("No hay JSON para copiar.");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        preview.focus();
        preview.select();
        document.execCommand("copy");
        window.getSelection()?.removeAllRanges();
      }

      setCopyStatus("✅ JSON copiado al portapapeles.");
    } catch (error) {
      console.error("No se pudo copiar JSON", error);
      setCopyStatus("No se pudo copiar automáticamente. Selecciona el texto y copia manualmente.");
    }
  }

  function generateFullQuestionsJson() {
    renderJsonPreview("full");
  }

  function exportJson() {
    const data = $("#jsonPreview")?.value || JSON.stringify(buildFullQuestionsJson(), null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `questions-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setCopyStatus("Archivo JSON exportado. Si lo vas a subir a GitHub, renómbralo como questions.json.");
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

    if (tipo === "completar_fichas") {
      const opciones = Array.isArray(q.opciones) ? q.opciones.map(safeText).filter(Boolean) : [];
      const correctas = Array.isArray(q.correctas) ? q.correctas.map(safeText).filter(Boolean) : [];

      if (opciones.length < 2 || correctas.length < 1) return null;

      return {
        ...base,
        opciones,
        correctas,
        espacios: Number(q.espacios || correctas.length)
      };
    }

    const opciones = Array.isArray(q.opciones) ? q.opciones.slice(0, 6).map(safeText).filter(Boolean) : [];
    if (opciones.length < 2 || opciones.length > 6) return null;

    const correcta = Number(q.correcta ?? 0);
    if (correcta < 0 || correcta >= opciones.length) return null;

    return {
      ...base,
      tipo: "multiple",
      opciones,
      correcta
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
      } else if (q.tipo === "completar_fichas") {
        renderFichaQuestion(q);
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

    function renderFichaQuestion(q) {
      const opciones = q.opciones || [];
      const espacios = Number(q.espacios || q.correctas?.length || 0);
      const selected = [];

      function paintSpaces() {
        for (let i = 0; i < espacios; i++) {
          const slot = $(`#fichaLocalSpace${i}`, quiz);
          if (slot) slot.textContent = selected[i] || "__________";
        }
      }

      quiz.innerHTML = `
        <div class="question-card">
          <div class="question-card-header">
            <span class="badge">${escapeHtml(q.tema)}</span>
            <span class="badge badge-soft">${escapeHtml(questionTypeLabel(q.tipo))}</span>
            <span>${index + 1} / ${questions.length}</span>
          </div>
          <h3>${escapeHtml(q.pregunta)}</h3>

          <div class="relation-preview">
            ${Array.from({ length: espacios }).map((_, i) => `
              <div class="relation-preview-row">
                <strong>Espacio ${i + 1}</strong>
                <span>→</span>
                <span id="fichaLocalSpace${i}">__________</span>
              </div>
            `).join("")}
          </div>

          <div class="local-options">
            ${opciones.map(op => `
              <button type="button" class="option-btn ficha-local-option" data-ficha-value="${escapeHtml(op)}">
                ${escapeHtml(op)}
              </button>
            `).join("")}
          </div>

          <div class="form-actions">
            <button type="button" class="secondary-btn" id="borrarFichaLocalBtn">↩️ Borrar última ficha</button>
            <button type="button" class="secondary-btn" id="reiniciarFichaLocalBtn">🔄 Reiniciar</button>
            <button type="button" class="primary-btn" id="validarFichaLocalBtn">Validar respuesta</button>
          </div>

          <div id="localFeedback"></div>
        </div>
      `;

      $all(".ficha-local-option", quiz).forEach(btn => {
        btn.addEventListener("click", () => {
          if (selected.length >= espacios) return;
          selected.push(btn.dataset.fichaValue);
          paintSpaces();
        });
      });

      $("#borrarFichaLocalBtn", quiz).addEventListener("click", () => {
        selected.pop();
        paintSpaces();
      });

      $("#reiniciarFichaLocalBtn", quiz).addEventListener("click", () => {
        selected.splice(0, selected.length);
        paintSpaces();
      });

      $("#validarFichaLocalBtn", quiz).addEventListener("click", () => {
        if (selected.length < espacios) {
          alert("Completa todos los espacios antes de validar.");
          return;
        }
        checkFichaAnswer(q, selected);
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

    function checkFichaAnswer(q, selected) {
      const correctas = q.correctas || [];
      const isCorrect = correctas.length === selected.length &&
        correctas.every((item, i) => normalize(item) === normalize(selected[i]));

      if (isCorrect) score++;

      $all(".ficha-local-option", quiz).forEach(btn => {
        btn.disabled = true;
      });

      const feedback = $("#localFeedback");
      feedback.innerHTML = `
        <div class="feedback-box">
          <p><strong>${isCorrect ? "Correcto" : "Incorrecto"}</strong></p>
          <p><strong>Tu respuesta:</strong><br>${escapeHtml(selected.join(" → "))}</p>
          ${!isCorrect ? `<p><strong>Respuesta correcta:</strong><br>${escapeHtml(correctas.join(" → "))}</p>` : ""}
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
