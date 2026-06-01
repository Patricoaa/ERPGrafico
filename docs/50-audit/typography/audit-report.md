# Audit Report: Tipografía — ERPGrafico

**Fecha:** 2026-05-15 | **Scope:** Frontend completo

---

## 1. Stack tipográfico (globals.css)

### Fuentes

```css
/* Definidas en :root y referenciadas por Tailwind v4 @theme inline */
--font-sans:    var(--font-onest), system-ui, sans-serif;   /* Onest — body, UI */
--font-heading: var(--font-syne), system-ui, sans-serif;    /* Syne  — títulos, marca */
--font-mono:    ui-monospace, SFMono-Regular, Menlo, ...;   /* System mono — datos, código */
```

Cargadas en `frontend/app/layout.tsx` vía `next/font/google`.

### Regla base de headings (globals.css ~605)

```css
h1, h2, h3, h4, h5, h6 {
  @apply font-heading font-extrabold tracking-tighter uppercase;
}
```

**Gap documentado:** No hay `font-size` definida en la regla base. Con Tailwind's preflight, todos los headings heredan `font-size: inherit` del padre hasta que una clase los override. Esto provoca que cada feature elija tamaños independientemente.

---

## 2. Sistema de 3 capas — Estado

### Layer 1: FormSection (✅ MATCH EXACTO)

```
Documentado:    text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70
Implementado:   text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/70
Archivo:        frontend/components/shared/FormSection.tsx:27
```

### Layer 2: LabeledInput legend (✅ MATCH EXACTO)

```
Documentado:    text-[10px] font-black uppercase tracking-[0.15em]
Implementado:   text-[10px] font-black uppercase tracking-[0.15em]
Archivo:        frontend/components/shared/LabeledInput.tsx:130
```

### Layer 3: Data values (✅ MATCH)

```
Documentado:    text-sm font-normal text-foreground
Implementado:   text-sm text-foreground placeholder:text-muted-foreground/60
Archivo:        frontend/components/shared/LabeledInput.tsx:113
```

---

## 3. Componentes shared — Estado

### ✅ Correctos

| Componente | Nota |
|-----------|------|
| `LabeledInput.tsx` | Match exacto L2 + L3 |
| `FormSection.tsx` | Match exacto L1 |
| `StatusBadge.tsx` | Matriz de tamaños intencional (sm/md/lg) |
| `ActionSlideButton.tsx` | `text-[10px] font-black tracking-widest` canónico |
| `ActionButtons.tsx` | SubmitButton + CancelButton + DangerButton unificados |
| `PageTabs.tsx` | `sm:text-[11px]` responsivo justificado por espacio |
| `data-table-column-header.tsx` | `text-[10px] font-black uppercase tracking-widest` correcto |

### ✅ Issues resueltos (2026-05-15)

#### `ToolbarCreateButton.tsx:34` — ✅ RESUELTO

```tsx
// ANTES (incorrecto)
"h-9 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm"
// DESPUÉS (correcto)
"h-9 px-4 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm"
```

#### `ProductTypeSelector.tsx:20-24` — ✅ RESUELTO

```tsx
// Ahora usa tokens semánticos
{ id: 'STORABLE',       color: 'text-info'        },
{ id: 'CONSUMABLE',     color: 'text-warning'     },
{ id: 'MANUFACTURABLE', color: 'text-success'     },
{ id: 'SERVICE',        color: 'text-primary'     },
{ id: 'SUBSCRIPTION',   color: 'text-destructive' },
```

**Justificación del mapping:** Estos son identificadores visuales (como los tokens financieros income/expense/asset/liability), no señales de estado. El mapping sigue la lógica perceptual: azul→info, ámbar→warning, verde→success, violeta→primary, rosa→destructive.

---

## 4. Contrato doc vs. implementación

### form-layout-architecture.md líneas 301 y 349 — `text-[11px]` desactualizado

```markdown
# ACTUAL (doc desactualizada)
- **Typography**: Todos los botones deben ser `font-black text-[11px] uppercase tracking-widest`.

# CORRECTO (refleja implementación real)
- **Typography**: Todos los botones deben ser `font-black text-[10px] uppercase tracking-widest`.
```

Ocurre en dos secciones: §5 FormFooter (l. 301) y §7 Form Footer (l. 349).

---

## 5. Patrones ad-hoc en features/

### 5.1 Badge/chip labels — ✅ RESUELTO (2026-05-15)

El patrón `text-[Npx] font-bold/black uppercase` aparecía con 4 tamaños distintos para el mismo concepto visual.

**Solución implementada:**
1. Creado componente `<Chip>` (`frontend/components/shared/Chip.tsx`) como única fuente de verdad para labels informacionales. Tamaños: xs (18px/9px), sm (22px/10px), md (26px/11px). Tipografía invariante: `font-mono font-black uppercase tracking-widest`.
2. Migradas ~74 instancias de `<Badge>` ad-hoc para labels/tags → `<Chip>`.
3. Eliminadas todas las instancias de `text-[8px]` en features (excepciones documentadas: PrintableReceipt, POS CartItem/POSCheckoutHeader, AvatarFallback).
4. `StatusBadge` default cambiado de `'md'` a `'sm'` para alinear con el uso predominante en tablas.
5. DataTable chrome (`data-table-column-header.tsx`, `data-table-toolbar.tsx`) corregido: `font-bold tracking-wider` → `font-black tracking-widest`.

