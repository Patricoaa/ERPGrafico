---
layer: 20-contracts
doc: component-skeleton
status: active
owner: frontend-team
last_review: 2026-05-07
stability: contract-changes-require-ADR
---

# Skeleton Components

Controla los **estados de carga** de la aplicación. Existen tres estrategias bien delimitadas; elegir la incorrecta introduce layout shifts (CLS) o código difícil de mantener.

---

## Árbol de Decisión

```
¿En qué momento se muestra el skeleton?
│
├─ Ruta nueva, sin datos previos (first load / Suspense boundary)
│   └─ ¿Qué estructura se carga?
│       ├─ Página completa (app/loading.tsx)         → AppShellSkeleton
│       ├─ Página con tabs + toolbar + tabla          → PageLayoutSkeleton
│       ├─ Página con formulario                      → PageLayoutSkeleton contentType="form"
│       ├─ Tabla de datos                             → TableSkeleton
│       ├─ Tarjetas en grilla                         → CardSkeleton variant="grid"|"product"
│       └─ Formulario                                 → FormSkeleton
│
├─ Datos ya visibles, el usuario filtra / pagina / mutates (refetch)
│   └─ SkeletonShell isLoading={isFetching} + datos placeholder tipados
│
└─ Componente con Suspense propio (ej. lazy import de modal)
    └─ Component.Skeleton  (propiedad estática co-localizada)
```

---

## Estrategia 1: Wrappers estáticos (first load)

Para cuando el DOM real no existe todavía. El componente dibuja una silueta estática del layout final.

```tsx
// loading.tsx de ruta
import { PageLayoutSkeleton } from "@/components/shared"
export default function Loading() {
    return <PageLayoutSkeleton hasTabs tabsCount={3} hasToolbar contentType="table" />
}
```

### Regla de la ruta raíz

`app/loading.tsx` usa exclusivamente `AppShellSkeleton` (sidebar + topbar + contenido). No duplicar primitivos en ese archivo.

---

## Estrategia 2: SkeletonShell + datos placeholder (refetch)

Para cuando el DOM ya existe y solo estás esperando datos nuevos. Envuelve el componente real y aplica un shimmer CSS — sin desmontar, sin CLS.

### Patrón completo

```tsx
// 1. Constante tipada co-localizada con el componente
const ORDERS_SKELETON_ROWS: SaleOrder[] = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    number: '——',
    customer_name: '————————————',
    total: 0,
    status: 'draft' as const,
    // ... resto del tipo con valores neutros
}))

// 2. Componente usa SkeletonShell en lugar de early return
function OrdersTable({ data, isFetching }: Props) {
    if (!isFetching && !data.length) return <EmptyState />

    return (
        <SkeletonShell isLoading={isFetching} ariaLabel="Actualizando pedidos">
            <DataTable
                columns={columns}
                data={isFetching ? ORDERS_SKELETON_ROWS : data}
            />
        </SkeletonShell>
    )
}
```

### Por qué los datos placeholder son tipados

Si `SaleOrder` agrega un campo obligatorio, TypeScript fuerza actualizar `ORDERS_SKELETON_ROWS`. El esqueleto nunca puede quedarse desincronizado con el tipo de dominio.

### Antipatrón a evitar

```tsx
// MAL — desmonta el componente real y lo reemplaza por una silueta diferente → CLS
if (isFetching) return <TableSkeleton rows={8} columns={5} />
return <DataTable ... />
```

---

## Estrategia 3: Component.Skeleton (Suspense de componente)

Cuando un componente necesita su propio fallback para un `<Suspense>` (ej. modal lazy, panel pesado), define la propiedad estática `.Skeleton` en el mismo archivo.

```tsx
// BudgetVarianceTable.tsx
function BudgetVarianceTableBase({ data, loading }: Props) { ... }

BudgetVarianceTableBase.Skeleton = function BudgetVarianceTableSkeleton() {
    return <TableSkeleton rows={8} columns={7} ariaLabel="Cargando variación presupuestal" />
}

export const BudgetVarianceTable = BudgetVarianceTableBase
```

```tsx
// En el consumidor
<Suspense fallback={<BudgetVarianceTable.Skeleton />}>
    <BudgetVarianceTable data={data} />
</Suspense>
```

**Ventaja:** el skeleton vive en el mismo archivo que el componente. Un cambio estructural al componente lleva al desarrollador exactamente al lugar donde debe actualizar el skeleton.

---

## Catálogo completo de componentes

Todos los componentes del catálogo se importan **exclusivamente** desde el barrel:
```tsx
import { TableSkeleton, SkeletonShell, CardSkeleton } from "@/components/shared"
```
Nunca importar directamente desde `@/components/ui/skeleton`.

---

