# Phase 7 — Frontend

> Cero vistas nuevas. 1 shared component (`LegacyBadge`) + 1 helper (`lib/legacy.ts`) + 4 vistas/drawers existentes modificados + search global ajustado.

## Precondiciones

- [ ] Phases 1–6 cerradas (API unificada disponible).
- [ ] `npm run dev` corriendo sin errores previos.
- [ ] `npm run type-check` y `npm run lint` verdes antes de empezar.

## Tasks

| Task | Título | Salida |
|---|---|---|
| [T26](../tasks/T26-legacy-helper.md) | `lib/legacy.ts` | Helper puro |
| [T27](../tasks/T27-legacy-badge-shared.md) | `LegacyBadge.tsx` | Shared component + barrel export |
| [T28](../tasks/T28-sales-orders-view-chip.md) | Chip en SalesOrdersView | Render `<LegacyBadge />` |
| [T29](../tasks/T29-sale-order-drawer-readonly.md) | `SaleOrderDrawer` read-only | Branch `is_legacy` |
| [T30](../tasks/T30-sale-order-readonly-view.md) | `SaleOrderReadOnlyView` | Vista read-only interna |
| [T31](../tasks/T31-register-payment-drawer-bifurcation.md) | Bifurcación `RegisterPaymentDrawer` | Endpoint legacy |
| [T32](../tasks/T32-contact-list-view-chip.md) | Chip en ContactListView | Render `<LegacyBadge />` |
| [T33](../tasks/T33-contact-drawer-readonly.md) | `ContactDrawer` read-only | Branch `is_legacy` |
| [T34](../tasks/T34-global-search-excludes-legacy-contacts.md) | Search global | Excluir contactos legacy |
| [T35](../tasks/T35-zod-type-updates.md) | Zod types | `is_legacy` + `legacy_external_id` |

## Entregables

### 0.1 Nuevos (2)

- `frontend/lib/legacy.ts`.
- `frontend/components/shared/LegacyBadge.tsx`.
- `frontend/features/sales/components/SaleOrderReadOnlyView.tsx`.
- `frontend/features/contacts/components/ContactReadOnlyView.tsx`.

### 0.2 Modificados (~13)

- `frontend/components/shared/index.ts` (export `LegacyBadge`).
- `frontend/features/sales/types/index.ts` (`is_legacy`, `legacy_external_id` en Zod).
- `frontend/features/sales/api/salesApi.ts` (`include_legacy: true` default).
- `frontend/features/sales/hooks/useSalesOrders.ts`.
- `frontend/features/sales/components/SalesOrdersView.tsx`.
- `frontend/features/sales/components/SaleOrderDrawer.tsx`.
- `frontend/features/sales/components/RegisterPaymentDrawer.tsx`.
- `frontend/features/contacts/types/index.ts`.
- `frontend/features/contacts/api/contactsApi.ts`.
- `frontend/features/contacts/hooks/useContacts.ts`.
- `frontend/features/contacts/components/ContactListView.tsx`.
- `frontend/features/contacts/components/ContactDrawer.tsx`.
- `frontend/features/search/hooks/useGlobalSearch.ts`.

## DoD de la fase

