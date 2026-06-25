/*
BOARDING AGENT TOOLS v1.4.0
BATCatalog

Componente utilitario para consultas tipo catálogo:
- normalización de texto
- filtrado por texto
- filtrado por selección
- filtrado por checks booleanos

La adopción será gradual en Prestadores, Directorio y futuros módulos.
*/

window.BATCatalog = {
  normalize(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  includesText(item, query){
    const cleanQuery = this.normalize(query);
    if (!cleanQuery) return true;
    return this.normalize(Object.values(item || {}).join(" ")).includes(cleanQuery);
  },

  matchesSelected(value, selectedValue){
    return !selectedValue || value === selectedValue;
  }
};