**Estado post-fix:**

| Tamaño | Instancias restantes | Observación |
|--------|---------------------|-------------|
| `text-[8px]` | ~3 (excepciones) | PrintableReceipt, POS, AvatarFallback |
| `text-[9px]` | ~65 (fine print legítimo) | Timestamps, conteos compactos, `<Chip size="xs">` |
| `text-[10px]` | ~180 | Estándar canónico |
| `text-[11px]` | ~40 | L1 FormSection (correcto) |

### 5.2 KPI / números métricos — inconsistencia de peso y font (40+ instancias)

| Archivo | Clase actual | Problema |
|---------|-------------|---------|
| `features/finance/bank-reconciliation/components/DashboardKPIs.tsx:31` | `text-3xl font-black font-heading tracking-tighter` | ✅ Patrón correcto |
| `features/orders/components/OrderHeaderDashboard.tsx:79` | `text-2xl font-black text-foreground tracking-tight` | ⚠️ Sin `font-heading`, tracking-tight no tighter |
| `features/finance/components/BudgetVarianceView.tsx:175` | `text-2xl font-heading font-bold` | ⚠️ `font-bold` en lugar de `font-black`, sin tracking |
| `features/settings/components/HRSettingsView.tsx:362` | `text-2xl font-black text-primary font-heading` | ⚠️ `text-2xl` y sin tracking |

**Patrón canónico:** `text-3xl font-black font-heading tracking-tighter`

### 5.3 Modal/dialog headers — 6+ variaciones (100+ instancias)

| Archivo | Clase actual | Problema |
|---------|-------------|---------|
| `features/pos/components/POSClientView.tsx:637` | `AlertDialogTitle` + `text-2xl font-black text-center` | ⚠️ text-2xl |
| `features/pos/components/POSClientView.tsx:684` | `AlertDialogTitle` + `text-xl font-bold text-center` | ⚠️ font-bold, mismo archivo |
| `features/orders/components/OrderActionPanel.tsx:123` | `SheetTitle` + `text-xl` | ⚠️ Sin peso |
| `features/tax/components/TaxDeclarationsView.tsx:319` | `CardTitle` + `text-sm font-medium text-muted-foreground` | ❌ CardTitle como label, no como header |

**Patrón canónico:** `text-xl font-black tracking-tight` (via BaseModal o aplicado a SheetTitle/AlertDialogTitle)

### 5.4 Label + Value pairs — 3 pesos distintos (50+ instancias)

```tsx
// En TaskDetailClient.tsx
<p className="text-sm text-muted-foreground">Título</p>
<p className="font-semibold text-lg">{task.title}</p>  // ← semibold aquí

// En PaymentHistoryModal.tsx
<p className="font-medium text-lg">No se han registrado pagos aún.</p>  // ← medium aquí

// En reconciliation pages
<p className="font-bold text-base">valor</p>  // ← bold aquí
```

**Fix futuro:** Crear `<FieldLabel>` / `<FieldValue>` o extender `DataCell.LabelValue`.
**Patrón canónico:** Label = `text-sm text-muted-foreground`, Value = `text-sm font-semibold text-foreground`

### 5.5 Wizard/section headers — sin mapping h1-h6 (100+ instancias)

Sin escala de headings definida, cada wizard elige independientemente:
- `WizardHeader.tsx:45`: `text-xl font-bold tracking-tight`
- `WorkOrderWizard.tsx:322`: `text-lg font-semibold`
- `FinishedStep.tsx:32`: `text-2xl font-bold text-foreground`
- `DeclarationWizard.tsx:428`: `text-3xl font-black uppercase tracking-tight`

**Fix:** Definir escala h1-h6 en `typography-scale.md` + `globals.css`.

---

## 6. Distribución estadística

| Métrica | Valor |
|---------|-------|
| Instancias de clases tipográficas en `features/` | ~2.400 |
| Violaciones de colores raw (invariante #2) | 5 (todas en ProductTypeSelector) |
| Categorías de patrones ad-hoc | 8 |
| Archivos con inconsistencia en heading styles | 100+ |
| Variantes de badge label size | 4 (`[8px]`, `[9px]`, `[10px]`, `[11px]`) |

---

## 7. Excepciones que deben preservarse

| Patrón | Archivo | Justificación |
|--------|---------|---------------|
| `text-[10px] sm:text-[11px]` | `PageTabs.tsx` | Responsive real, espacio limitado en mobile |
| `tracking-[0.05em]` en tabs vs `tracking-[0.15em]` en labels | `PageTabs.tsx` | Jerarquía intencional: sub-tabs son menos agresivos |
| `text-[Npx]` hardcodeados en sistema de capas | Todo el sistema | Diseño industrial denso; no reemplazar con `text-xs`/`text-sm` |
| Matriz sm/md/lg en `StatusBadge` | `StatusBadge.tsx` | Contextos genuinamente diferentes |
| `inline style fontSize` dinámico | `pos/SearchBar.tsx:52` | Accesibilidad táctil con valor calculado en runtime |
| `text-[11px]` en `FormSection` | `FormSection.tsx` | Es L1 canónico — correcto |