### `TableSkeleton`

| prop | type | default | notas |
|------|------|---------|-------|
| `rows` | `number` | `5` | Filas simuladas |
| `columns` | `number` | `5` | Columnas por fila |
| `className` | `string` | — | Clase del contenedor |
| `ariaLabel` | `string` | `'Cargando tabla'` | Label para lectores de pantalla |

---

### `CardSkeleton`

| prop | type | default | notas |
|------|------|---------|-------|
| `count` | `number` | `3` | Tarjetas a renderizar |
| `variant` | `'grid' \| 'list' \| 'product' \| 'compact'` | `'grid'` | Forma de las tarjetas |
| `gridClassName` | `string` | — | Configuración de columnas del grid |
| `className` | `string` | — | Clase del contenedor |
| `ariaLabel` | `string` | `'Cargando contenido'` | Label para lectores de pantalla |

---

### `FormSkeleton`

| prop | type | default | notas |
|------|------|---------|-------|
| `fields` | `number` | `4` | Campos por bloque |
| `cards` | `number` | `1` | Bloques lado a lado (1–4) |
| `hasTabs` | `boolean` | `false` | Tab-bar encima del formulario |
| `tabs` | `number` | `3` | Cantidad de tabs |
| `className` | `string` | — | Clase del contenedor |
| `ariaLabel` | `string` | `'Cargando formulario'` | Label para lectores de pantalla |

---

### `SkeletonShell`

| prop | type | default | notas |
|------|------|---------|-------|
| `isLoading` | `boolean` | **obligatorio** | Activa shimmer + `aria-busy` |
| `children` | `ReactNode` | **obligatorio** | El DOM real a "congelar" |
| `className` | `string` | — | Clase del wrapper |
| `ariaLabel` | `string` | `'Cargando...'` | Label anunciado al activarse |

Cuando `isLoading=false` no renderiza ningún wrapper — devuelve `children` directamente (sin nodo extra en el DOM).

---

### Familia `PageLayoutSkeleton`

Wrappers de alto nivel para rutas completas. Usar en `loading.tsx`.

#### `PageLayoutSkeleton`

| prop | type | default | notas |
|------|------|---------|-------|
| `hasTabs` | `boolean` | `false` | Incluye `PageTabsSkeleton` |
| `tabsCount` | `number` | `3` | Cantidad de pestañas |
| `hasToolbar` | `boolean` | `false` | Incluye `ToolbarSkeleton` |
| `contentType` | `'table' \| 'card' \| 'form' \| 'custom'` | `'table'` | Contenido del cuerpo |
| `children` | `ReactNode` | — | Reemplaza el body cuando `contentType='custom'` |

#### `HubSkeleton`

| prop | type | default | notas |
|------|------|---------|-------|
| `phases` | `number` | `4` | Cantidad de tarjetas de fase verticales |

#### Sub-componentes (no usar directamente en `loading.tsx`)

- `PageHeaderSkeleton` — barra superior con icono + título
- `PageTabsSkeleton` — barra de pestañas
- `ToolbarSkeleton` — barra de búsqueda + botones de acción
- `AppShellSkeleton` — shell completo (sidebar + topbar + contenido); usar **solo** en `app/loading.tsx`

---

### `LoadingFallback`

Wrapper de conveniencia para `<Suspense fallback={...}>`.

| prop | type | default | notas |
|------|------|---------|-------|
| `variant` | `'table' \| 'card' \| 'list'` | `'table'` | Tipo de skeleton |
| `message` | `string` | `'Cargando...'` | Forwarded como `ariaLabel` |
| `className` | `string` | — | |

---

## Reglas de import

| Contexto | Regla |
|----------|-------|
| `features/**` | Importar desde `@/components/shared` únicamente. Prohibido `@/components/ui/skeleton`. |
| `app/**` | Idem. |
| `components/shared/**` | Puede usar `@/components/ui/skeleton` internamente (es la implementación). |

Esta regla está aplicada por ESLint (`no-restricted-imports` en `eslint.config.mjs`).

---

## Accesibilidad

- Todos los wrappers compuestos (`TableSkeleton`, `CardSkeleton`, `FormSkeleton`, `PageLayoutSkeleton`, `HubSkeleton`, `AppShellSkeleton`) llevan `role="status"` + `aria-label`.
- Los sub-componentes (`PageTabsSkeleton`, `ToolbarSkeleton`, `PageHeaderSkeleton`) **no** llevan `role="status"` para evitar regiones live anidadas.
- `SkeletonShell` usa `aria-busy="true"` + `aria-live="polite"` cuando activo.
- `prefers-reduced-motion: reduce` desactiva todas las animaciones shimmer (`animation: none; opacity: 0.5`). Definido en `globals.css`.
