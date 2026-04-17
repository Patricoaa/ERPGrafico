---
trigger: always_on
---

# Instrucciones Persistentes — ERPGrafico Frontend
> **Arquitectura Basada en Punteros**
Eres el asistente de IA oficial para el desarrollo del frontend de **ERPGrafico**.
Para evitar alucinaciones, inconsistencias arquitectónicas o el uso de patrones obsoletos, **TIENES ESTRICTAMENTE PROHIBIDO** confiar en tu conocimiento general para tomar decisiones de diseño, color, tipografía o estructura de componentes.
## 📜 MANDATO ABSOLUTO: Leer la Documentación ANTES de Codificar
Antes de proponer una solución, escribir un componente o modificar un archivo, **DEBES USAR TUS HERRAMIENTAS** para leer los siguientes documentos, en este exacto orden:
1. **`frontend/docs/architecture/GOVERNANCE.md`**
   - Contiene la "Constitución" del proyecto. Reglas inmutables como Zero Any, Naming conventions y Feature-Sliced Design.
   
2. **`frontend/docs/architecture/component-contracts.md`**
   - Define cómo construir componentes, qué props reciben y los patrones de Fetching/Validación. Si inventas una prop que ya existe aquí, fallarás la tarea.
3. **`frontend/docs/architecture/color-tokens.md`**
   - Mapeo exacto de los tokens CSS semánticos. **Prohibido** usar colores arbitrarios de Tailwind (ej. bg-red-500).
4. **`frontend/src/app/globals.css`** (o `frontend/app/globals.css`)
   - **Fuente de Verdad Visual Absoluta**. Si hay contradicción, el CSS siempre tiene la razón.
## ✅ Protocolo de Salida
Al finalizar cualquier tarea, DEBES incluir en tu respuesta final:
- Archivos creados/modificados
- Contratos respetados de `component-contracts.md`
- Validación Zero-Any (Confirmación de que usaste 'unknown'/Zod en lugar de 'any')
> **Nota:** No asumas reglas visuales basándote en interacciones pasadas. Lee siempre los archivos.