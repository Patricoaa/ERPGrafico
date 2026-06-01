---
layer: 50-audit
doc: fsd-data-layer-refactor-plan
status: active
owner: core-team
last_review: 2026-05-22
stability: living-document-updated-per-feature
---

# FSD Data Layer Refactor — plan de implementación por feature

Plan operacional para llevar todas las features del frontend al patrón FSD canónico definido en [frontend-fsd.md](../10-architecture/frontend-fsd.md): `queryKeys.ts` + `hooks/use<Entity>.ts` con `useMutation` + componentes que consumen el hook (sin `api.put/post/delete` directo).

Snapshot del estado actual: [fsd-data-layer-audit.md](fsd-data-layer-audit.md).

## Objetivo

Para cada feature con mutaciones activas:

1. **`queryKeys.ts`** con factory jerárquica (`all → lists → list(filters) → details → detail(id)`).
2. **`api/<feature>Api.ts`** con funciones puras que envuelven el cliente HTTP.
3. **`hooks/use<Entity>.ts`** que expone `useQuery` para reads y `useMutation` para writes, **siempre con `invalidateQueries` en `onSuccess`** apuntando a las keys correctas.
4. **Componentes** que importan desde el hook (no desde `@/lib/api` ni TanStack directo).

Cuando todas las features críticas estén migradas, el caché será coherente tras cualquier mutación (local), y el [entity bus](../20-contracts/realtime-channels.md#entity-bus--refresco-de-listados-y-modales) podrá extenderse más allá de `sales` sin que cada feature requiera tratamiento especial.

## Patrón objetivo — referencia ejecutable

Referencia canónica: feature [`contacts`](../../frontend/features/contacts/) (parcialmente compliant, sirve como esqueleto). Estructura objetivo para cada feature:

```
features/<feature>/
├── api/
│   └── <feature>Api.ts        ← funciones (list, get, create, update, delete)
├── hooks/
│   ├── queryKeys.ts            ← factory jerárquica
│   ├── use<Entity>.ts          ← hook principal con useQuery + useMutation
│   └── ... (hooks adicionales por sub-entidad)
├── components/
│   ├── <Entity>List.tsx        ← consume hook, NO api directo
│   ├── <Entity>Form.tsx        ← consume hook
│   └── <Entity>DetailClient.tsx ← consume hook
├── types.ts
└── index.ts                    ← barrel: exporta hooks y componentes públicos
```

### `queryKeys.ts` — esqueleto

```ts
import { ProductFilters } from '../types'

export const PRODUCTS_KEYS = {
    all: ['products'] as const,
    lists: () => [...PRODUCTS_KEYS.all, 'list'] as const,
    list: (filters?: ProductFilters) => [...PRODUCTS_KEYS.lists(), { filters }] as const,
    details: () => [...PRODUCTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...PRODUCTS_KEYS.details(), id] as const,
}
```

Reglas:

- `all` siempre como const tupla — base para invalidación masiva.
- `lists()` y `details()` como prefijos invalidables (sin args).
- `list(filters)` y `detail(id)` con args específicos.
- Si la entidad tiene sub-recursos (ej. `Product.variants`, `Order.lines`): agregar nodos derivados (`variants(productId)`, `lines(orderId)`).

### `api/<feature>Api.ts` — esqueleto

```ts
import api from '@/lib/api'
import type { Product, ProductFilters, ProductPayload } from '../types'

export const productsApi = {
    list: (filters?: ProductFilters) =>
        api.get<Product[]>('/inventory/products/', { params: filters }).then(r => r.data),
    get: (id: number) =>
        api.get<Product>(`/inventory/products/${id}/`).then(r => r.data),
    create: (payload: ProductPayload) =>
        api.post<Product>('/inventory/products/', payload).then(r => r.data),
    update: (id: number, payload: Partial<ProductPayload>) =>
        api.put<Product>(`/inventory/products/${id}/`, payload).then(r => r.data),
    remove: (id: number) =>
        api.delete(`/inventory/products/${id}/`).then(r => r.data),
}
```

**Esta es la única capa** que puede importar `@/lib/api`. Ningún componente, ningún hook fuera de `features/*/api/`.

### `hooks/useProducts.ts` — esqueleto

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsApi } from '../api/productsApi'
import { PRODUCTS_KEYS } from './queryKeys'
import { useRealtime } from '@/features/realtime'
import type { ProductFilters, ProductPayload } from '../types'

