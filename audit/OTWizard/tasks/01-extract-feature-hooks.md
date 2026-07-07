---
layer: 50-audit
doc: ot-wizard-task-01
phase: 1
status: done
---

# Task 01 — Extraer `useQuery` a feature hooks

## Objetivo

Mover los 4 `useQuery` que viven dentro de [WorkOrderForm/index.tsx](../../../../frontend/features/production/components/forms/WorkOrderForm/index.tsx) a hooks bajo `features/production/hooks/`, eliminando la violación del invariante #4.

## Depende de

— (entrada al refactor)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/features/production/components/forms/WorkOrderForm/index.tsx` | Reemplaza `useQuery` por hooks |
| `frontend/features/production/hooks/useUoMs.ts` | **Nuevo** |
| `frontend/features/production/hooks/useProductDetail.ts` | **Nuevo** (compartible con otros forms) |
| `frontend/features/production/hooks/useActiveBom.ts` | **Nuevo** — sugiere `due_date` desde BOM |
| `frontend/features/production/hooks/useSaleOrderManufacturableLines.ts` | **Nuevo** — filtra líneas LINKED elegibles |
| `frontend/features/production/hooks/index.ts` | Re-export de los 4 nuevos |

> **Nota**: si `useUoMs` ya existe en otra feature (ej. inventory), reutilizarlo via barrel cruzando el límite **sólo** si está en `@/components/shared` o `@/hooks`. Si no existe, crearlo en `features/production/hooks/` y promover en task futura si se duplica.

## Cambios paso a paso

### 1.1 `useUoMs.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UoM } from '../types'

export const UOMS_QUERY_KEY = ['uoms'] as const

export function useUoMs(options: { enabled?: boolean } = {}) {
  return useQuery<UoM[]>({
    queryKey: UOMS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get('/inventory/uoms/')
      return res.data.results ?? res.data
    },
    enabled: options.enabled ?? true,
  })
}
```

### 1.2 `useProductDetail.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ProductMinimal } from '../types'

export function useProductDetail(productId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery<ProductMinimal | null>({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) return null
      const res = await api.get(`/inventory/products/${productId}/`)
      return res.data
    },
    enabled: (options.enabled ?? true) && !!productId,
  })
}
```

### 1.3 `useActiveBom.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface BomSuggestion {
  active: boolean
  estimated_prepress_min: number
  estimated_press_min: number
  estimated_postpress_min: number
}

export function useActiveBom(productId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery<BomSuggestion | null>({
    queryKey: ['bom-suggestion', productId],
    queryFn: async () => {
      const res = await api.get(`/production/boms/?product_id=${productId}`)
      const boms: BomSuggestion[] = res.data.results ?? res.data
      return boms.find(b => b.active) ?? null
    },
    enabled: (options.enabled ?? true) && !!productId,
  })
}
```

### 1.4 `useSaleOrderManufacturableLines.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SaleOrderLine } from '@/features/sales/types'

export function useSaleOrderManufacturableLines(saleOrderId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery<SaleOrderLine[]>({
    queryKey: ['saleOrderLines', saleOrderId],
    queryFn: async () => {
      if (!saleOrderId) return []
      const res = await api.get(`/sales/orders/${saleOrderId}/`)
      const lines: SaleOrderLine[] = res.data.lines ?? []
      return lines.filter(
        l => l.product_type === 'MANUFACTURABLE' && l.requires_advanced_manufacturing && !l.work_order_summary
      )
    },
    enabled: (options.enabled ?? true) && !!saleOrderId && saleOrderId !== '__none__' && saleOrderId !== 'none',
  })
}
```

### 1.5 Reemplazar en `WorkOrderForm/index.tsx`

- Eliminar los 4 `useQuery` (líneas ~73-102, ~208-220).
- Importar los hooks desde `'../../../hooks'` (barrel).
- Pasar `enabled: open` a cada hook donde aplique (mantener el comportamiento de "no fetch hasta que el modal abre").

### 1.6 Actualizar barrel

`frontend/features/production/hooks/index.ts`:

```ts
export { useUoMs, UOMS_QUERY_KEY } from './useUoMs'
export { useProductDetail } from './useProductDetail'
export { useActiveBom } from './useActiveBom'
export { useSaleOrderManufacturableLines } from './useSaleOrderManufacturableLines'
```

## Contrato

- **No cambia el comportamiento observable** — mismas queries, mismos `queryKey`s, mismas dependencias `enabled`.
- **No toca el backend**.
- Tipos: derivar de Zod cuando exista; si no, tipar manualmente con interfaces. **Cero `any`**.

## Criterios de aceptación

- [ ] `grep -rn "useQuery" frontend/features/production/components/forms/` retorna **0** matches.
- [ ] Los 4 hooks nuevos están exportados desde `features/production/hooks/index.ts`.
- [ ] `WorkOrderForm/index.tsx` reduce LOC (de ~511 a ~430±20).
- [ ] Comportamiento idéntico: abrir el form sigue triggereando las mismas 4 queries con los mismos params.
- [ ] Sin `any` ni `as any` introducidos.

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- features/production/components/forms/WorkOrderForm/__tests__
grep -rn "useQuery" features/production/components/forms/   # debe retornar 0
```

## Rollback

`git revert <commit>` — la task es aditiva (crea hooks) + sustitución 1-a-1, sin riesgo de side effects.
