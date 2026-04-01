---
trigger: always_on
---

# Contexto del proyecto — ERPGrafico Frontend

## Stack
- Framework: Next.js 15 + TypeScript
- UI: shadcn/ui + Tailwind CSS
- Backend: Django REST API (dockerizado)
- Estado: refactorización activa según roadmap en docs/refactoring-roadmap.md

## Fuentes de verdad — LEER ANTES DE CUALQUIER TAREA

Antes de ejecutar cualquier tarea que involucre decisiones de UI,
componentes, colores, tipografía, espaciado o experiencia de usuario,
debes consultar en este orden:

1. `docs/design-system/MASTER.md`
   Fuente principal generada por la skill ui-ux-pro-max.
   Contiene paleta, tipografía, estilos y reglas UX para este proyecto.
   Si no existe aún, detente e indica que debe generarse primero.

2. `docs/design-system/pages/[modulo].md` (si existe)
   Override específico del módulo en el que estás trabajando.
   Sus reglas tienen prioridad sobre el MASTER.

3. `docs/architecture/color-tokens.md`
   Tokens semánticos definidos, valores en light/dark, casos de uso.

4. `docs/architecture/component-contracts.md`
   API pública de componentes shared: props permitidas y prohibidas.

5. `docs/architecture/adr/`
   Decisiones de arquitectura ya tomadas. Nunca contradijas un ADR
   sin documentar un nuevo ADR que lo superseda.

## Reglas permanentes de desarrollo

### Componentes
- Nunca modificar archivos en `components/ui/` directamente.
  Si necesitas una variante, extiéndela en `components/shared/`.
- Nunca exponer `className` como prop de layout en componentes shared.
  Usa `variant` con valores explícitos.
- Todo componente shared debe tener: estado loading, empty y error.
- Usar siempre `components/shared/EmptyState` para estados vacíos.
- Usar siempre `components/shared/StatusBadge` para estados de entidad.

### Colores
- Nunca usar colores hardcoded de Tailwind para semántica
  (emerald, blue, amber, red) en componentes.
- Usar siempre los tokens semánticos definidos en color-tokens.md:
  text-success, text-warning, text-destructive, text-info, bg-background.

### TypeScript
- Nunca usar `any` en props de componentes nuevos o refactorizados.
- `initialData` siempre tipado con interface derivada del Zod schema.
- Errores en catch: usar `error instanceof Error ? error.message : String(error)`.

### Imports
- Nunca importar `@/lib/api` directamente en componentes UI.
  Toda llamada a API va en un hook dentro del feature correspondiente.
- Usar siempre el barrel export del módulo, no rutas relativas largas.

## Protocolo de uso de la skill ui-ux-pro-max

Cuando una tarea involucre decisiones visuales, sigue este protocolo:

### PASO 1 — Consultar la skill ANTES de implementar
## Protocolo de uso de la skill ui-ux-pro-max

Cuando una tarea involucre decisiones visuales, sigue este protocolo:

### PASO 1 — Verificar si ya existe la fuente de verdad

Antes de ejecutar cualquier comando de la skill, verifica:

#### Para design system general:
- Si `docs/design-system/MASTER.md` existe → léelo y úsalo. NO regeneres.
- Si NO existe → ejecuta:
python skills/ui-ux-pro-max/scripts/search.py 
"ERP enterprise admin dashboard business management SaaS" 
--design-system --persist -p "ERPGrafico" -f markdown



#### Para consultas específicas (color, ux, typography):
Estas SÍ se ejecutan siempre que necesites profundizar en un tema
que el MASTER.md no cubre con suficiente detalle:
python skills/ui-ux-pro-max/scripts/search.py 
"[keyword]" --domain [color|ux|typography|chart]
Guarda el output relevante en el ADR correspondiente —
no como archivo separado, para evitar fuentes de verdad duplicadas.

### Regla general
El MASTER.md se genera UNA sola vez y se regenera únicamente si:
- La skill tiene una actualización mayor
- El tipo de producto cambia significativamente
- Se toma una decisión explícita documentada en un ADR que lo justifique

Nunca regeneres el MASTER.md como parte de una tarea rutinaria.
### PASO 2 — Documentar la decisión
Después de consultar la skill y antes de implementar, crea o actualiza
el ADR correspondiente en `docs/architecture/adr/`.

Formato del ADR:
---
# ADR-[número]: [Título de la decisión]
Fecha: YYYY-MM-DD
Sprint: [número]
Estado: Activo

## Contexto
[Por qué esta decisión era necesaria]

## Fuente
Skill ui-ux-pro-max — comando ejecutado:
[comando exacto que se ejecutó]
Output relevante: [extracto clave del output]

## Decisión
[Qué se decidió exactamente]

## Implementación
[Dónde se implementó: archivos, tokens, componentes]

## Qué NO está permitido
[Anti-patrones explícitos derivados de esta decisión]

## Consecuencias
[Qué implica esta decisión para el futuro]
---

### PASO 3 — Implementar usando las fuentes de verdad
Solo después de los pasos 1 y 2, ejecuta la implementación.

### PASO 4 — Actualizar documentación afectada
Si la implementación modifica o extiende algo documentado, actualiza:
- `docs/architecture/color-tokens.md` si se agregaron tokens
- `docs/architecture/component-contracts.md` si se modificó una API
- `docs/design-system/MASTER.md` NUNCA se edita manualmente —
  solo se regenera con la skill

## Al terminar cada tarea
Genera un resumen con:
- Archivos modificados
- Documentación creada o actualizada
- Decisiones tomadas que requieren un nuevo ADR
- Problemas encontrados que no estaban en el roadmap