- [ ] `npm run type-check` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npm run test -- legacy` pasa con 5+ tests.
- [ ] `SalesOrdersView` muestra chip `<LegacyBadge />` en filas legacy.
- [ ] `SaleOrderDrawer` entra en modo read-only cuando `is_legacy=true`.
- [ ] `RegisterPaymentDrawer` llama a `/api/legacy/sale-notes/<id>/register-payment/` cuando `is_legacy=true`.
- [ ] `ContactListView` muestra chip en filas legacy.
- [ ] `ContactDrawer` entra en modo read-only cuando `is_legacy=true`.
- [ ] `useGlobalSearch` incluye NVs legacy y excluye contactos legacy.
- [ ] No se introdujeron `any`, raw colors (excepto `LegacyBadge`), ni cross-feature imports.

## Decisiones tomadas en esta fase

1. **`LegacyBadge`** usa color `amber` (excepción al invariant de no raw colors, justificada y centralizada en 1 archivo).
2. **`lib/legacy.ts`** es puro: solo tipos y helpers, sin imports de features (cumple regla de barrel).
3. **`is_legacy` con `default(false)`** en Zod: código existente que crea `SaleOrder`/`Contact` no rompe.
4. **`SaleOrderReadOnlyView` y `ContactReadOnlyView`** son archivos internos al feature (no se exportan desde barrel).
5. **`useGlobalSearch`** usa `include_legacy: false` en contactos (decisión UX: "vendedor García" no es búsqueda frecuente).
6. **`RegisterPaymentDrawer` bifurcation** es interna al componente: mismo componente, mismo drawer, distinto endpoint.

## `LegacyBadge` shared

```tsx
// frontend/components/shared/LegacyBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LegacyBadge({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        'border-amber-200 dark:border-amber-800',
        'font-mono',
        size === 'md' && 'text-sm px-2.5 py-0.5',
        className,
      )}
    >
      <Clock className="mr-1 h-3 w-3" />
      LEGACY
    </Badge>
  );
}
```

**Export en barrel**:

```ts
// frontend/components/shared/index.ts
export * from './LegacyBadge';
```

## `lib/legacy.ts`

```ts
import type { SaleOrder } from '@/features/sales/types';
import type { Contact } from '@/features/contacts/types';

export function isLegacyContact(contact: Contact): boolean {
  return contact.is_legacy === true;
}

export function isLegacySaleOrder(order: SaleOrder): boolean {
  return order.is_legacy === true;
}

export function formatLegacyId(legacyExternalId: number | null | undefined): string {
  if (legacyExternalId == null) return '';
  return `NV-${legacyExternalId.toLocaleString('es-CL')}`;
}
```

## `SalesOrdersView` (T28)

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    {order.is_legacy && <LegacyBadge />}
    <span>{order.is_legacy ? formatLegacyId(order.legacy_external_id) : order.number}</span>
  </div>
</TableCell>
```

## `SaleOrderDrawer` (T29)

```tsx
const isLegacy = order.is_legacy === true;

return (
  <Drawer open={open} onOpenChange={onClose}>
    <DrawerContent>
      {isLegacy ? (
        <>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <LegacyBadge size="md" />
              NV {formatLegacyId(order.legacy_external_id)}
            </DrawerTitle>
          </DrawerHeader>
          <SaleOrderReadOnlyView order={order} onRegisterPayment={onRegisterPayment} />
        </>
      ) : (
        <SaleOrderEditableView order={order} />
      )}
    </DrawerContent>
  </Drawer>
);
```

## `SaleOrderReadOnlyView` (T30, NUEVO)

```tsx
export function SaleOrderReadOnlyView({ order, onRegisterPayment }: Props) {
  return (
    <div className="space-y-4 p-4">
      <ReadOnlyField label="Cliente">
        <div className="flex items-center gap-2">
          {order.customer?.name}
          {order.customer?.is_legacy && <LegacyBadge />}
        </div>
      </ReadOnlyField>
      <ReadOnlyField label="Vendedor">{order.vendor?.name}</ReadOnlyField>
      <ReadOnlyField label="Categoría">{order.category_snapshot}</ReadOnlyField>
      <ReadOnlyField label="Descripción">{order.description}</ReadOnlyField>
      <ReadOnlyField label="Cantidad">{order.quantity}</ReadOnlyField>
      <ReadOnlyField label="Precio neto">{formatCLP(order.net_price)}</ReadOnlyField>
      <ReadOnlyField label="IVA">{formatCLP(order.tax_amount)}</ReadOnlyField>
      <ReadOnlyField label="Total">{formatCLP(order.total_price)}</ReadOnlyField>
      <ReadOnlyField label="Estado"><StatusBadge status={order.status} /></ReadOnlyField>
      <DrawerFooter>
        <Button onClick={() => onRegisterPayment(order)}>Registrar pago</Button>
      </DrawerFooter>
    </div>
  );
}
```

