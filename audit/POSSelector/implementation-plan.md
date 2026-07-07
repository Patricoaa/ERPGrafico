---
doc: pos-selector-implementation-plan
status: planned
owner: frontend-team
last_review: 2026-05-19
---

# Plan de Implementación: ProductSelector Shared Component

Documento ejecutable con las tareas concretas para migrar el selector de productos del POS a un componente shared reutilizable, organizado en 3 PRs incrementales.

> **Auditoría técnica completa**: ver [README.md](./README.md).

---

## Estado de PRs

| PR | Título | Estado | Estimado | Riesgo |
|---|---|---|---|---|
| PR-1 | Tipos base + SearchBar + CategoryFilter | ✅ Completado | 2–3 h | 🟢 Bajo |
| PR-2 | ProductGrid con estrategia de deshabilitado | ✅ Completado | 4–5 h | 🟡 Medio |
| PR-3 | VariantSelectorModal + ProductSelector orquestador | ✅ Completado | 6–8 h | 🔴 Medio-Alto |

Leyenda: ⏳ Pendiente · 🔄 En progreso · ✅ Completado · 🚫 Bloqueado

---

## PR-1 — Tipos base + extracción de SearchBar y CategoryFilter

**Objetivo**: sentar las bases de tipos en `@/types/inventory` y mover los dos componentes sin acoplamiento POS al shared. Sin cambios visibles para el usuario final.

**Precondiciones**:
- Leer `docs/30-playbooks/add-shared-component.md` antes de empezar.
- `npm run type-check` verde antes de cualquier commit.

### Tareas

#### 1.1 — Tipos base en `@/types/inventory`

- [x] Crear (o extender) `frontend/types/inventory.ts` con:
  ```ts
  export interface BaseProduct {
    id: number
    code: string
    internal_code?: string
    name: string
    sale_price: string | number
    sale_price_gross?: string | number
    product_type?: 'STORABLE' | 'CONSUMABLE' | 'SERVICE' | 'MANUFACTURABLE' | 'SUBSCRIPTION' | string
    image?: string | null
    category?: { id: number; name: string; icon?: string | null } | number
    uom?: number
    uom_name?: string
    is_favorite?: boolean
  }

  export interface ProductCategory {
    id: number
    name: string
    icon?: string | null
  }
  ```
- [x] Hacer que `Product` en `@/types/pos` extienda `BaseProduct` añadiendo los campos POS-específicos.
- [x] Verificar que ningún import existente se rompa.

#### 1.2 — Extraer `SearchBar`

- [x] Crear `frontend/components/shared/ProductSelector/SearchBar.tsx` con el contenido actual de `pos/components/SearchBar.tsx` (sin cambios de lógica).
- [x] Crear `frontend/components/shared/ProductSelector/index.ts` con re-export de `SearchBar`.
- [x] Agregar `SearchBar` al barrel principal `frontend/components/shared/index.ts`.
- [x] En `pos/components/SearchBar.tsx`, reemplazar implementación por re-export desde shared:
  ```ts
  export { SearchBar } from '@/components/shared/ProductSelector'
  ```
- [x] Verificar que `POSClientView.tsx` importa desde el barrel `@/features/pos/components` (sin cambios necesarios).

#### 1.3 — Extraer `CategoryFilter`

- [x] Crear `frontend/components/shared/ProductSelector/CategoryFilter.tsx`:
  - Cambiar import `Category` de `@/types/pos` → `@/types/inventory` (`ProductCategory`).
  - Props: `categories: ProductCategory[]` (renombrado por claridad semántica).
  - Sin más cambios de lógica.
- [x] Re-exportar desde `frontend/components/shared/ProductSelector/index.ts`.
- [x] Agregar al barrel `frontend/components/shared/index.ts`.
- [x] En `pos/components/CategoryFilter.tsx`, reemplazar por re-export desde shared.

#### 1.4 — Validación

- [x] `npm run type-check` — cero errores nuevos.
- [x] `npm run lint` — cero warnings nuevos.
- [x] Navegación manual en POS: búsqueda y filtro de categorías funcionan idénticos.

**Criterios de éxito**: `SearchBar` y `CategoryFilter` en shared. POS funciona idéntico. 0 `any` nuevos.

---

## PR-2 — Extracción de `ProductGrid` con estrategia de deshabilitado

**Objetivo**: mover el `ProductGrid` a shared haciéndolo agnóstico a las reglas de negocio POS mediante una prop de estrategia. El POS inyecta sus reglas; otros consumidores omiten la prop.

