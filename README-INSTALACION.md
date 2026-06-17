# BOARDING AGENT TOOLS — Módulo Registros

Este paquete agrega al módulo de Examen un botón **Registros** para capturar nuevas preguntas usando `localStorage`, sin modificar directamente tu `questions.json`.

## Archivos incluidos

- `registros.js`
- `registros.css`
- `index-demo.html`

## Instalación rápida en GitHub

Copia `registros.js` y `registros.css` en la carpeta principal de tu proyecto.

En tu `index.html`, agrega dentro del `<head>`:

```html
<link rel="stylesheet" href="registros.css">
```

Antes de cerrar el `</body>`, agrega:

```html
<script src="registros.js"></script>
```

## Botón Registros

El script intentará agregar automáticamente el botón **Registros** dentro de alguno de estos contenedores si existen:

```html
#examButtons
#examMenu
.exam-buttons
.exam-actions
.quiz-actions
#examen
#exam
```

Si quieres control total, agrega manualmente este botón junto a:

Examen diario / Simulador completo / Repasar errores / Mi progreso

```html
<button id="btnRegistros" type="button" class="exam-btn">Registros</button>
```

## Funciones incluidas

- Registrar pregunta
- Banco personal
- Exportar JSON
- Importar JSON
- Editar preguntas capturadas
- Eliminar preguntas
- Filtrar por tema
- Modo repaso solo de nuevas preguntas

## Integración con el examen principal

Las preguntas locales se pueden consultar desde JavaScript con:

```js
window.RegistrosPreguntas.getQuestions()
```

Esto devuelve el arreglo de preguntas capturadas localmente.

## Nota importante

Las preguntas se guardan en el navegador/dispositivo donde se capturan. Para llevarlas a otro equipo o incorporarlas al banco oficial, usa **Exportar JSON**.
