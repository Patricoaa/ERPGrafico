---
layer: 20-contracts
doc: shape-consistency-lock
status: active
owner: frontend-team
last_review: 2026-08-12
stability: contract-changes-require-ADR
---

# Shape Consistency Lock

> **Regla cardinal:** Cada elemento de la UI tiene un único radio de esquina permitido según su nivel en la jerarquía de profundidad. No está permitido desviar de esta escala sin un ADR aprobado.

Este contrato codifica el sistema de **Radius Hierarchy (The Rule of Nested Corners)** definido en [`docs/10-architecture/design-system.md`](../10-architecture/design-system.md) y lo expande con reglas de aplicación precisas para cada tipo de componente.

---

## 1. La Escala de Cuatro Niveles

Los tokens de Tailwind v4 están **remapeados** en `app/globals.css` para servir esta jerarquía. Los valores por defecto de Tailwind **no aplican**.

| Nivel | Token Tailwind | Valor CSS real | Tipo de Elemento |
|-------|---------------|----------------|-----------------|
| **Atómico** | `rounded-sm` | `var(--radius)` = **8px** | Botones, Inputs, Checkboxes, Badges, Fondos de íconos pequeños (`p-1` / `p-2`), Tabs, Pills dentro de toolbars, Items de menú, Filas interactivas inline |
| **Contenedor** | `rounded-md` | `var(--radius-md)` = **12px** | Cards, StatCards, DataTable wrapper, Alertas/Info banners, Bloques de formulario (`FormSection`), Estados vacíos (placeholders), Áreas de contenido bordeadas |
| **Overlay** | `rounded-lg` | `var(--radius-lg)` = **16px** | Modales (`Dialog`), Sheets flotantes, Popovers, Dropdowns, `Select` content, Tooltips container (no sus items) |
| **Shell** | `rounded-xl` | `var(--radius-xl)` = **20px** | Main `<main>` shell. **Excepción — paneles de borde cuadrados:** `Drawer` y `CollapsibleSheet` usan `rounded-none` en todo contexto (ADR-0073). |
| **Especial** | `rounded-full` | 50% | Avatares, Dots de estado, Progress bars, Icon-only buttons circulares, Spinners, Pulsing indicators |

> **Nota:** `rounded-none` solo se permite en bordes internos (divisores de tablas), cuando el diseño funde dos superficies (e.g. header flush), o en los paneles de borde `Drawer`/`CollapsibleSheet` (ADR-0073). Requiere comentario inline explicativo.

---

## 2. Reglas por Tipo de Componente

### 2.1 Botones (`Button`, `IconButton`, `ActionButton`)

```tsx
// ✅ Correcto — atómico
<Button className="rounded-sm">Guardar</Button>

// ✅ Correcto — icon-only circular
<Button className="rounded-full" size="icon">...</Button>

// ❌ PROHIBIDO — botón con rounded-md
<Button className="rounded-md">Guardar</Button>
```

**Excepción**: `ActionDock` buttons usan `rounded-full` por ser elementos cinéticos flotantes — ver [`component-animation.md`](component-animation.md).

### 2.2 Inputs y Selectores

```tsx
// ✅ Correcto
<Input className="rounded-sm" />               // Input estándar
<SelectTrigger className="rounded-sm" />       // Select trigger
<Textarea className="rounded-sm" />            // Textarea

// ✅ El dropdown del Select es un overlay
<SelectContent />                              // → rounded-lg (definido en ui/select.tsx)

// ❌ PROHIBIDO
<Input className="rounded-md" />              // Input no es contenedor
```

### 2.3 Cards y Contenedores

```tsx
// ✅ Correcto
<Card />                        // → rounded-md (definido en ui/card.tsx)
<StatCard />                    // → rounded-md (definido en shared/StatCard.tsx)
<DataTable />                   // → rounded-md wrapper (definido en shared/DataTable.tsx)

// ✅ Correcto — alerta/info banner
<div className="p-3 rounded-md border bg-destructive/10">...</div>

// ❌ PROHIBIDO — contenedor con rounded-sm
<Card className="rounded-sm">...</Card>
<div className="p-3 rounded-sm border bg-muted/20">...</div>
```

### 2.4 Overlays (Modales, Popovers, Dropdowns)

