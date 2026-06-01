---
layer: 50-audit
doc: ot-wizard-task-05
phase: 3
status: completed
---

# Task 05 — Routing, deeplink, idempotency

## Objetivo

Migrar los URL params del flujo OT al esquema definido en [contracts.md §6](../contracts.md#6-url-params), añadir Idempotency-Key al POST de creación y garantizar que la URL se mantiene sincronizada con el estado del wizard.

## Depende de

- Task 04 (wizard unificado funcionando)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/app/(dashboard)/production/orders/page.tsx` | Adaptar parsing de params |
| `frontend/features/production/components/WorkOrderWizard.tsx` | Push/replace de URL en transiciones |
| `frontend/features/production/components/forms/WorkOrderBasicStep/index.tsx` | Header `Idempotency-Key` |
| `frontend/features/production/hooks/useWorkOrderMutations.ts` | Aceptar `idempotencyKey` opcional (si la creación migra a este hook) |

## Cambios paso a paso

### 5.1 Parsing en `page.tsx`

```ts
const isNew = searchParams.get('new') === 'true' || searchParams.get('modal') === 'new'  // alias legacy
const selectedId = searchParams.get('selected')
const requestedType = searchParams.get('type')           // 'stock' | 'sale'
const requestedProductId = searchParams.get('product_id') || undefined
const requestedStage = searchParams.get('step') || undefined

const wizardMode: WizardMode | null = useMemo(() => {
  if (isNew) {
    return {
      kind: 'create',
      defaultOtType: requestedType === 'stock' ? 'NONE' : requestedType === 'sale' ? 'LINKED' : undefined,
      defaultProductId: requestedProductId,
    }
  }
  if (selectedId) {
    return {
      kind: 'manage',
      orderId: Number(selectedId),
      targetStage: requestedStage as StageId | undefined,
    }
  }
  return null
}, [isNew, selectedId, requestedType, requestedProductId, requestedStage])
```

### 5.2 Render condicional

```tsx
{wizardMode && (
  <WorkOrderWizard
    mode={wizardMode}
    open={true}
    onOpenChange={(open) => { if (!open) closeWizard() }}
    onSuccess={refetchOrders}
  />
)}
```

### 5.3 Transición create → manage en la URL

Dentro de `WorkOrderWizard`, tras `setCurrentMode({ kind: 'manage', orderId })`:

```ts
const url = new URL(window.location.href)
url.searchParams.delete('new')
url.searchParams.delete('type')
url.searchParams.delete('product_id')
url.searchParams.set('selected', String(orderId))
router.replace(url.pathname + url.search, { scroll: false })
```

> **Replace, no push** — la creación es una transición lateral; no queremos que "atrás" reabra el formulario vacío.

### 5.4 Sync step → URL

Opcionalmente, cuando el usuario navega entre etapas dentro del wizard, actualizar `?step=STAGE_ID` (replace). Útil para enlaces compartibles.

```ts
useEffect(() => {
  if (currentMode.kind !== 'manage') return
  const stage = STAGES[viewingStepIndex]?.id
  if (!stage) return
  const url = new URL(window.location.href)
  if (url.searchParams.get('step') === stage) return
  url.searchParams.set('step', stage)
  router.replace(url.pathname + url.search, { scroll: false })
}, [viewingStepIndex, currentMode])
```

### 5.5 `closeWizard()`

```ts
const closeWizard = useCallback(() => {
  const params = new URLSearchParams(searchParams.toString())
  ;['new', 'modal', 'selected', 'type', 'product_id', 'step'].forEach(p => params.delete(p))
  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
}, [router, pathname, searchParams])
```

### 5.6 Idempotency-Key en el POST

En `WorkOrderBasicStep`:

```ts
const idempotencyKeyRef = useRef<string>(crypto.randomUUID())

// resetear al abrir
useEffect(() => {
  if (mode === 'create') idempotencyKeyRef.current = crypto.randomUUID()
}, [mode])

// uso en el axios call
await api.post('/production/orders/', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
    'Idempotency-Key': idempotencyKeyRef.current,
  },
})
```

> Backend puede ignorar el header sin error; al implementar server-side, la key dedupea reintentos en una ventana de N minutos.

### 5.7 Cleanup de aliases legacy

Tras un release de validación, eliminar el alias `?modal=new` y dejar sólo `?new=true`. Documentar el cambio en CHANGELOG.

## Contrato

- Ver [contracts.md §6](../contracts.md#6-url-params).
- Mantener `?modal=new` como alias durante 1 release.
- `?selected=ID&step=STAGE_ID` debe abrir el wizard en el step exacto.

## Criterios de aceptación

- [ ] `?new=true&type=stock&product_id=42` abre wizard en step 0 con producto preseleccionado.
- [ ] Tras crear OT, URL queda como `?selected=NEW_ID&step=MATERIAL_ASSIGNMENT` (replace, no push).
- [ ] Botón "atrás" del browser tras cerrar el wizard no reabre el form vacío.
- [ ] `?selected=123&step=PRESS` abre wizard en step PRESS si la OT lo permite.
- [ ] Cada POST `/production/orders/` lleva `Idempotency-Key` UUID.
- [ ] Alias `?modal=new` sigue funcionando.

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run dev
```

**Tests manuales**:

1. Navegar a `/production/orders?new=true&type=stock` → wizard abre en step 0 modo NONE.
2. Navegar a `/production/orders?modal=new` → ídem (legacy).
3. Crear OT → URL cambia a `?selected=ID&step=MATERIAL_ASSIGNMENT`.
4. Inspeccionar DevTools Network: el POST lleva `Idempotency-Key: <uuid>`.
5. Doble-click rápido en el botón submit → al menos uno se descarta o ambos usan la misma key.

## Rollback

`git revert <commit>` — los URL params nuevos coexisten con los legacy, sin breaking change.