**Precondiciones**:
- PR-1 completado y mergeado.
- `@/types/inventory.ts` con `BaseProduct` disponible.

### Tareas

#### 2.1 — Extraer lógica de deshabilitado a utilidad POS

- [x] Crear `frontend/features/pos/utils/product-availability.ts`:
  ```ts
  import type { Product } from '@/types/pos'

  /** Determina si un producto está disponible para venta en el POS */
  export function isPOSProductDisabled(product: Product): boolean {
    if (product.product_type === 'STORABLE') {
      return (product.qty_available ?? 0) <= 0
    }
    if (product.product_type === 'MANUFACTURABLE') {
      const mfgSubType = product.requires_advanced_manufacturing ? 'ADVANCED'
        : product.mfg_auto_finalize ? 'EXPRESS' : 'SIMPLE'
      if (mfgSubType === 'SIMPLE') return (product.qty_available ?? 0) <= 0
      if (mfgSubType === 'EXPRESS') return !product.has_bom || product.manufacturable_quantity === 0
    }
    return false  // SERVICE, CONSUMABLE, SUBSCRIPTION, ADVANCED MFG → siempre disponibles
  }
  ```

#### 2.2 — Crear `ProductGrid` shared

- [x] Crear `frontend/components/shared/ProductSelector/ProductGrid.tsx`:
  - Cambiar `ProductGridProps` para usar `BaseProduct` (importado de `@/types/inventory`).
  - Añadir prop: `isProductDisabled?: (product: BaseProduct) => boolean` — default `() => false`.
  - Reemplazar el bloque inline de cálculo de `isDisabled` por: `const isDisabled = isProductDisabled ? isProductDisabled(product) : false`.
  - Mantener toda la UI de badges de stock/manufactura (son sólo indicadores visuales, no lógica de habilitado).
  - Mantener `VirtuosoGrid`, memoización, y `useDeviceContext`.
  - Documentar en comentario: `// Requiere contenedor padre con height explícita (ej. flex-1 min-h-0)`.
- [x] Re-exportar desde `index.ts` del shared.

#### 2.3 — Actualizar `POSClientView` para inyectar la estrategia

- [x] En `POSClientView.tsx`, importar `isPOSProductDisabled` desde `@/features/pos/utils/product-availability`.
- [x] Pasar `isProductDisabled={isPOSProductDisabled}` al `ProductGrid`.

#### 2.4 — Re-export desde POS

- [x] En `pos/components/ProductGrid.tsx`, reemplazar por re-export desde shared.
- [x] Actualizar el skeleton `ProductGridSkeleton` si hace referencia interna.

#### 2.5 — Validación

- [x] `npm run type-check` — cero errores nuevos.
- [x] Test manual: productos STORABLE sin stock aparecen deshabilitados en POS.
- [x] Test manual: productos SERVICE siempre habilitados en POS.
- [x] Verificar que `VirtuosoGrid` renderiza correctamente (revisar altura del contenedor).

**Criterios de éxito**: `ProductGrid` en shared. Función `isPOSProductDisabled` testeable independientemente. 0 `any` nuevos.

---

## PR-3 — VariantSelectorModal + ProductSelector orquestador

**Objetivo**: extraer `POSVariantSelectorModal` como `VariantSelectorModal` genérico, crear el hook `useVariants` en inventory, y componer el componente `ProductSelector` final que orquesta los tres sub-componentes.

**Precondiciones**:
- PR-2 completado y mergeado.
- Existir al menos un segundo consumidor planificado (ej. calculadora de costos) que justifique la inversión.

### Tareas

#### 3.1 — Hook `useVariants` en inventory

- [x] Crear `frontend/features/inventory/hooks/useVariants.ts`:
  ```ts
  // Fetch de variantes para un producto template dado
  export function useVariants(productId: number | null, posSessionId?: number | null) {
    return useQuery({
      queryKey: ['variants', productId, posSessionId],
      queryFn: async () => {
        if (!productId) return []
        const params: Record<string, unknown> = {
          parent_template: productId,
          show_technical_variants: true,
          active: true,
        }
        if (posSessionId) params.pos_session_id = posSessionId
        const res = await api.get('/inventory/products/', { params })
        return res.data.results || res.data
      },
      enabled: !!productId,
      staleTime: 1000 * 30,
    })
  }
  ```
- [x] Exportar desde el barrel de inventory.

#### 3.2 — Extraer `VariantSelectorModal` a shared