export function useProducts({ filters }: { filters?: ProductFilters } = {}) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: products, isLoading, refetch } = useQuery({
        queryKey: PRODUCTS_KEYS.list(filters),
        queryFn: () => productsApi.list(filters),
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.lists() })
        queryClient.invalidateQueries({ queryKey: PRODUCTS_KEYS.details() })
    }

    const createMutation = useMutation({
        mutationFn: productsApi.create,
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto creado')
            invalidate()
        },
        onError: (e: Error) => toast.error(`Error al crear: ${e.message}`),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<ProductPayload> }) =>
            productsApi.update(id, payload),
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto actualizado')
            invalidate()
        },
        onError: (e: Error) => toast.error(`Error al actualizar: ${e.message}`),
    })

    const deleteMutation = useMutation({
        mutationFn: productsApi.remove,
        onSuccess: () => {
            markLocalMutation()
            toast.success('Producto eliminado')
            invalidate()
        },
        onError: (e: Error) => toast.error(`Error al eliminar: ${e.message}`),
    })

    return {
        products,
        isLoading,
        refetch,
        createProduct: createMutation.mutateAsync,
        updateProduct: updateMutation.mutateAsync,
        deleteProduct: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}

export function useProduct(id: number | null) {
    return useQuery({
        queryKey: id ? PRODUCTS_KEYS.detail(id) : ['no-id'],
        queryFn: () => productsApi.get(id!),
        enabled: !!id,
    })
}
```

Observaciones:

- `markLocalMutation()` se llama **antes** del toast para que el filtro `ignoreOwnActor` del entity bus funcione.
- `invalidate()` invalida `lists()` Y `details()` — esto es lo que hoy falta en la mayoría de hooks.
- El detalle se expone también como hook (`useProduct(id)`), de modo que `useSelectedEntity` pueda eventualmente migrar a `queryKeyFn: (id) => PRODUCTS_KEYS.detail(Number(id))` (opción C del plan original).

### Uso en componente — el patrón obligatorio

```tsx
'use client'

import { useProducts } from '../hooks/useProducts'

