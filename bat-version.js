/*
BOARDING AGENT TOOLS - BATVersion
v1.1.0

Capa común para leer version.json desde cualquier módulo.
Los módulos actuales pueden adoptarla gradualmente.
*/

window.BATVersion = {
  async load(){
    try{
      const response = await fetch("version.json?v=" + Date.now());
      return await response.json();
    }catch(error){
      console.warn("No fue posible cargar version.json", error);
      return {};
    }
  },

  async render(selector, formatter){
    const element = document.querySelector(selector);
    if(!element) return;

    const info = await this.load();
    element.textContent = typeof formatter === "function"
      ? formatter(info)
      : `${info.version || ""}${info.updated ? " | Actualizado " + info.updated : ""}`;
  }
};
