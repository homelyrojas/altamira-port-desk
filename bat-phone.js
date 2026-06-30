(function(){
  function safeText(value){
    return String(value || "").trim();
  }

  function escapeHtml(text){
    return String(text ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "\"":"&quot;",
      "'":"&#039;"
    }[c]));
  }

  function getPhoneDigits(phone){
    return safeText(phone).replace(/\D/g, "");
  }

  function formatPhoneDisplay(phone){
    const text = safeText(phone).replace(/\*/g, " ");
    const digits = getPhoneDigits(phone);

    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    if (digits.length === 12 && digits.startsWith("52")) {
      return `+52 (${digits.slice(2, 5)}) ${digits.slice(5, 8)}-${digits.slice(8)}`;
    }

    return text;
  }

  function formatPhoneHref(phone){
    const digits = getPhoneDigits(phone);

    if (digits.length === 10) return `tel:+52${digits}`;
    if (digits.length === 12 && digits.startsWith("52")) return `tel:+${digits}`;
    if (digits.length) return `tel:${digits}`;

    return "";
  }

  function formatPhoneHtml(phone){
    const display = formatPhoneDisplay(phone);
    const href = formatPhoneHref(phone);

    if (!display) return "";
    if (!href) return escapeHtml(display);

    return `<a class="phone-link" href="${escapeHtml(href)}">${escapeHtml(display)}</a>`;
  }

  window.BATPhone = {
    getPhoneDigits,
    formatPhoneDisplay,
    formatPhoneHref,
    formatPhoneHtml
  };

  window.formatProvider = function(item){
    const altaTexto = isAltaMSC(item)
      ? `✅ Alta en MSC: ${getMxCode(item)}`
      : `⚪ Alta en MSC: No registrada`;

    return `${item.denominacion || ""}

Servicio: ${item.servicio || ""}
${altaTexto}
Dirección: ${item.direccion || ""}
Teléfono: ${formatPhoneDisplay(item.telefono || "")}
Contacto: ${item.contacto || ""}
Email: ${item.email || ""}`;
  };

  window.formatProviderHtml = function(item){
    const altaTexto = isAltaMSC(item)
      ? `✅ Alta en MSC: ${escapeHtml(getMxCode(item))}`
      : `⚪ Alta en MSC: No registrada`;

    return `${escapeHtml(item.denominacion || "")}

Servicio: ${escapeHtml(item.servicio || "")}
${altaTexto}
Dirección: ${escapeHtml(item.direccion || "")}
Teléfono: ${formatPhoneHtml(item.telefono || "")}
Contacto: ${escapeHtml(item.contacto || "")}
Email: ${escapeHtml(item.email || "")}`;
  };

  window.renderMatches = function(){
    const query = $("searchInput")?.value || "";
    const resultBox = $("resultBox");
    const matchesBox = $("matchesBox");
    const selectedService = $("serviceFilter")?.value || "";
    const onlyMsc = Boolean($("onlyMscCheck")?.checked);
    if (!resultBox || !matchesBox) return;

    const matches = getMatches(query);
    matchesBox.innerHTML = "";
    renderResultCounter(matches);

    if (!query.trim() && !selectedService && !onlyMsc) {
      resultBox.textContent = "Selecciona un servicio o escribe una palabra clave para buscar.";
      lastResult = "";
      return;
    }

    if (!matches.length) {
      resultBox.textContent = "No se encontraron coincidencias.";
      lastResult = "";
      return;
    }

    matches.forEach(item => {
      const card = document.createElement("button");
      card.className = "result-card";

      const altaBadge = isAltaMSC(item)
        ? `<span class="badge-ok">✅ Alta MSC ${escapeHtml(getMxCode(item))}</span>`
        : `<span class="badge-neutral">⚪ Sin Alta MSC</span>`;

      card.innerHTML = `
        <strong>${escapeHtml(item.denominacion || "")}</strong>
        <small>${escapeHtml(item.servicio || "")}</small>
        <small>${altaBadge}</small>
        <small>${escapeHtml(item.contacto || "")}</small>
      `;

      card.onclick = () => {
        lastResult = formatProvider(item);
        resultBox.innerHTML = formatProviderHtml(item);
      };

      matchesBox.appendChild(card);
    });
  };
})();
