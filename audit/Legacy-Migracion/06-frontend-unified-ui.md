# 06 — Frontend unified UI (4 archivos modificados + 1 shared + 1 helper)

> Cero vistas nuevas. Cero drawers nuevos. Solo 1 shared component, 1 helper, y modificaciones puntuales a 4 archivos existentes.

## 0. Archivos tocados

### 0.1 Nuevos (2)

| Path | Líneas estimadas | Propósito |
|---|---|---|
| `frontend/components/shared/LegacyBadge.tsx` | ~30 | Chip semántico para identificar items legacy |
| `frontend/lib/legacy.ts` | ~25 | Helpers puros: `isLegacyContact`, `isLegacySaleOrder`, `formatLegacyId` |

### 0.2 Modificados (8)

| Path | Cambio |
|---|---|
| `frontend/components/shared/index.ts` | Agregar export de `LegacyBadge` |
| `frontend/features/sales/types/index.ts` | Agregar `is_legacy`, `legacy_external_id` al Zod schema |
| `frontend/features/sales/api/salesApi.ts` | `include_legacy: true` default en `useList` |
| `frontend/features/sales/hooks/useSalesOrders.ts` | Pasar `include_legacy: true` |
| `frontend/features/sales/components/SalesOrdersView.tsx` | Render `<LegacyBadge />` en columna "ID" |
| `frontend/features/sales/components/SaleOrderDrawer.tsx` | Branch `is_legacy` con read-only + descripción legacy |
| `frontend/features/sales/components/SaleOrderReadOnlyView.tsx` | **NUEVO archivo interno al drawer** (read-only) |
| `frontend/features/sales/components/RegisterPaymentDrawer.tsx` | Bifurcación `isLegacy` → endpoint distinto |
| `frontend/features/contacts/types/index.ts` | Agregar `is_legacy` al Zod schema |
| `frontend/features/contacts/api/contactsApi.ts` | `include_legacy: true` default |
| `frontend/features/contacts/hooks/useContacts.ts` | Pasar `include_legacy: true` |
| `frontend/features/contacts/components/ContactListView.tsx` | Render `<LegacyBadge />` en columna "Nombre" |
| `frontend/features/contacts/components/ContactDrawer.tsx` | Branch `is_legacy` con read-only |
| `frontend/features/search/hooks/useGlobalSearch.ts` | Excluir contactos legacy (NVs sí) |
| `frontend/app/globals.css` | (opcional) agregar tokens semánticos para `LEGACY-OT-PRODUCT` |

**Total**: 2 nuevos + ~13 modificados.

## 1. `LegacyBadge` shared component

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

**Decisión de color**: `amber` (no un color primary/secondary) para señalar "esto viene de otro sistema". Es la **única excepción** al invariant "no raw Tailwind colors" en este alcance, justificada por:
- No existe un token semántico `legacy` en `globals.css`.
- El color ámbar es semánticamente "histórico" en la convención de design system.
- Se centraliza en este 1 archivo (1 lugar a cambiar si se agrega el token).

**Tracking**: se debe agregar a `docs/90-governance/zero-raw-colors-policy.md` (futuro PR) la excepción.

## 2. `lib/legacy.ts` helper

```typescript
// frontend/lib/legacy.ts
import type { SaleOrder, Contact } from '@/features/sales/types';
import type { Contact as ContactType } from '@/features/contacts/types';

export function isLegacyContact(contact: ContactType): boolean {
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

## 3. Modificaciones a `features/sales`

### 3.1 Tipos

```typescript
// frontend/features/sales/types/index.ts
export const SaleOrderSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
  legacy_external_id: z.number().int().nullable().default(null),
  // ...
});
```

### 3.2 API

```typescript
// frontend/features/sales/api/salesApi.ts
export const salesApi = {
  list: (params: { include_legacy?: boolean; ... } = {}) => {
    return api.get('/sales/orders/', {
      params: { include: params.include_legacy === false ? 'none' : 'legacy' },
    });
  },
  // ...
};
```

### 3.3 Hook

```typescript
// frontend/features/sales/hooks/useSalesOrders.ts
export function useSalesOrders() {
  return useQuery({
    queryKey: ['sales', 'orders', { include_legacy: true }],
    queryFn: () => salesApi.list({ include_legacy: true }),
  });
}
```

### 3.4 `SalesOrdersView`

```tsx
// frontend/features/sales/components/SalesOrdersView.tsx
// En la celda "ID" o "Número":
<TableCell>
  <div className="flex items-center gap-2">
    {order.is_legacy && <LegacyBadge />}
    <span>{order.is_legacy ? formatLegacyId(order.legacy_external_id) : order.number}</span>
  </div>
</TableCell>
```

### 3.5 `SaleOrderDrawer` (read-only branch)

```tsx
// frontend/features/sales/components/SaleOrderDrawer.tsx
const isLegacy = order.is_legacy === true;

