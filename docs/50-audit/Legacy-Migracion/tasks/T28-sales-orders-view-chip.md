# T28 — `SalesOrdersView` chip

> **Phase**: 7
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T26, T27 cerradas.

## Archivos a modificar

- `frontend/features/sales/components/SalesOrdersView.tsx`.
- `frontend/features/sales/types/index.ts` (Zod schema; también T35).
- `frontend/features/sales/api/salesApi.ts` (`include_legacy: true` default).
- `frontend/features/sales/hooks/useSalesOrders.ts`.

## Implementación

### 1. Tipos (Zod)

```ts
// frontend/features/sales/types/index.ts
export const SaleOrderSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
  legacy_external_id: z.number().int().nullable().default(null),
});
```

### 2. API

```ts
// frontend/features/sales/api/salesApi.ts
export const salesApi = {
  list: (params: { include_legacy?: boolean; [k: string]: any } = {}) => {
    return api.get('/sales/orders/', {
      params: { include: params.include_legacy === false ? 'none' : 'legacy' },
    });
  },
  // ...
};
```

### 3. Hook

```ts
// frontend/features/sales/hooks/useSalesOrders.ts
export function useSalesOrders(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['sales', 'orders', { include_legacy: true, ...filters }],
    queryFn: () => salesApi.list({ include_legacy: true, ...filters }),
  });
}
```

### 4. Vista

```tsx
// frontend/features/sales/components/SalesOrdersView.tsx
import { LegacyBadge } from '@/components/shared';
import { isLegacySaleOrder, formatLegacyId } from '@/lib/legacy';

// En la celda "ID" o "Número":
<TableCell>
  <div className="flex items-center gap-2">
    {isLegacySaleOrder(order) && <LegacyBadge />}
    <span>{isLegacySaleOrder(order) ? formatLegacyId(order.legacy_external_id) : order.number}</span>
  </div>
</TableCell>
```

## Tests

```tsx
// SalesOrdersView.test.tsx (nuevo o extendido)
it('renders LegacyBadge for legacy orders', () => {
  render(<SalesOrdersView orders={[{ ...order, is_legacy: true, legacy_external_id: 12345 }]} />);
  expect(screen.getByText('LEGACY')).toBeInTheDocument();
  expect(screen.getByText('NV-12.345')).toBeInTheDocument();
});

it('does not render LegacyBadge for normal orders', () => {
  render(<SalesOrdersView orders={[{ ...order, is_legacy: false }]} />);
  expect(screen.queryByText('LEGACY')).not.toBeInTheDocument();
});
```

## DoD

- [ ] Chip aparece en filas legacy.
- [ ] Número se formatea como `NV-12.345` para legacy.
- [ ] No afecta filas no-legacy.
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- SalesOrdersView
```

## Riesgos

- **Performance**: la lista con 7.960 NVs puede ser lenta. Paginación server-side ya existe.
- **Accesibilidad**: el chip debe tener `aria-label` descriptivo (se puede agregar via `title`).
