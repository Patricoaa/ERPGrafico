---
layer: 20-contracts
doc: component-fields
status: active
owner: frontend-team
last_review: 2026-08-03
stability: stable
---

# Entity Fields — asignación de FieldType a DataCell

> **File**: `frontend/components/shared/entity-fields.tsx`
> **Import**: `import { createEntityFields } from '@/components/shared'`

**Fuente de verdad** para asignar tipo de campo (`FieldDef.type`) → renderer (`DataCell.*`) en
DataTable / EntityCard / Kanban. Centraliza y reemplaza como referencia el mapeo de la tabla
D-03 de ADR-0054 (histórica) y los ADRs vigentes: **ADR-0066** (unión discriminada),
**ADR-0067** (placement / surface / weight), **ADR-0062** (fechas y pesos).

Los primitivos `DataCell.*` a nivel de API se documentan en
[component-contracts.md §DataCell primitives](./component-contracts.md#datacell-primitives).

---

## 1. Flujo canónico

Todo campo de entidad se declara una vez en un archivo `*Fields.ts` con
`createEntityFields<T>()` y se renderiza en las tres superficies (invariante #13):

```tsx
const treasuryAccountFields = createEntityFields<TreasuryAccount>()({
  account_name: {
    label: "Cuenta",
    type: "text",
  },
  tipologia: {
    label: "Tipología",
    type: "secondary",
  },
  balance: {
    label: "Saldo",
    type: "currency",
    currency: "CLP",
  },
})
```

API del factory:

| Método | Devuelve | Uso |
|--------|----------|-----|
| `toColumns()` | `ColumnDef<T>[]` | Columnas de DataTable (header con ordenamiento) |
| `toCardFields(entity, opts?)` | `CardField[]` | Campos de EntityCard (resuelve `placement`/`fieldRole`) |
| `toKanbanFields(entity, opts?)` | `KanbanField[]` | Campos compactos de Kanban |
| `render(key, entity)` | `ReactNode` | Render de un campo individual (casos ad-hoc) |
| `defs` | `Record<string, FieldDef<T>>` | Acceso raw al schema (solo para componentes de control) |
| `meta` | `EntityFieldsMeta<T> \| undefined` | Config centralizada de title/subtitle del card (param `meta` del factory) |
| `resolveTitle(entity)` | `ReactNode` | Título del card. Prioridad: `meta.title` → campo con `placement: 'title'` → primer campo |
| `resolveSubtitle(entity, cardFields?)` | `SubtitleItem[]` | Subtítulo del card desde `meta.subtitle`. `cardFields` evita duplicar campos ya asignados al título |
| `getSubtitleExcludeKeys(entity, cardFields?)` | `Set<string>` | Keys consumidas por el subtitle — `AutoEntityCard` las excluye de las zonas del card (evita render duplicado, p.ej. fecha en subtitle Y detail center) |

**Excepción documentada**: los renderers `computed` y columnas fuera de entidad (BOMManager,
statementFields, checkFields) pueden usar `DataCell.*` directamente. En columnas regulares de
entidad **nunca** se usa `DataCell.*` inline — se declara `type` y el motor resuelve.

---

## 2. Guía de decisión: cómo elegir `type`

### 2.1 Clasificación de Textos Estándar (primario vs secundario)

* **`text` (Texto Primario)**: la identidad del dato en sí — nombre, documento, descripción
  principal. Contenedor de texto principal por defecto (default `text-xs` + `font-medium`,
  `text-foreground`).
* **`secondary` (Texto Secundario)**: dato **complementario** que acompaña a una celda primaria
  y aporta contexto — categorías, notas, descripciones secundarias, referencias contextuales.
  Default `text-xs` + `font-medium`, `text-muted-foreground`.

**Criterio**: si el campo ACOMPAÑA a otra celda primaria y solo aporta contexto, es `secondary`.
Si es el dato que el usuario identifica de la fila (su "nombre"), es `text`.

### 2.2 Tabla de decisión rápida

| Necesitas mostrar… | `type` | Evita |
|--------------------|--------|-------|
| Identidad primaria, texto descriptivo | `text` | `secondary` (resta jerarquía a la identidad) |
| Metadato / contexto / categoría textual | `secondary` | `text` (falsa jerarquía) |
| Folio, prefijo, código interno (fuente mono) | `code` | `text` (pierde la semántica de código) |
| Fecha | `date` | `dateTime` (hora innecesaria) |
| Fecha con hora | `dateTime` | `date` (pierde la hora) |
| Monto monetario | `currency` | `number`, `numericFlow`, `currencyFlow` |
| Cantidad con polaridad visual (+/−) | `numericFlow` | `currency` (no es moneda) |
| Flujo de dinero entrante/saliente | `currencyFlow` | `currency` (pierde dirección) |
| Estado de negocio (badge) | `status` | `chip`, texto crudo |
| Tag / etiqueta genérica con color de intención | `chip` | `status` (no es estado) |
| Uno o varios valores de un dominio | `chip-category` | `chip` (pierde `resolveCategory`) |
| Persona / empresa registrada (abre ContactDrawer) | `contact` | `text`, `link` |
| Origen → destino (ruta) | `sourceDest` | composición manual de dos celdas |
| Render arbitrario / celda compleja | `computed` | abusar: es el único escape hatch |

> **Regla tipográfica por defecto (ADR-0061):** todas las celdas de texto usan `text-xs` por
> default. Se escala con `size="md"`/`"lg"` en moneda o `className` (tailwind-merge last-wins).

---

## 3. Referencia: FieldType → renderer → opciones

Mapeo real del motor (switch `renderCell`). Cada `type` solo acepta sus opciones tipadas
(un objeto con una prop fuera de su miembro es error de compilación).

| `type` | Renderer | Opciones del miembro | Rol → zona |
|--------|----------|----------------------|------------|
| `text` | `DataCell.Text` + IconPrefix | `icon` | `descriptive` → detail |
| `secondary` | `DataCell.Secondary` + IconPrefix | `icon` | `supplementary` → detail |
| `code` | `DataCell.Code` + IconPrefix | `icon` | `identifier` → header (promovido a title) |
| `date` | `DataCell.Date` | — | `temporal` → subtitle/detail |
| `dateTime` | `DataCell.Date showTime` | `dateWeight`, `timeWeight` (ADR-0062) | `datetime` → **center header, nunca subtitle** |
| `currency` | `DataCell.Currency` | `currency`, `showZeroAsDash`, `tooltip`, `showColor`, `intent`, `weight`, `size` | `primary-value` → header (keys `total`/`salary` rankean más alto) |
| `number` | `DataCell.Number` | `suffix`, `suffixGap`, `weight` | `descriptive` → detail |
| `status` | `DataCell.Status` (badge) | `getLabel` | `primary-value` → header |
| `contact` | `DataCell.ContactLink` | `getDisplay` | `relation` → subtitle/detail |
| `chip` | `DataCell.Chip` | `intent`, `chipIcon` | `tag` → header |
| `chip-category` | `DataCell.Category` (chips por dominio) | `domain` (valor o `(e) => Domain`) | `tag` → header |
| `currencyFlow` | `DataCell.CurrencyFlow` (badge tintado, ADR-0060) | `direction`, `currency`, `showIcon` | `flow` → header center |
| `numericFlow` | `DataCell.NumericFlow` (badge tintado, ADR-0060/0067) | `direction`, `unit`, `showIcon`, `showSign` | `flow` → header center |
| `sourceDest` | `DataCell.SourceDest` | — | `complex` → **siempre header** |
| `computed` | `render(entity) → ReactNode` | `render` + `fieldRole` (requerido si se quiere otra zona) | `descriptive` → detail (por defecto) |

**Opciones compartidas (`SharedFieldDef`)**: `key`, `label`, `header`, `get`, `surfaces`,
`placement`, `fieldRole`, `cardSize`, `cardClassName`, `className` (condicional por fila),
`tableOptions { width, enableSorting, align, sortingFn, filterFn, accessorFn }`,
`kanbanOptions { priority }`.

### 3.1 `computed` — el único escape hatch

`type: 'computed'` acepta `render: (entity) => ReactNode` para celdas arbitrarias. Sin
`fieldRole` cae en `descriptive` → detail. Para replicar el routing always-header del antiguo
`complex`, declarar `fieldRole: 'complex'` (o el rol que describa la intención: `'status'` →
badge header, `'primary-value'` → header monetario, `'identifier'` → título).

### 3.2 `contact` — id como valor, nombre como display

`type: 'contact'` renderiza una persona/empresa registrada vía `DataCell.ContactLink`. El valor
del campo (via `get` o acceso directo) es el **id** del contacto; si el texto visible difiere del
id (p. ej. `supplier_id` + `supplier_name`), declarar `getDisplay: (entity) => string`:

```tsx
supplierName: {
    key: 'supplier_id',
    type: 'contact',
    label: 'Proveedor',
    get: (s) => s.supplier_id,
    getDisplay: (s) => s.supplier_name,
},
```

Sin `getDisplay`, el propio valor se usa como texto visible (un campo cuyo valor ya sea el nombre
o un id legible). Ver [ADR-0072](../10-architecture/adr/0072-entity-fields-contact-display.md).

---

## 4. Política null unificada (ADR-0066 D-03)

Valores `null` / `undefined` / `''` renderizan **guion de datos faltantes** (`-`) en texto,
fechas, moneda y cantidad. `status` con valor vacío también cae a `-` (`DataCell.Text`); solo
los chips/tags con valor real renderizan badge. Sin texto placeholder (`"--"`, `"N/A"`,
`"Sin valor"`) en celdas de entidad.

---

## 5. Placement / fieldRole / weight por zona (ADR-0067)

* **Zonas de lista (orden izquierda → derecha):** `title → subtitle → detail → header`
  (header al final, antes de acciones). Dentro de la misma zona se preserva el orden de
  definición; `header` sigue la prioridad del card (complex → total/salary → primary-value →
  flow → tag).
* **Zonas de card:** `title` (reemplaza el title auto), `subtitle` (reemplaza el subtitle auto),
  `header` (badges/KPIs compactos en el área trailing), `detail` (**ruta a la zona center
  header** — label:value junto a los flows).
* **`fieldRole` → `placement` automático** via `ROLE_TO_PLACEMENT`. `placement` explícito gana.
* **Peso por zona:** el motor aplica `weight: 'semibold'` automático a las celdas resueltas en
  zona `header` (lista y card); las zonas `title`/`detail`/`subtitle` conservan el default
  `font-medium`. Un `weight` explícito en el `FieldDef` gana sobre el automático.
  `Status`/`Chip`/`Category` conservan su tipografía de badge (no aceptan `weight`).
  `resolveTitle()` siempre renderiza el título del card en `font-bold`.
* **`dateTime`** siempre a center header (rol `datetime`); `date` (rol `temporal`) sigue siendo
  candidato a subtítulo vía auto-compose.

---

## 6. Referencias

| ADR | Tema |
|-----|------|
| [ADR-0054](adr/0054-entity-fields-schema.md) | Schema original — **histórico**, superseded por 0066 |
| [ADR-0066](adr/0066-entity-fields-discriminated-union.md) | Unión discriminada `FieldDef`, null policy, registry type→cell |
| [ADR-0067](adr/0067-entity-fields-placement-surface-and-weight.md) | `fieldRole`/`placement`/`surfaces`, peso por zona |
| [ADR-0062](adr/0062-datacell-date-time-weights.md) | Pesos de `DataCell.Date` (`dateWeight`/`timeWeight`, token `light`) |
| [ADR-0060](adr/0060-flow-cells-tinted-badge.md) | Badge tintado de flow cells |
| [ADR-0061](adr/0061-datacell-text-default-text-xs.md) | Default `text-xs` en celdas de texto |
| [ADR-0065](adr/0065-datacell-status-ghost-pill-unification.md) · [ADR-0068](adr/0068-badge-currencyflow-default.md) | Estética de badges/status |

- Implementación: `frontend/components/shared/entity-fields.tsx`
- Primitivas DataCell: `frontend/components/shared/DataTableCells.tsx` + [component-contracts.md §DataCell](./component-contracts.md#datacell-primitives)
- Vistas y surfaces: [component-datatable-views.md](./component-datatable-views.md)
