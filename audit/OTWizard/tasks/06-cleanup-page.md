---
layer: 50-audit
doc: ot-wizard-task-06
phase: 4
status: completed
---

# Task 06 — Cleanup `page.tsx` y `WorkOrderForm` wrapper

## Objetivo

Eliminar el doble render de `<WorkOrderForm>` + `<WorkOrderWizard>` en `production/orders/page.tsx`, dejando una única instancia de `<WorkOrderWizard>` que cubre todos los casos. Eliminar el wrapper `WorkOrderForm` ahora innecesario.

## Depende de

- Task 04 (wizard unificado)
- Task 05 (routing migrado)
- Validación manual mínima de 1 sprint con feature flag (opcional pero recomendado)

## Archivos afectados

| Path | Acción |
|---|---|
| `frontend/app/(dashboard)/production/orders/page.tsx` | Simplificar |
| `frontend/features/production/components/forms/WorkOrderForm/index.tsx` | **Eliminar** |
| `frontend/features/production/components/index.ts` | Quitar export de `WorkOrderForm` |
| Otros consumidores externos de `WorkOrderForm` | Migrar a `WorkOrderWizard` |

## Pre-checks

```bash
grep -rn "WorkOrderForm" frontend/ --include="*.tsx" --include="*.ts"
```

Consumidores a migrar (según el mapeo de la auditoría):

- `frontend/app/(dashboard)/production/orders/page.tsx`
- `frontend/features/orders/components/ActionCategory.tsx`
- `frontend/features/inventory/components/ProductInsightsModal.tsx`
- `frontend/components/providers/GlobalModalProvider.tsx`

Cada uno se migra a abrir el wizard con `mode: { kind: 'create', defaultOtType, defaultProductId }`.

## Cambios paso a paso

### 6.1 Simplificar `page.tsx`

```diff
- import { WorkOrderForm } from "@/features/production/components/forms/WorkOrderForm"
  import { WorkOrderWizard } from "@/features/production/components/WorkOrderWizard"

- const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null)
- const [isFormOpen, setIsFormOpen] = useState(false)
- const [activeWizardId, setActiveWizardId] = useState<number | null>(null)
+ // Single source of truth: wizardMode derivado de URL params
+ // (ver task 05)
```

Cualquier `setEditingOrder` / `setIsFormOpen` se reemplaza por un push de URL params:

```ts
// Editar OT — antes: setEditingOrder(order); setIsFormOpen(true)
// Ahora: navegar a ?selected=ID
router.push(`?selected=${order.id}`, { scroll: false })
```

### 6.2 Migrar consumidores externos

**Patrón general** — donde antes había:

```tsx
<WorkOrderForm open={…} onOpenChange={…} defaultOtType="NONE" defaultProductId="42" />
```

Ahora:

```tsx
<WorkOrderWizard
  mode={{ kind: 'create', defaultOtType: 'NONE', defaultProductId: '42' }}
  open={…}
  onOpenChange={…}
/>
```

O — preferiblemente — un `<Link href="/production/orders?new=true&type=stock&product_id=42">` que delega el control en la URL.

**En `ProductInsightsModal`**: el CTA "Crear OT para stock" debería ser un link, no un trigger imperativo.

**En `GlobalModalProvider`**: si exporta un modal global de OT, repensar — el wizard probablemente no debe ser global; debe estar montado sólo en `production/orders/page.tsx` para que el ciclo de vida coincida con la ruta.

### 6.3 Eliminar `WorkOrderForm`

```bash
rm -rf frontend/features/production/components/forms/WorkOrderForm/
```

Mover el test sobreviviente (si aplica) a `WorkOrderBasicStep/__tests__/`.

### 6.4 Limpiar export del barrel

```ts
// frontend/features/production/components/index.ts
- export { WorkOrderForm } from './forms/WorkOrderForm'
  export { WorkOrderBasicStep } from './forms/WorkOrderBasicStep'
  export { WorkOrderWizard } from './WorkOrderWizard'
```

### 6.5 Eliminar feature flag (si se introdujo en task 04)

```ts
- if (UNIFIED_WIZARD) { … } else { … }
+ // single path
```

## Contrato

- Cero breaking change a nivel URL externa — `?modal=new` sigue funcionando como alias en task 05.
- Consumidores que importaban `WorkOrderForm` deben migrar. Coordinar con dueños de cada feature.

## Criterios de aceptación

- [ ] `grep -rn "WorkOrderForm" frontend/ --include="*.tsx"` retorna **0** matches después del cleanup.
- [ ] `page.tsx` ya no tiene `useState<WorkOrder | null>` para `editingOrder`.
- [ ] El folder `frontend/features/production/components/forms/WorkOrderForm/` no existe.
- [ ] Todas las acciones de edit/create de OT en la app pasan por el wizard.
- [ ] `npm run build` pasa.
- [ ] LOC de `page.tsx` reducido en al menos 30 líneas.

## Validación

```bash
cd frontend
npm run type-check
npm run lint
npm run build
npm run test
grep -rn "WorkOrderForm" frontend/ --include="*.tsx" --include="*.ts"
```

**Smoke test completo**:

1. Crear OT manual desde toolbar.
2. Crear OT linked desde toolbar.
3. Crear OT desde `ProductInsightsModal` (link a `?new=true&type=stock&product_id=…`).
4. Editar OT en MATERIAL_ASSIGNMENT desde la tabla — debe abrir wizard en Step 0.
5. Editar OT en PRESS — debe abrir wizard en Step 0 read-only.
6. Cerrar wizard — URL limpia.

## Rollback

Si tras el cleanup surge una regresión:

1. `git revert` la task 06.
2. `WorkOrderForm/` reaparece como wrapper retrocompatible (sigue existiendo del lado de task 03).
3. Investigar consumidor faltante.
