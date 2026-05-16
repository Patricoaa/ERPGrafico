# Plan de Implementación — Audit de Tipografía

**Fecha inicio:** 2026-05-15  
**Objetivo:** Eliminar deuda tipográfica, unificar contratos, crear escala documentada

---

## Estado de tareas

Cada tarea tiene: contexto, archivo(s) afectado(s), cambio exacto, criterio de aceptación.

---

## FASE 1 — Fixes de infraestructura (críticos, ya ejecutados o en ejecución)

### ✅ TAREA 1.1 — Fix colores raw en ProductTypeSelector

**Estado:** COMPLETADA  
**Archivo:** `frontend/components/selectors/ProductTypeSelector.tsx:20-24`  
**Cambio:** Reemplazar `text-{color}-500` por tokens semánticos  

```tsx
// ANTES
{ id: 'STORABLE',       color: 'text-blue-500'    },
{ id: 'CONSUMABLE',     color: 'text-amber-500'   },
{ id: 'MANUFACTURABLE', color: 'text-emerald-500' },
{ id: 'SERVICE',        color: 'text-purple-500'  },
{ id: 'SUBSCRIPTION',   color: 'text-rose-500'    },

// DESPUÉS
{ id: 'STORABLE',       color: 'text-info'        },
{ id: 'CONSUMABLE',     color: 'text-warning'     },
{ id: 'MANUFACTURABLE', color: 'text-success'     },
{ id: 'SERVICE',        color: 'text-primary'     },
{ id: 'SUBSCRIPTION',   color: 'text-destructive' },
```

**Criterio:** `grep -rn "text-blue-500\|text-purple-500\|text-emerald-500\|text-amber-500\|text-rose-500" frontend/components/` retorna 0 resultados.

---

### ✅ TAREA 1.2 — Fix font-bold en ToolbarCreateButton

**Estado:** COMPLETADA  
**Archivo:** `frontend/components/shared/ToolbarCreateButton.tsx:34`  
**Cambio:** `font-bold` → `font-black`

```tsx
// ANTES
"h-9 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm"

// DESPUÉS
"h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm"
```

**Criterio:** `ToolbarCreateButton` tiene `font-black` y visualmente es equivalente a `CancelButton`.

---

### ✅ TAREA 1.3 — Actualizar contrato docs/20-contracts/form-layout-architecture.md

**Estado:** COMPLETADA  
**Archivo:** `docs/20-contracts/form-layout-architecture.md` líneas 301 y 349  
**Cambio:** `text-[11px]` → `text-[10px]` en las reglas de typography de botones

```markdown
# ANTES (ambas líneas)
- **Typography**: Todos los botones deben ser `font-black text-[11px] uppercase tracking-widest`.

# DESPUÉS
- **Typography**: Todos los botones deben ser `font-black text-[10px] uppercase tracking-widest`.
```

**Criterio:** El contrato refleja la implementación real de `ActionSlideButton`, `CancelButton`, `SubmitButton`.

---

### ✅ TAREA 1.4 — Crear docs/20-contracts/typography-scale.md

**Estado:** COMPLETADA  
**Archivo:** `docs/20-contracts/typography-scale.md` (nuevo)  
**Contenido:** Escala completa h1-h6, body, badges, KPIs, labels — canon definitivo.

---

### ✅ TAREA 1.5 — Añadir escala h1-h6 a globals.css @layer base

**Estado:** COMPLETADA  
**Archivo:** `frontend/app/globals.css` (~605)  
**Cambio:** Añadir font-sizes individuales bajo la regla base de headings

```css
/* ANTES */
h1, h2, h3, h4, h5, h6 {
  @apply font-heading font-extrabold tracking-tighter uppercase;
}

/* DESPUÉS */
h1, h2, h3, h4, h5, h6 {
  @apply font-heading font-extrabold tracking-tighter uppercase;
}
h1 { @apply text-3xl; }
h2 { @apply text-2xl; }
h3 { @apply text-xl; }
h4 { @apply text-lg; }
h5 { @apply text-sm; }
h6 { @apply text-xs; }
```

**Criterio:** Los headings sin clase de tamaño explícita renderizan en la escala correcta. Los que tienen clase explícita no se ven afectados (override de Tailwind).

---

## FASE 2 — Estandarización de features

### ✅ TAREA 2.1 — Unificar badge/chip labels en features/orders

**Estado:** COMPLETADA (parcial — ver excepciones documentadas abajo)  
**Ejecutado:** 2026-05-15  
**Archivos principales:**
- `frontend/features/orders/components/DocumentListModal.tsx` (líneas ~100, ~145)
- `frontend/features/orders/components/ActionButton.tsx` (líneas ~62-63)
- `frontend/features/workflow/components/TaskInbox.tsx` (línea ~453)

**Regla:** Fuera del contexto L1 (FormSection), no usar `text-[8px]` ni `text-[9px]`. Unificar a `text-[10px] font-black`.