## `RegisterPaymentDrawer` (T31)

```tsx
export function RegisterPaymentDrawer({ order, onClose }: Props) {
  const isLegacy = order.is_legacy === true;
  const mutation = useMutation({
    mutationFn: isLegacy ? registerLegacyPayment : registerTreasuryPayment,
  });
  // ... mismo form, distinto endpoint
}
```

## `ContactListView` (T32)

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    {contact.is_legacy && <LegacyBadge />}
    <span>{contact.name}</span>
  </div>
</TableCell>
```

## `ContactDrawer` (T33)

```tsx
const isLegacy = contact.is_legacy === true;

return (
  <Drawer open={open} onOpenChange={onClose}>
    <DrawerContent>
      {isLegacy ? <ContactReadOnlyView contact={contact} /> : <ContactEditableView contact={contact} />}
    </DrawerContent>
  </Drawer>
);
```

## `useGlobalSearch` (T34)

```ts
const salesResults = useQuery({ /* incluye legacy */ });
const contactsResults = useQuery({
  queryKey: ['contacts', 'search', { q, include_legacy: false }],
  queryFn: () => contactsApi.list({ search: q, include_legacy: false }),
});
```

## Zod types (T35)

```ts
// features/sales/types/index.ts
export const SaleOrderSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
  legacy_external_id: z.number().int().nullable().default(null),
});

// features/contacts/types/index.ts
export const ContactSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
});
```

## Tests de muestra

```ts
// LegacyBadge.test.tsx
test('renders LEGACY text with icon', () => {
  render(<LegacyBadge />);
  expect(screen.getByText('LEGACY')).toBeInTheDocument();
});

// lib/legacy.test.ts
test('isLegacySaleOrder true when is_legacy', () => {
  expect(isLegacySaleOrder({ is_legacy: true } as SaleOrder)).toBe(true);
});
test('formatLegacyId formats with NV- prefix', () => {
  expect(formatLegacyId(12345)).toBe('NV-12.345');
});

// SaleOrderDrawer.test.tsx
test('renders read-only view when is_legacy', () => {
  render(<SaleOrderDrawer order={{ ...legacyOrder, is_legacy: true }} open onClose={vi.fn()} />);
  expect(screen.getByText(/LEGACY/)).toBeInTheDocument();
  expect(screen.getByText('Registrar pago')).toBeInTheDocument();
});
```

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| `BaseDrawer` no soporta `readOnly` | T29 verifica; si falta, se agrega al shared `Drawer` |
| Performance: 7.960 filas en tabla | Paginación server-side ya existente |
| Búsqueda global lenta con NVs legacy | `search_fields` en backend; índice ya creado |
| Zod breaking change | `default(false)` evita romper código existente |
| `useGlobalSearch` cambia el shape de los resultados | El frontend de search ya muestra lista plana |

## Comandos de verificación rápida

```bash
# 1. Type-check
cd frontend && npm run type-check

# 2. Lint
npm run lint

# 3. Tests
npm run test -- legacy

# 4. Manual UI
# - Login como admin
# - Ir a /sales/orders
# - Verificar chip en una fila legacy
# - Click en la fila → drawer read-only
# - Click "Registrar pago" → drawer bifurcado
# - Ir a /contacts → verificar chip en una fila legacy
# - Click → drawer read-only
# - Buscar en search global "NV 12345" → aparece
# - Buscar en search global un nombre de cliente legacy → NO aparece
```

## Salida para la Phase 8

Al cerrar Phase 7, ya se puede:
- Hacer la validación final (Phase 8): ADR firmado, smoke scripts, reconciliación.

**Es el final del usuario**: el equipo de ventas ya puede usar la UI unificada.
