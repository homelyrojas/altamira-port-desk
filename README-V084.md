# BOARDING AGENT TOOLS — v0.8.4 Exportación inteligente

Esta versión mejora el apartado **Exportar / Importar JSON**.

## Nuevas funciones

- Botón **📋 Copiar JSON**
- Botón **📦 Generar questions.json completo**
- Mensaje claro del archivo destino:
  - `questions.json`
- Exportación más segura para reemplazar el banco oficial en GitHub.

## Flujo recomendado

1. Entra a **Examen > Registros > Exportar / Importar JSON**.
2. Da clic en **📦 Generar questions.json completo**.
3. Da clic en **📋 Copiar JSON**.
4. En GitHub abre `questions.json`.
5. Reemplaza todo el contenido del archivo.
6. Guarda cambios / commit.

## Archivos a reemplazar

```text
app.js
registros.js
registros.css
```

## Nota

El botón **Exportar JSON** descarga un archivo con fecha. Si lo vas a subir a GitHub, renómbralo como:

```text
questions.json
```
