# T30 — `SaleOrderReadOnlyView` (NUEVO)

> **Phase**: 7
> **Tiempo estimado**: 45 min
> **Complejidad**: media

## Precondiciones

- [ ] T27 cerrada.

## Archivos a crear

- `frontend/features/sales/components/SaleOrderReadOnlyView.tsx`.

## Implementación

```tsx
// frontend/features/sales/components/SaleOrderReadOnlyView.tsx
import { LegacyBadge } from '@/components/shared';
import { StatusBadge } from '@/components/shared';
import { isLegacyContact } from '@/lib/legacy';
import { formatCLP } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DrawerFooter } from '@/components/ui/drawer';

interface Props {
  order: SaleOrder;
  onRegisterPayment: () => void;
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function SaleOrderReadOnlyView({ order, onRegisterPayment }: Props) {
  return (
    <div className="space-y-4 p-4">
      <ReadOnlyField label="Cliente">
        <div className="flex items-center gap-2">
          {order.customer?.name ?? '—'}
          {order.customer && isLegacyContact(order.customer) && <LegacyBadge />}
        </div>
      </ReadOnlyField>
      <ReadOnlyField label="Vendedor">{order.vendor?.name ?? '—'}</ReadOnlyField>
      <ReadOnlyField label="Categoría">{(order as any).category_snapshot ?? '—'}</ReadOnlyField>
      <ReadOnlyField label="Descripción">{order.description ?? '—'}</ReadOnlyField>
      <ReadOnlyField label="Cantidad">{order.quantity}</ReadOnlyField>
      <ReadOnlyField label="Precio neto">{formatCLP(order.net_price)}</ReadOnlyField>
      <ReadOnlyField label="IVA">{formatCLP(order.tax_amount)}</ReadOnlyField>
      <ReadOnlyField label="Total">{formatCLP(order.total_price)}</ReadOnlyField>
      <ReadOnlyField label="Estado"><StatusBadge status={order.status} /></ReadOnlyField>
      {order.is_pending && (
        <ReadOnlyField label="Marca"><LegacyBadge /> Pendiente</ReadOnlyField>
      )}
      <DrawerFooter>
        <Button onClick={onRegisterPayment}>Registrar pago</Button>
      </DrawerFooter>
    </div>
  );
}
```

**Nota**: `(order as any).category_snapshot` es la única excepción a zero-`any` en este componente. Se documenta aquí; la alternativa es extender el tipo `SaleOrder` para que tenga `category_snapshot?: string` opcional.

**Decisión final**: agregar `category_snapshot?: string` al tipo Zod de `SaleOrder` (T35). En este PR se agrega como `z.string().nullable().optional()`.

## Tests

```tsx
describe('SaleOrderReadOnlyView', () => {
  it('renders all fields', () => {
    render(<SaleOrderReadOnlyView order={legacyOrder} onRegisterPayment={vi.fn()} />);
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Categoría')).toBeInTheDocument();
    expect(screen.getByText('Registrar pago')).toBeInTheDocument();
  });

  it('shows pending chip when is_pending', () => {
    render(<SaleOrderReadOnlyView order={{ ...legacyOrder, is_pending: true }} onRegisterPayment={vi.fn()} />);
    expect(screen.getByText(/Pendiente/)).toBeInTheDocument();
  });
});
```

## DoD

- [ ] Componente creado.
- [ ] Muestra todos los campos relevantes.
- [ ] Botón "Registrar pago" funcional.
- [ ] 2+ tests pasan.
- [ ] `npm run type-check` pasa (con `category_snapshot` opcional en el tipo).

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- SaleOrderReadOnlyView
```

## Riesgos

- **`category_snapshot` opcional**: si no se actualiza el Zod type, hay un `as any`. Mitigado en T35.
- **Componentes shared**: `StatusBadge`, `DrawerFooter`, `Button` deben existir.