- [x] Crear `frontend/components/shared/ProductSelector/VariantSelectorModal.tsx`:
  - Props base: `open`, `onOpenChange`, `product`, `onSelect`.
  - Props POS opcionales: `calculateMaxQty?`, `items?`, `bomCache?`, `componentCache?`, `posSessionId?`.
  - Usar el nuevo hook `useVariants` en lugar de `api.get` directo (corrige violación de invariante #4).
  - Cuando `calculateMaxQty` no se provee, asumir disponibilidad ilimitada (`max = Infinity`).
  - Lógica de `variantLimits` sólo se activa si se provee `calculateMaxQty`.
- [x] Re-exportar desde `index.ts` del shared.

#### 3.3 — Actualizar `POSClientView` para el nuevo modal

- [x] Cambiar import de `POSVariantSelectorModal` → `VariantSelectorModal` desde `@/components/shared`.
- [x] Pasar las props POS-específicas al modal (sin cambio de comportamiento).

#### 3.4 — Componer el orquestador `ProductSelector`

- [x] Crear `frontend/components/shared/ProductSelector/ProductSelector.tsx` que agrupe:
  - `SearchBar`
  - `CategoryFilter`
  - `ProductGrid`
  - `VariantSelectorModal` (si se provee `variantSelectorConfig`)
  
  Manejo interno del estado de apertura del modal de variantes.

- [x] Props según la interfaz definida en [README.md](./README.md#propuesta-de-api-del-componente-shared).
- [x] Registrar en `docs/20-contracts/component-decision-tree.md` sección "Selección de producto".

#### 3.5 — Documentación del contrato

- [x] Crear `docs/20-contracts/component-product-selector.md` con:
  - Cuándo usar `ProductSelector` vs. un `Combobox` simple.
  - Props contract completo.
  - Ejemplos de uso para POS y para calculadora de costos.
  - Restricción del contenedor (`height` requerida).

#### 3.6 — Deprecar `POSVariantSelectorModal`

- [x] Marcar `pos/components/POSVariantSelectorModal.tsx` como `@deprecated` con comentario apuntando al shared.
- [x] Programar eliminación en el siguiente sprint (añadir TODO con fecha).

#### 3.7 — Validación

- [x] `npm run type-check` — cero errores nuevos.
- [x] `npm run test` — cero regresiones.
- [x] Test manual POS — selección de variantes con cálculo de stock funciona idéntico.
- [x] Test manual en contexto sin stock (ej. smoke test en calculadora de costos simulada) — todas las variantes aparecen disponibles.

**Criterios de éxito**: componente `ProductSelector` usable desde cualquier feature sin conocer el POS. POS funciona idéntico. Contrato documentado en layer 20.

---

## Restricciones Transversales

- **Invariante #4** (no `@/lib/api` en componentes): toda llamada a API debe ir en un hook. El fetch de variantes en PR-3 debe usar `useVariants`.
- **Invariante #1** (zero `any`): los tipos `bomCache` y `componentCache` deben ser precisos. Si en el PR-3 son difíciles de tipar, usar `Record<number, unknown>` + type guard, nunca `any`.
- **Invariante #3** (no cross-feature imports): el componente shared NO importa desde `@/features/pos`. La info POS se inyecta por props.
- **Sin cambios de comportamiento en el POS**: cada PR termina con el POS funcionando igual que antes.

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `BaseProduct` vs `Product` POS causa errores de tipo en consumidores existentes | Media | Hacer que `Product` en POS extienda `BaseProduct` — retrocompatible |
| `VirtuosoGrid` pierde altura en nuevo contexto | Baja | Documentar restricción; el contenedor usa `flex-1 min-h-0` (ya probado en POS) |
| `calculateMaxQty` asíncrono causa flicker en modal de variantes | Baja | El comportamiento actual ya tiene este flicker; no se empeora |
| Backend rechaza variantes sin `pos_session_id` en otros contextos | Muy baja | El param ya es opcional en el backend hoy (sólo afecta stock en tiempo real) |
| Segundo consumidor (calculadora) demora y PR-3 queda sin justificación | Media | Evaluar antes de iniciar PR-3; Fases 1-2 tienen valor independiente |

---

## Estimación Total

| PR | Estimado | Riesgo |
|---|---|---|
| PR-1 | 2–3 h | 🟢 Bajo |
| PR-2 | 4–5 h | 🟡 Medio |
| PR-3 | 6–8 h | 🔴 Medio-Alto |
| **Total** | **12–16 h** | — |

Los PRs son independientes y pueden espaciarse en sprints distintos. PR-1 y PR-2 tienen valor por sí solos (bases de tipos reutilizables, `ProductGrid` genérico). PR-3 sólo se ejecuta cuando exista un segundo consumidor concreto.
