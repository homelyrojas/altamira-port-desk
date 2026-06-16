# Boarding Agent Tools v0.6.0 — Arribos & Zarpes

Módulo estático para GitHub Pages. No usa Python, backend ni SQLite.

## Funcionalidad

- Carga el Excel vigente de **Arribos y Zarpes**.
- Reemplaza la información anterior, sin histórico.
- Guarda solo la base vigente en `localStorage` del navegador.
- Permite buscar por buque, viaje, IMO o folio.
- Genera texto de Arribo / Salida listo para copiar.
- Usa **FOLIO** como identificador operativo de cada registro.

## Archivos incluidos

- `arribos-zarpes.html`
- `arribos-zarpes.css`
- `arribos-zarpes.js`
- `index_patch_snippet.html`

## Instalación en GitHub Pages

1. Sube los tres archivos principales a la raíz del repositorio donde está `index.html`.
2. En tu `index.html`, agrega un botón o liga hacia:

```html
<a href="./arribos-zarpes.html">🚢 Arribos & Zarpes</a>
```

3. Publica cambios en GitHub Pages.
4. Abre la página y carga el Excel vigente.

## Nota importante

Este módulo usa SheetJS desde CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

Esto requiere internet cuando se abre el módulo. Si más adelante se desea operación 100% offline, se puede descargar `xlsx.full.min.js`, guardarlo localmente como `vendor/xlsx.full.min.js` y cambiar la ruta del script.
