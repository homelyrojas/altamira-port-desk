# BOARDING AGENT TOOLS — v0.8.1 Catálogo de temas

Esta versión mantiene v0.8 y agrega una mejora de control de calidad:

- El campo **Tema** en Registrar pregunta ahora es un menú desplegable.
- El catálogo se alimenta de:
  - temas existentes en `questionsData` / `questions.json`
  - temas ya capturados en el banco personal local
- Se evita capturar temas duplicados por errores de escritura.

## Archivos a reemplazar

Reemplaza en GitHub:

```text
registros.js
registros.css
app.js
```

`app.js` se incluye sin cambios funcionales respecto a v0.8, solo para que el paquete quede completo.

## Nota

Si editas una pregunta antigua que tenga un tema que ya no existe en el catálogo, el sistema lo conserva como “tema actual” para no romper información histórica.