**Proceso de búsqueda:**
```bash
# Encontrar todos los usos de [8px] y [9px]
grep -rn "text-\[8px\]\|text-\[9px\]" frontend/features/ --include="*.tsx"
```

**Ejecutado en:**
- `features/orders/components/DocumentListModal.tsx` — 4 instancias corregidas (TableHead + 3 Badges)

**Excepciones documentadas (NO cambiar):**
- `features/production/` — `text-[9px]` en kanban, timeline, wizard steps: diseño industrial denso intencional
- `features/pos/` — `text-[9px]` en carrito, producto grid: POS UI deliberadamente compacto
- `text-[9px]` con `font-normal italic` o `opacity-50` — fine print legítimo (timestamps, notas)
- `text-[9px] font-mono text-muted-foreground` — códigos compactos en referencias

**Deuda restante:** ~100 instancias en production/pos que son excepciones aceptadas. Documentadas aquí.

**Criterio de aceptación final:** `text-[8px]` en features fuera de producción/pos → 0.

---

### ✅ TAREA 2.2 — Estandarizar KPI/metric numbers

**Estado:** COMPLETADA (archivos de mayor impacto)  
**Ejecutado:** 2026-05-15

**Archivos corregidos:**
- `features/production/components/ProductionMetricsCard.tsx` — 4 KPI numbers + 12 raw colors (→ semantic tokens)
- `features/finance/components/BudgetVarianceView.tsx` — 4 KPI numbers (`font-bold` → `font-black tracking-tighter`) + `text-emerald-500` → `text-success` + labels
- `features/orders/components/OrderHeaderDashboard.tsx:79` — añadido `font-heading tracking-tighter`

**Deuda restante (baja prioridad):**
- `features/finance/components/BudgetDetailView.tsx:131,141,151` — `text-2xl font-bold` → añadir `font-heading font-black tracking-tighter`
- `features/finance/components/BIAnalyticsView.tsx:102,118,133,148` — misma corrección

**Excepción documentada:**
- `features/pos/components/SessionCloseModal.tsx:219,408` — `font-mono tracking-tight` para totales de caja: correcto, es dato financiero tabular no KPI visual.

**Patrón canónico:** `text-3xl font-black font-heading tracking-tighter` (o `text-2xl` en espacio compacto, siempre con `font-black font-heading tracking-tighter`)

---

### ✅ TAREA 2.3 — Estandarizar modal/dialog headers

**Estado:** COMPLETADA (instancias con variaciones incorrectas)  
**Ejecutado:** 2026-05-15

**Archivos corregidos:**
- `features/pos/components/POSClientView.tsx:637` — `text-2xl font-black` → `text-xl font-black tracking-tight`
- `features/pos/components/POSClientView.tsx:684` — `text-xl font-bold` → `text-xl font-black tracking-tight`
- `features/orders/components/OrderActionPanel.tsx:123` — añadido `font-black tracking-tight`
- `features/hr/components/payrolls/PayrollDetailContent.tsx:251` — `font-bold` → `font-black`

**Ya correctos (no modificados):**
- `features/credits/components/PortfolioTable.tsx` — `text-xl font-black` ✅
- `features/credits/components/BlacklistView.tsx` — `font-black` ✅
- `features/settings/components/partners/EquityMovementModals.tsx` — color-based titles (pattern icon+title+color) — excepción intencional

**Patrón canónico:** `text-xl font-black tracking-tight` en `SheetTitle`, `AlertDialogTitle`, `DialogTitle`

---

### TAREA 2.4 — Crear componente FieldDescription (Label+Value pair)

**Estado:** PENDIENTE  
**Prioridad:** Media-baja (no bloquea ninguna invariante global)

Crear `frontend/components/shared/FieldDescription.tsx`:

```tsx
// Canónico para label+valor en detail views, drawers, sidebars
interface FieldDescriptionProps {
  label: string
  value: React.ReactNode
  className?: string
}

export function FieldDescription({ label, value, className }: FieldDescriptionProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
```

Exportar desde `frontend/components/shared/index.ts`.

Reemplazar en:
- `frontend/features/workflow/components/TaskDetailClient.tsx:76-99`
- `frontend/features/treasury/reconciliation/[id]/page.tsx:352-403`

---

## FASE 3 — Documentación (completar el sistema)

### TAREA 3.1 — Agregar a CLAUDE.md routing para typography-scale.md

**Estado:** PENDIENTE  
**Archivo:** `CLAUDE.md` tabla de task routing  
**Cambio:** Añadir fila:

```markdown
| Escala tipográfica / heading size / text size | [typography-scale.md](docs/20-contracts/typography-scale.md) |
```

---

## Métricas de éxito

Tras completar todas las fases:

| Métrica | Antes | Después |
|---------|-------|---------|
| Violaciones invariante #2 (raw colors) | 5 | 0 |
| Variantes de badge label size | 4 | 2 (10px estándar + 9px excepción) |
| Variantes de peso en action buttons | 2 (bold/black) | 1 (black) |
| Contrato vs. implementación alineados | 85% | 100% |
| Documentación de escala tipográfica | ❌ | ✅ |
