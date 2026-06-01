---
doc: pos-selector-audit
status: planned
owner: frontend-team
last_review: 2026-05-19
---

# Auditoría: Migración del Selector de Productos POS → Shared Component

Documento de auditoría técnica para la iniciativa de extraer el selector de productos del POS (búsqueda, filtrado por categorías, grilla de productos y selección de variantes) como un componente shared reutilizable en `@/components/shared/ProductSelector/`.

> **Plan de implementación ejecutable**: ver [implementation-plan.md](./implementation-plan.md).

---

## Motivación

El selector de productos del POS es una UI rica y bien optimizada (virtualización con VirtuosoGrid, filtrado en tiempo real, soporte táctil, manejo de variantes con cálculo de stock) que podría reutilizarse en:

- **Calculadora de costos** (a implementar) — selección de producto base sin restricciones de stock.
- **Módulo de Producción / Órdenes de Trabajo** — selección de producto a fabricar.
- **Compras** — selección de producto comprable.

Actualmente el 100% de esta UI vive en `@/features/pos/components/` con acoplamiento directo al `POSContext`.

---

## Inventario de la Superficie

### Componentes visuales

| Componente | Archivo actual | LOC | Acoplamiento POS |
|---|---|---|---|
| `SearchBar` | `pos/components/SearchBar.tsx` | 61 | 🟢 Ninguno — sólo `useDeviceContext` |
| `CategoryFilter` | `pos/components/CategoryFilter.tsx` | 103 | 🟡 Bajo — tipo `Category` de `@/types/pos` |
| `ProductGrid` | `pos/components/ProductGrid.tsx` | 262 | 🟡 Medio — tipos + lógica de deshabilitado |
| `POSVariantSelectorModal` | `pos/components/POSVariantSelectorModal.tsx` | 184 | 🔴 Alto — `bomCache`, `componentCache`, `calculateMaxQty`, `pos_session_id` |

### Hooks involucrados

| Hook | Ubicación actual | Debe migrar |
|---|---|---|
| `useProducts` (POS) | `pos/hooks/useProducts.ts` | ❌ No — tiene efectos sobre `POSContext`. Se crea un hook genérico en `inventory/hooks/` |
| `useStockValidation` | `pos/hooks/useStockValidation.ts` | ❌ No — 100% acoplado al carrito POS |
| `useDeviceContext` | `hooks/useDeviceContext.ts` | ✅ Ya es shared |

### Dependencias de tipos

| Tipo | Fuente actual | Plan |
|---|---|---|
| `Product` | `@/types/pos` | Definir `BaseProduct` en `@/types/inventory` y extender en POS |
| `Category` | `@/types/pos` | Mover a `@/types/inventory` |
| `StockLimits` | `@/types/pos` | Mantener en POS; pasar como prop opcional en shared |
| `Variant` | `@/types/pos` (= `Product`) | Mismo tratamiento que `Product` |

---

## Análisis de Riesgo por Componente

### 🟢 SearchBar — Riesgo nulo

El componente recibe `value`, `onChange`, `onEnter`, `placeholder`. No consume contexto alguno del POS. La única dependencia es `useDeviceContext`, que ya vive en `@/hooks/`. **Se puede mover directamente sin modificar la lógica.**

### 🟢 CategoryFilter — Riesgo bajo

Depende del tipo `Category` importado desde `@/types/pos`. Este tipo es suficientemente genérico (`id`, `name`, `icon?`) para vivir en `@/types/inventory`. El componente no consume ningún contexto ni estado del POS.

### 🟡 ProductGrid — Riesgo medio

**Problema 1 — Lógica de deshabilitado embebida:**

```ts
// Dentro de ProductGrid — reglas POS-específicas:
const isStorableNoStock = type === 'STORABLE' && qty <= 0
const isMfgDisabled =
  mfgSubType === 'SIMPLE' ? qty <= 0
  : mfgSubType === 'EXPRESS' ? !has_bom || manufacturable_quantity === 0
  : false
```

Estas reglas son válidas en el POS pero **no aplican** en la calculadora de costos (donde se necesitan ver todos los productos sin importar stock).

**Solución:** prop de estrategia `isProductDisabled?: (product: Product) => boolean`. El POS inyecta su función; otros consumidores omiten la prop (default `() => false`).

