---
layer: 20-contracts
doc: component-skeleton
status: active
owner: frontend-team
last_review: 2026-04-23
stability: contract-changes-require-ADR
---

# Skeleton Components

Los componentes de esta familia manejan los **estados de carga** de la aplicación. Es **CRÍTICO** utilizarlos correctamente para evitar "layout shifts" (brincos en la pantalla) y reducir el código repetitivo.

---

## 🎭 Regla de Oro: Suspense vs Refetching

El proyecto define dos momentos distintos para los estados de carga, y cada uno usa una estrategia diferente:

### 1. Carga Inicial (First-Load / Suspense)

Cuando el usuario navega a una ruta nueva y no hay datos.

- **Usa:** Wrappers estáticos (`TableSkeleton`, `FormSkeleton`, `CardSkeleton`).
- **Por qué:** No tienes datos para renderizar el DOM real, así que debes dibujar un "mock" estático que imite la estructura final.

### 2. Recarga (Refetching / Mutations / Filters)

Cuando el usuario ya está en la vista, la tabla existe, y solo está filtrando o cambiando de página.

- **Usa:** `SkeletonShell` envolviendo tu componente real.
- **Por qué:** Evita desmontar el componente real para poner un esqueleto. El Shell le aplica un "shimmer" (brillo CSS) por encima al DOM existente, congelando la interacción pero manteniendo exactamente el mismo layout. ¡Cero brincos!

---

## 🚫 Antipatrón: Skeletons "Ad-hoc"

Está **estrictamente prohibido** el uso excesivo del componente primitivo `<Skeleton />` directamente en las features:

```tsx
// MAL — infla el código de negocio con clases de Tailwind de diseño
<Skeleton className="h-4 w-32" />
<Skeleton className="h-4 w-48" />

// BIEN — usa el wrapper apropiado
<TableSkeleton rows={5} columns={4} />
```

Si la vista es muy específica (ej. el Header de un perfil), crea un archivo `ProfileHeaderSkeleton.tsx` encapsulando los primitivos, en lugar de mezclarlos con el código de negocio.

---

## 📦 Catálogo de Wrappers Compartidos

### `CardSkeleton`

| prop | type | default | notes |
|------|------|---------|-------|
| `count` | `number` | `3` | Número de tarjetas a renderizar |
| `variant` | `'grid' \| 'list' \| 'product' \| 'compact'` | `'grid'` | `product`: con imagen; `compact`: lista slim |
| `gridClassName` | `string` | — | Configuración custom de grid (ej. `grid-cols-4`) |
| `className` | `string` | — | Clases para el contenedor principal |

### `TableSkeleton`

| prop | type | default | notes |
|------|------|---------|-------|
| `rows` | `number` | `5` | Filas de la tabla |
| `columns` | `number` | `5` | Columnas por fila |
| `className` | `string` | — | Clases para el contenedor principal |

### `FormSkeleton`

| prop | type | default | notes |
|------|------|---------|-------|
| `fields` | `number` | `4` | Cantidad de campos de formulario por bloque |
| `cards` | `number` | `1` | Número de bloques/tarjetas lado a lado (1-4) |
| `hasTabs` | `boolean` | `false` | Renderiza un tab-bar en la parte superior |
| `tabs` | `number` | `3` | Cantidad de tabs simulados (si `hasTabs` es true) |

### `SkeletonShell`

| prop | type | default | notes |
|------|------|---------|-------|
| `isLoading` | `boolean` | **Obligatorio** | Activa la animación shimmer y `aria-busy` |
| `children` | `ReactNode` | **Obligatorio** | El DOM real a "congelar" con el efecto |

---

## `PageLayoutSkeleton` — Layout Family

Wrappers de alto nivel para estandarizar la carga de rutas completas.

- **`PageHeaderSkeleton`**: Mock de la barra superior (Título + Descripción + Acciones).
- **`PageTabsSkeleton`**: Mock de la barra de navegación por pestañas.
- **`ToolbarSkeleton`**: Mock de la barra de herramientas de tablas (Búsqueda + Botones).
- **`HubSkeleton`**: Mock especializado para el Command Center (Hub) con sus 4 fases verticales.

#### Props de `PageLayoutSkeleton`

| prop | type | default | notes |
|------|------|---------|-------|
| `hasTabs` | `boolean` | `false` | Incluye `PageTabsSkeleton` |
| `tabsCount` | `number` | `3` | Cantidad de pestañas en el skeleton |
| `hasToolbar` | `boolean` | `false` | Incluye `ToolbarSkeleton` |
| `contentType` | `'table' \| 'card' \| 'form' \| 'custom'` | `'table'` | Define el cuerpo del skeleton |

---

## `LoadingFallback` 🟡

Fallback estandarizado para usar en `Suspense` boundaries.

| prop | type | required | default | notes |
|------|------|----------|---------|-------|
| `message` | `string` | ❌ | `'Cargando...'` | |
| `className` | `string` | ❌ | — | |

> Usar `LoadingFallback` en `<Suspense fallback={...}>` de rutas. No es un skeleton estructural — es un indicador de carga mínimo para boundaries de React.
