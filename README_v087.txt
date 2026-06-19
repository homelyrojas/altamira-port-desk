BOARDING AGENT TOOLS - Registros v0.8.7

Cambios incluidos:
- Búsqueda global en Registros > Búsqueda: banco oficial questions.json + banco personal localStorage.
- Permite editar preguntas del banco oficial creando una corrección local con el mismo ID.
- Al generar questions.json completo, las correcciones locales reemplazan las preguntas oficiales con el mismo ID.
- Preguntas locales nuevas siguen agregándose al final con ID numérico nuevo al exportar.
- Se conserva soporte para Completar con fichas.
- Opción múltiple soporta hasta 6 incisos: A, B, C, D, E y F.

Archivo a reemplazar en GitHub:
- registros.js

Recomendación:
- Actualizar CACHE_NAME en service-worker.js para forzar la publicación de la nueva versión.