export function ProductForm({ initialData, onSuccess }: Props) {
    const { createProduct, updateProduct, isCreating, isUpdating } = useProducts()

    async function onSubmit(data: ProductPayload) {
        if (initialData) {
            await updateProduct({ id: initialData.id, payload: data })
        } else {
            await createProduct(data)
        }
        onSuccess?.()
    }
    // ...
}
```

Cero `import api from '@/lib/api'`. Cero `useMutation` directo. Las toasts y la invalidación viven en el hook, no en el componente.

## Prerrequisito mecánico — ESLint rule ✅ implementado (2026-05-22)

El config actual ([frontend/eslint.config.mjs](../../frontend/eslint.config.mjs)) ahora aplica:

- `useQuery`/`useMutation`/`useSuspenseQuery` directos en `features/*/components/**` — invariante #4, severidad **`error`**.
- `import … from '@/lib/api'` en `components/shared/**` y `components/ui/**` — bloqueado por `boundaries/dependencies` (`error`).
- `import … from '@/lib/api'` en `features/*/components/**` — invariante #5, severidad **`warn`** vía la regla custom `fsd/no-api-in-component` definida en [frontend/eslint-rules/fsd-no-api-in-component.mjs](../../frontend/eslint-rules/fsd-no-api-in-component.mjs).

**Por qué una regla custom y no extender `no-restricted-imports`:** ESLint flat-config sobrescribe `no-restricted-imports` entre bloques que matchean los mismos files (las opciones no se mergean). Un segundo bloque con `no-restricted-imports` en `features/*/components/**` clobbearía la restricción `error` de tanstack ya existente. Una regla con nombre distinto (`fsd/no-api-in-component`) compone sin colisión y permite severidad independiente.

Caminos descartados:

- ~~**Big-bang error** sobre `no-restricted-imports`~~: además de la colisión anterior, romperíamos el lint con 74 violaciones simultáneas.
- ~~**Manual review en PR**~~: frágil; sin barrera mecánica las features migradas pueden regresar silenciosamente.

**Cómo evoluciona la severidad:**

| Estado del refactor | Severidad en config | Acción |
|---|---|---|
| Hoy (74 violaciones) | `warn` | Cada PR de migración baja el conteo. El warning aparece en `npm run lint` y es visible para el reviewer. |
| 0 violaciones globales | `error` | Cambiar `"fsd/no-api-in-component": "warn"` → `"error"` en [frontend/eslint.config.mjs](../../frontend/eslint.config.mjs). |

Comando de medición del progreso (apoyo al audit):

```bash
cd frontend && npm run lint 2>&1 | grep -c "fsd/no-api-in-component"
```

Barreras mecánicas complementarias ya activas:

- `boundaries/dependencies` prohíbe que `components/shared/**` toque `lib/api`.
- `no-restricted-imports` prohíbe `useQuery`/`useMutation` en feature components (`error`).
- Cross-feature: `no-restricted-imports` `error` sobre `@/features/*/{components,hooks,api,types}/*` — solo se importa desde barrel.

## Orden de migración

Priorizado por: (a) violaciones absolutas, (b) frecuencia de uso del módulo, (c) dependencias entre features.

| Orden | Feature | Esfuerzo | Razón del orden |
|---|---|---|---|
| 1 | **inventory** | 2 días | Peor ofensor (21 #5). Productos es la entidad más referenciada del sistema (sales, purchasing, billing, stock dependen) |
| 2 | **sales** | 1 día | Ya en piloto del entity bus. Completar para que el bus tenga `markLocalMutation` correcto en TODOS los wizards/forms |
| 3 | **treasury** | 1.5 días | 12 violaciones. Cubre POS sessions + payments — usado por sales y billing |
| 4 | **purchasing** | 1 día | 9 violaciones. Tiene `queryKeys.ts` ya, pero falta `api/` folder |
| 5 | **billing** | 1 día | 5 violaciones. Tiene estructura, falta completar |
| 6 | **orders** (aggregator) | 0.5 días | 8 violaciones pero es feature-aggregator. Más simple si los upstream (sales, purchasing) ya están limpios |
| 7 | **production** | 1.5 días | 4 #5 + 3 #4. Sin queryKeys.ts ni api/. Refactor más profundo |
| 8 | **settings** | 1.5 días | Transversal — muta entidades de otros módulos. Hacer al final cuando los hooks de cada dominio existan |
| 9 | **finance** | 1 día | 8 violaciones, sin infra FSD |
| 10 | **pos** | 1 día | 4 violaciones. Crítico para venta diaria pero tiene flujo propio (draft sync, WS dedicado) |
| 11 | Resto (hr, tax, users, workflow, auth) | 1 día c/u | <5 violaciones |

**Total estimado:** ~12-13 días de trabajo enfocado. **Realizable incrementalmente**: cada feature es independiente y entrega valor visible al usuario al completarse.

## Criterios de aceptación por feature

Una feature está migrada cuando cumple todos estos checks:

- [ ] Existe `features/<feature>/hooks/queryKeys.ts` con factory jerárquica.
- [ ] Existe `features/<feature>/api/<feature>Api.ts`. Solo este archivo importa `@/lib/api`.
- [ ] Existe `features/<feature>/hooks/use<Entity>.ts` por cada entidad mutable.
- [ ] Cada `useMutation.onSuccess` invalida `KEYS.lists()` Y `KEYS.details()` mínimo. Para sub-entidades, también el padre.
- [ ] Cada `useMutation.onSuccess` llama `markLocalMutation()` del `RealtimeProvider`.
- [ ] `grep -r "from '@/lib/api'" features/<feature>/components/` retorna **0 resultados**.
- [ ] `grep -rE "useQuery\|useMutation" features/<feature>/components/` retorna **0 resultados** (excepto `useQueryClient` si se necesita para casos puntuales).
- [ ] Tests de tipo pasan (`npm run type-check`).
- [ ] Tests existentes siguen pasando (`npm run test -- features/<feature>`).
- [ ] Smoke manual: crear/editar/eliminar una entidad y verificar que tanto la lista como cualquier panel de detalle abierto reflejan el cambio sin recargar.

## Cómo extender el entity bus al feature una vez migrado

Cuando la feature cumple los criterios de aceptación, agregar la entidad al bus es trivial:

**Backend** ([backend/core/entity_bus.py](../../backend/core/entity_bus.py)):

```python
ALLOWLIST: set[tuple[str, str]] = {
    ("sales", "saleorder"),
    ("inventory", "product"),   # ← nuevo
}
PARENT_BROADCASTS: dict[tuple[str, str], tuple[str, str, str]] = {
    ("sales", "saleline"): ("sales", "saleorder", "order_id"),
    ("inventory", "productvariant"): ("inventory", "product", "product_id"),  # ← nuevo
}
```

**Frontend** — donde quiera que se monte una lista o detalle:

```ts
useEntitySubscription('inventory.product', [PRODUCTS_KEYS.lists()])
useEntitySubscription(`inventory.product.${id}`, [PRODUCTS_KEYS.detail(id)])
```

El bus invalida exactamente las keys que las mutaciones ya invalidan. Cero plumbing extra por componente.

## Validación cross-feature

Tras cada feature migrada, antes de mergear:

1. **TypeScript:** `cd frontend && npm run type-check`.
2. **Lint con la nueva regla activa:** `npm run lint -- --max-warnings 0`.
3. **Smoke test cross-feature:** abrir dos tabs sobre la entidad migrada y validar que mutaciones en tab A se reflejan en tab B (entity bus debe estar habilitado para esa entidad).
4. **Búsqueda de regresiones:** `grep -rn "import api from" features/<feature>/components/` debe retornar vacío.

## Tracking de progreso

| Feature | qK | api/ | hooks | components | bus extendido | Done |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **inventory** | ✓ | ✓ | ✓ | ✓ | pendiente | **✅ (22 commits)** |
| **sales** | ✓ | ✓ | ✓ | ✓ | ✓ (saleorder) | **✅ (8 commits)** |
| **treasury** | ✓ | ✓ | ✓ | ✓ | pendiente | **✅ (12 commits)** |
| **purchasing** | ✓ | ✓ | ✓ | ✓ | ✗ | **✅** |
| **billing** | ✓ | ✓ | ✓ | ✓ | ✗ | **✅** |
| **orders** | ✓ | ✓ | ✓ | ✓ | n/a (aggregator) | **✅** |
| **production** | ✓ | ✓ | ✓ | ✓ | ✗ | **✅** |
| **settings** | ✓ | ✓ | ✓ | ✓ | n/a (cross-domain) | **✅** |
| finance | ✗ | ✗ | parcial | ✗ | ✗ | ⏳ |
| pos | ✗ | ✗ | parcial | ✗ | n/a (WS dedicado) | ⏳ |
| hr | ✗ | ✓ | parcial | parcial | ✗ | ⏳ |
| tax | ✗ | ✗ | ✗ | ✗ | ✗ | ⏳ |
| users | ✗ | ✗ | parcial | ✗ | ✗ | ⏳ |
| workflow | ✗ | ✓ | parcial | parcial | ✗ | ⏳ |
| auth | ✗ | ✗ | ✗ | parcial | n/a | ⏳ |

Mantener esta tabla actualizada en cada PR que cierre una feature.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Regresión funcional al cambiar capa de llamadas | Hacer una feature a la vez. PR pequeño. Tests existentes deben pasar. Smoke manual antes de mergear. |
| Conflictos con trabajo en curso | Coordinar con quien tenga branches activas en el feature antes de arrancar. Rebase frecuente. |
| Drift entre features ya migradas | ESLint rule debe estar activa desde el día 1. Sin eso el progreso se pierde. |
| Sub-entidades olvidadas (variants, lines, etc.) | El acceptance check incluye `grep` recursivo en `components/`. No solo la entidad principal. |
| Aumento momentáneo del bundle (más hooks/archivos) | Negligible — los hooks son tree-shakeable. Tras migración, los `useQuery` directos desaparecen. |

## Manejo de desviaciones de contrato

Una vez completada la migración, el contrato sigue vivo: features nuevas o refactors pueden desviarse. Este protocolo define cómo se detecta, evalúa y resuelve una desviación entre lo que hace el código y lo que prescriben los contratos ([hook-contracts.md](../../20-contracts/hook-contracts.md), [frontend-fsd.md](../../10-architecture/frontend-fsd.md), invariantes #4/#5 de [CLAUDE.md](../../../CLAUDE.md)).

### 1. Cómo detectar desviaciones

**Señales mecánicas** (CI las atrapa solas):

```bash
cd frontend && npm run lint -- --max-warnings 0     # bloquea cualquier nueva violación
cd frontend && npm run type-check                   # bloquea `any` escapados
```

**Auditoría periódica** (correr mensualmente o tras cualquier merge grande):

```bash
# 1. Violaciones de invariante #5 (api directo en componentes)
cd frontend && npm run lint 2>&1 | grep -c "fsd/no-api-in-component"

# 2. Violaciones de invariante #4 (useQuery/useMutation en componentes)
grep -rE "useQuery\(|useMutation\(" frontend/features/*/components/ | wc -l