return (
  <Drawer open={open} onOpenChange={onClose}>
    <DrawerContent>
      {isLegacy ? (
        <>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <LegacyBadge size="md" /> NV {formatLegacyId(order.legacy_external_id)}
            </DrawerTitle>
          </DrawerHeader>
          <SaleOrderReadOnlyView order={order} />
          <DrawerFooter>
            <Button onClick={() => onRegisterPayment(order)}>Registrar pago</Button>
          </DrawerFooter>
        </>
      ) : (
        <SaleOrderEditableView order={order} />
      )}
    </DrawerContent>
  </Drawer>
);
```

### 3.6 `SaleOrderReadOnlyView` (NUEVO, interno al feature)

Componente que muestra:
- Cabecera: NV legacy con badge + número.
- Cliente (con badge legacy si aplica).
- Vendedor (sin badge — no es Contact).
- Categoría (snapshot, CharField).
- Descripción textual (la "línea" del producto).
- Cantidad, precio neto, IVA, total.
- Estado (`StatusBadge` existente).
- Botón "Registrar pago" → abre `RegisterPaymentDrawer` en modo legacy.

**Sin** botones de "Editar", "Anular", "Duplicar" (no aplica).

### 3.7 `RegisterPaymentDrawer` (bifurcación)

```tsx
export function RegisterPaymentDrawer({ order, onClose }: Props) {
  const isLegacy = order.is_legacy === true;

  if (isLegacy) {
    // Llama a /api/legacy/sale-notes/<id>/register-payment/
    // con header Idempotency-Key generado en el cliente
  } else {
    // Llama al endpoint de treasury existente
  }
}
```

El componente recibe `order` completo y decide en runtime.

## 4. Modificaciones a `features/contacts`

### 4.1 Tipos

```typescript
// frontend/features/contacts/types/index.ts
export const ContactSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
  // ...
});
```

### 4.2 `ContactListView`

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    {contact.is_legacy && <LegacyBadge />}
    <span>{contact.name}</span>
  </div>
</TableCell>
```

### 4.3 `ContactDrawer` (read-only branch)

Igual patrón que `SaleOrderDrawer`:
- Si `contact.is_legacy`, mostrar `<ContactReadOnlyView />` (interno) con campos: nombre, RUT raw + `tax_id_exception` flag, dirección, teléfono, email, "Importado del legacy".
- Sin acciones de "Editar" / "Eliminar" / "Vincular a OT".
- Botón (opcional) "Ver NVs asociadas" → lista filtrada.

## 5. `useGlobalSearch` (exclusión de contactos legacy)

```typescript
// frontend/features/search/hooks/useGlobalSearch.ts
export function useGlobalSearch(query: string) {
  const salesResults = useQuery({ /* ... incluye legacy ... */ });
  const contactsResults = useQuery({
    queryKey: ['contacts', 'search', { q: query, include_legacy: false }],
    queryFn: () => contactsApi.list({ search: query, include_legacy: false }),
  });
  // ...
}
```

**Decisión**: las NVs legacy aparecen en búsqueda global ("NV 12345"), pero los contactos legacy **no** ("cliente Pérez" → solo Contact vivos). El vendedor legacy tampoco aparece.

## 6. TypeScript safety

- `SaleOrderSchema.is_legacy` con `default(false)` → no rompe código existente que crea `SaleOrder` sin este campo.
- `legacy_external_id` nullable.
- `ContactSchema.is_legacy` con `default(false)`.
- Zod deriva el tipo; sin `any` en ningún lugar.

## 7. Lint y type-check

- `npm run type-check` debe pasar.
- `npm run lint` debe pasar.
- `eslint-plugin-no-restricted-imports` debe seguir respetando las reglas de cross-feature.

## 8. i18n

- Las strings del chip (`LEGACY`) NO se traducen (es sigla).
- El tooltip `help` del chip podría traducirse: `"Viene del sistema legacy"` (es-CL).

## 9. Tests E2E (Playwright, opcional pero recomendado)

- `tests/e2e/legacy-sale-note.spec.ts`: login → `/sales/orders` → ver chip en una fila legacy → click → drawer read-only → "Registrar pago" → endpoint `/api/legacy/...`.
- `tests/e2e/legacy-contact.spec.ts`: `/contacts` → ver chip en una fila legacy → click → drawer read-only.
- `tests/e2e/global-search-excludes-legacy-contact.spec.ts`: buscar un nombre de cliente legacy → NO aparece en resultados.

## 10. Compatibilidad con `BaseDrawer`

- `BaseDrawer` ya soporta `readOnly` (si no, hay que agregarlo — está en T29).
- `readOnly` oculta todos los inputs y el footer de acciones (excepto el botón "Cerrar").
- `LegacyBadge` se renderiza en el header del drawer en modo legacy.

## 11. Lo que NO se hace en frontend

- **No** se crea `features/legacy/`.
- **No** se crea ninguna vista, lista, drawer, wizard, o form nuevo.
- **No** se modifica `lib/api` ni los hooks globales.
- **No** se introduce un nuevo tipo de route o layout.
- **No** se agrega un link de navegación nuevo en el sidebar.

## 12. Riesgos UI

- **Riesgo**: `BaseDrawer` no tiene `readOnly` → **mitigación**: T29 lo agrega al shared.
- **Riesgo**: `RegisterPaymentDrawer` no acepta `isLegacy` → **mitigación**: T31 lo refactoriza a un branch interno.
- **Riesgo**: el usuario ve un chip ámbar y no sabe qué hacer → **mitigación**: tooltip con explicación breve.
