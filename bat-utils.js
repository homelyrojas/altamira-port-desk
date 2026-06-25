window.BATUtils = {
  clean(value){ return String(value ?? "").replace(/\r/g, "").trim(); },
  normalize(value){
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },
  escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  },
  readJson(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; } },
  writeJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
  todayIso(){ return new Date().toISOString().slice(0, 10); }
};