**Problema 2 — `VirtuosoGrid` requiere altura definida en el contenedor padre.** El componente shared debe documentar esta restricción en su contrato.

**Problema 3 — Tipos `Product` y `StockLimits` desde `@/types/pos`.** Se resuelve moviendo la definición base a `@/types/inventory`.

### 🔴 POSVariantSelectorModal — Riesgo alto

**Acoplamiento 1 — Props de cálculo de stock:**

```ts
bomCache: Record<number, Record<string, unknown>>
componentCache: Record<number, { stock: number, uom: number }>
calculateMaxQty: (product: Variant, qty?: number, cartItemId?: string) => Promise<number>
```

**Solución:** hacerlas opcionales. Sin `calculateMaxQty`, el modal asume disponibilidad ilimitada (comportamiento correcto fuera del POS).

**Acoplamiento 2 — Endpoint incluye `pos_session_id`:**

```ts
const params = storedSessionId ? `&pos_session_id=${storedSessionId}` : ''
api.get(`/inventory/products/?parent_template=${product.id}...${params}`)
```

**Solución:** inyectar `posSessionId?: number | null` como prop. Cuando es `undefined`/`null`, el param no se adjunta. El backend ya maneja correctamente la ausencia del param.

**Acoplamiento 3 — Fetch de variantes dentro del modal (violación de invariante #4).**

El modal llama `api.get()` directamente. Se debe extraer a un hook `useVariants` en `@/features/inventory/hooks/`.

---

## Propuesta de API del Componente Shared

```tsx
// @/components/shared/ProductSelector/index.tsx

interface ProductSelectorProps {
  // Datos
  products: Product[]
  categories: Category[]

  // Control de filtros (controlado desde afuera)
  searchTerm: string
  onSearchChange: (term: string) => void
  selectedCategoryId: number | null
  onCategoryChange: (id: number | null) => void

  // Grid
  onProductClick: (product: Product) => void
  limits?: StockLimits                              // POS lo pasa; otros no
  isProductDisabled?: (product: Product) => boolean // default: () => false
  onToggleFavorite?: (productId: number) => void    // omitir = oculta botón corazón
  showFavorites?: boolean                           // default: true si se pasa onToggleFavorite

  // Variantes (opcional — si se omite, variantes no abren modal)
  variantSelectorConfig?: VariantSelectorConfig
}

interface VariantSelectorConfig {
  calculateMaxQty?: (v: Variant, qty?: number, cartItemId?: string) => Promise<number>
  items?: CartItem[]
  bomCache?: Record<number, Record<string, unknown>>
  componentCache?: Record<number, { stock: number; uom: number }>
  posSessionId?: number | null
}
```

```tsx
// @/components/shared/ProductSelector/VariantSelectorModal.tsx
interface VariantSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSelect: (variant: Variant) => void
  posSessionId?: number | null
  calculateMaxQty?: (v: Variant, qty?: number, cartItemId?: string) => Promise<number>
  items?: CartItem[]
  bomCache?: Record<number, Record<string, unknown>>
  componentCache?: Record<number, { stock: number; uom: number }>
}
```

---

## Casos de Uso Documentados

| Módulo | Variantes | Stock limits | Favoritos | `isProductDisabled` |
|---|---|---|---|---|
| POS (actual) | ✅ + max qty | ✅ | ✅ | Lógica STORABLE/MFG |
| Calculadora de costos | 🟡 sólo template | ❌ | ❌ | `() => false` |
| Órdenes de Trabajo | ❌ | ❌ | ❌ | `() => false` |
| Compras | 🟡 opcional | ❌ | ❌ | `() => false` |

---

## Restricciones y No-Regresiones

1. **`VirtuosoGrid` necesita un contenedor con `height` definida.** El contrato del componente shared debe documentarlo explícitamente.
2. **El POS no debe perder ninguna funcionalidad** — la extracción es aditiva; el código POS pasa a ser un consumidor del shared con todas sus props especializadas.
3. **El hook `useProducts` del POS no migra** — mantiene su acoplamiento al `POSContext`. Se creará un hook genérico `useProductSearch` en `@/features/inventory/hooks/` que el POS puede usar internamente.
4. **`useStockValidation` no migra** — es 100% dependiente del carrito POS.
5. **Invariante #4**: el fetch de variantes en `POSVariantSelectorModal` debe migrar a un hook `useVariants` en `@/features/inventory/hooks/`.