# 3. Features sin queryKeys.ts
for f in frontend/features/*/; do
  fname=$(basename "$f")
  [ ! -f "${f}hooks/queryKeys.ts" ] && echo "FALTA: $fname"
done

# 4. Features sin api/ folder
for f in frontend/features/*/; do
  fname=$(basename "$f")
  [ ! -d "${f}api" ] && echo "FALTA api/: $fname"
done

# 5. Mutations que olvidan markLocalMutation
grep -rL "markLocalMutation" frontend/features/*/hooks/ | xargs grep -l "useMutation"
```

Cualquier número distinto del snapshot anterior es una desviación. Si subió, hay que clasificarla.

### 2. Clasificación de la desviación

| Tipo | Ejemplo | Acción |
|---|---|---|
| **A. Regresión** — el código viola un contrato vigente sin justificación | Componente nuevo importa `@/lib/api` en lugar de pasar por un hook | **Rechazar PR** o abrir issue. El código se ajusta al contrato. |
| **B. Excepción legítima** — el contrato no aplica a este caso y nunca aplicará | Una feature aggregator no debe tener `queryKeys.ts` propios | Documentar la excepción en el contrato (no en el código). El código queda como está. |
| **C. Contrato desactualizado** — la realidad del proyecto cambió y el contrato no | El equipo decidió que todas las features usen Variant B y ya no se acepta Variant A | **Actualizar el contrato vía ADR** (si toca arquitectura) o vía edición directa con review (si es ajuste menor). Luego ajustar código que no cumpla. |
| **D. Nueva regla emergente** — un patrón se repite ≥3 veces y conviene contractualizarlo | 3 features han escrito el mismo helper de `useEntitySubscription` | Promover a contrato + posiblemente a `/hooks/` global. ADR si el patrón cambia arquitectura. |

### 3. Procedimiento — paso a paso

1. **Identificar el tipo** (A/B/C/D) con la tabla anterior. Si dudás, asumir A.

2. **Para tipo A (regresión)**:
   - Devolver el PR con el link al contrato violado.
   - Si la regla violada todavía no tiene barrera mecánica, abrir issue para añadirla (modificar [frontend/eslint.config.mjs](../../../frontend/eslint.config.mjs) o [frontend/eslint-rules/](../../../frontend/eslint-rules/)).

3. **Para tipo B (excepción legítima)**:
   - Editar el contrato afectado añadiendo la excepción explícitamente (qué, dónde, por qué).
   - Ejemplo precedente: el patrón aggregator ya está documentado en [frontend-fsd.md §Aggregator pattern](../../10-architecture/frontend-fsd.md#aggregator-pattern-read-only-feature-without-root-barrel).
   - Si la excepción aplica a una sola feature, dejar un comentario `// CONTRACT-EXCEPTION: <doc>#<anchor>` en el código.

4. **Para tipo C (contrato desactualizado)**:
   - Si el cambio es estructural (afecta dataflow, capas, naming convention): nueva ADR en [docs/10-architecture/adr/](../../10-architecture/adr/). Numerar continuando la secuencia.
   - Si es un refinamiento menor (ajuste de tier de `staleTime`, regla de invalidación adicional): editar el contrato directamente con dos reviewers.
   - Actualizar este documento (`fsd-data-layer-refactor-plan.md`) o el audit (`fsd-data-layer-audit.md`) si el cambio modifica la metodología o tracking.

5. **Para tipo D (nueva regla emergente)**:
   - Confirmar la repetición (≥3 usos con `grep`).
   - Promover a contrato según donde corresponda:
     - Hook reutilizable → [hook-contracts.md §Global hooks](../../20-contracts/hook-contracts.md#global-hooks-promoted) + mover archivo a `frontend/hooks/`.
     - Patrón estructural → [frontend-fsd.md](../../10-architecture/frontend-fsd.md) + ADR si redefine capas.
     - Patrón de componente → [component-contracts.md](../../20-contracts/component-contracts.md).

6. **Después de cualquier cambio de contrato**: actualizar las tablas de estado relevantes (esta tabla, [audit](fsd-data-layer-audit.md#tabla-maestra-por-feature), [hook-contracts §Status per domain](../../20-contracts/hook-contracts.md#status-per-domain)) en el mismo PR.

### 4. Cuándo escalar la severidad mecánica

`fsd/no-api-in-component` está en `warn` mientras quedan violaciones. Reglas para subir a `error`:

| Condición | Acción |
|---|---|
| Métrica `grep -c "fsd/no-api-in-component"` == 0 durante 2 semanas | Cambiar `"warn"` → `"error"` en [frontend/eslint.config.mjs](../../../frontend/eslint.config.mjs). |
| Re-aparece una violación después del cambio | Aplicar el procedimiento (probablemente tipo A). NO bajar a `warn` para desbloquear el merge. |
| Excepción legítima requiere bypass | Usar `// eslint-disable-next-line fsd/no-api-in-component -- <razón + link a contrato>` con justificación inline. Reviewer obligatorio. |

El mismo principio aplica a cualquier futura regla añadida bajo el patrón "warn durante migración → error tras compliance": empezar permisiva, escalar cuando el contador llega a 0.

### 5. Mantenimiento del audit

[fsd-data-layer-audit.md](fsd-data-layer-audit.md) es un **snapshot** — su valor depende de mantener la frecuencia de re-medición. Convención:

- **Tras cada feature migrada**: actualizar la fila correspondiente en la tabla maestra + el contador de violaciones de la sección "Resumen ejecutivo".
- **Al detectar regresión vía CI**: añadir una nota en la sección "Top ofensores actuales" con la feature y el commit que la introdujo (para tracking, no para shaming).
- **Snapshots históricos**: no editar columnas pasadas — añadir una columna nueva. Permite ver la evolución y validar que el patrón "warn → error" funcionó.

## Referencias

- Audit del estado actual: [fsd-data-layer-audit.md](fsd-data-layer-audit.md)
- Arquitectura FSD: [frontend-fsd.md](../10-architecture/frontend-fsd.md)
- Patrón de mutación con realtime: [ADR-0026](../10-architecture/adr/0026-entity-bus-realtime-invalidation.md)
- Contrato del bus: [realtime-channels.md §entity-bus](../20-contracts/realtime-channels.md#entity-bus--refresco-de-listados-y-modales)
- Hook patch puente: commit `874fc7bd` (`staleTime: 0` en `useSelectedEntity`)
- Invariantes globales: [CLAUDE.md §Global invariants](../../CLAUDE.md#global-invariants-violate--pr-rejected)
- Restricción operativa: PYME single-node, presupuesto ~$0 (memoria auto-cargada)