```tsx
// ✅ Correcto — overlays flotantes con radio; paneles de borde cuadrados
<Dialog />                       // → rounded-lg (definido en ui/dialog.tsx)
<PopoverContent />               // → rounded-lg (definido en ui/popover.tsx)
<DropdownMenuContent />          // → rounded-lg (definido en ui/dropdown-menu.tsx)
<SelectContent />                // → rounded-lg (definido en ui/select.tsx)
<Sheet />                        // → rounded-none si es Drawer/CollapsibleSheet (ADR-0073)

// ❌ PROHIBIDO — no sobreescribir con radius menor
<DropdownMenuContent className="rounded-sm ..." />  // viola el contrato de overlay
<PopoverContent className="rounded-md ..." />       // viola el contrato de overlay
```

### 2.5 Fondos de Íconos

El radio del fondo de un ícono depende del **tamaño del contenedor**:

| Tamaño del contenedor | Radio correcto |
|---|---|
| `p-1`, `p-1.5`, `p-2` (≤ 32px) | `rounded-sm` |
| `p-4`+ o ≥ `h-12` (elemento destacado) | `rounded-md` |
| Circular por diseño | `rounded-full` |

```tsx
// ✅ Correcto — fondo pequeño inline en alerta
<div className="p-2 rounded-sm bg-destructive/10">
  <AlertTriangle className="h-4 w-4" />
</div>

// ✅ Correcto — fondo grande en modal de confirmación
<div className="h-16 w-16 flex items-center justify-center rounded-md bg-destructive/10">
  <FileWarning className="h-8 w-8" />
</div>
```

### 2.6 Estados Vacíos (Empty States)

Las áreas de estado vacío son contenedores de información — usan `rounded-md`:

```tsx
// ✅ Correcto
<div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 py-12">
  <EmptyIcon />
  <p>No hay datos</p>
</div>

// ❌ PROHIBIDO
<div className="rounded-sm border border-dashed ...">...</div>
```

---

## 3. Tabla de Referencia Rápida

| Componente | Radio Correcto | Notas |
|---|---|---|
| `Button` | `rounded-sm` | Excepto icon-only → `rounded-full` |
| `IconButton` | `rounded-sm` | |
| `Input` / `Textarea` | `rounded-sm` | |
| `SelectTrigger` | `rounded-sm` | Igual que un input |
| `Checkbox` / `Radio` | `rounded-sm` / `rounded-full` | |
| `Badge` / `Chip` | `rounded-sm` (square) o `rounded-full` (pill) | |
| `Card` | `rounded-md` | Todos los variants |
| `StatCard` | `rounded-md` | |
| `DataTable` wrapper | `rounded-md` | |
| Alert / Info banner | `rounded-md` | Contenedores de mensaje |
| Fondo de ícono pequeño | `rounded-sm` | `p-1` / `p-2` |
| Fondo de ícono grande | `rounded-md` | `p-4`+ o ≥ `h-12` |
| Empty state area | `rounded-md` | |
| `Dialog` / Modal | `rounded-lg` | |
| `PopoverContent` | `rounded-lg` | |
| `DropdownMenuContent` | `rounded-lg` | |
| `SelectContent` | `rounded-lg` | |
| `Drawer` / `CollapsibleSheet` | `rounded-none` | Paneles de borde — ADR-0073 |
| Main shell `<main>` | `rounded-xl` | |
| Avatar | `rounded-full` | |
| Status dot | `rounded-full` | |
| Progress bar | `rounded-full` | |
| Spinner | `rounded-full` | |

---

## 4. Invariantes Globales (violación = PR rechazado)

1. **Ningún `<Card>` o contenedor de datos puede usar `rounded-sm`** — es radio atómico exclusivo para elementos interactivos pequeños.
2. **Ningún overlay flotante puede usar `rounded-sm` o `rounded-md`** — los overlays flotan sobre la UI y deben tener `rounded-lg` mínimo para crear ilusión de profundidad.
3. **`rounded-xl` está reservado exclusivamente para el Shell** — no se aplica en componentes de feature ni en `components/shared/` a menos que sea un panel global documentado.
4. **No sobreescribir el radius de componentes base con un nivel inferior** — `<PopoverContent className="rounded-sm ...">` es una violación. Un className de override solo puede escalar *hacia arriba* en la jerarquía, nunca hacia abajo.
5. **`rounded-none` requiere comentario inline** — `{/* rounded-none: bordes internos de tabla, flush con header */}`.

---

## 5. Historial de Cambios

| Fecha | Cambio |
|---|---|
| 2026-08-12 | Creación del contrato. Aplicación del Shape Consistency Lock en todos los módulos. Corrección de 15+ violaciones en `components/ui/`, `components/shared/` y `features/`. |
