# T29 — `SaleOrderDrawer` read-only branch

> **Phase**: 7
> **Tiempo estimado**: 30 min
> **Complejidad**: media

## Precondiciones

- [ ] T27, T28 cerradas.

## Archivos a modificar

- `frontend/features/sales/components/SaleOrderDrawer.tsx`.

## Implementación

```tsx
// frontend/features/sales/components/SaleOrderDrawer.tsx
import { isLegacySaleOrder, formatLegacyId } from '@/lib/legacy';
import { LegacyBadge } from '@/components/shared';
import { SaleOrderReadOnlyView } from './SaleOrderReadOnlyView';
// import { SaleOrderEditableView } from './SaleOrderEditableView';  // ya existe

export function SaleOrderDrawer({ order, open, onClose, onRegisterPayment }: Props) {
  const isLegacy = isLegacySaleOrder(order);

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
            <SaleOrderReadOnlyView
              order={order}
              onRegisterPayment={() => onRegisterPayment(order)}
            />
          </>
        ) : (
          <SaleOrderEditableView order={order} />
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

## Si `BaseDrawer` no soporta `readOnly`

Verificar que el `DrawerContent` existente permite ocultar el footer de acciones cuando se pasa un flag. Si no, agregar al `BaseDrawer`:

```tsx
// frontend/components/shared/Drawer.tsx (modificar)
<DrawerFooter hidden={readOnly}>
  {children}
</DrawerFooter>
```

## Tests

```tsx
describe('SaleOrderDrawer', () => {
  it('renders read-only view for legacy order', () => {
    render(<SaleOrderDrawer order={{ ...order, is_legacy: true, legacy_external_id: 12345 }} open onClose={vi.fn()} onRegisterPayment={vi.fn()} />);
    expect(screen.getByText(/LEGACY/)).toBeInTheDocument();
    expect(screen.getByText('Registrar pago')).toBeInTheDocument();
  });

  it('renders editable view for normal order', () => {
    render(<SaleOrderDrawer order={{ ...order, is_legacy: false }} open onClose={vi.fn()} onRegisterPayment={vi.fn()} />);
    expect(screen.queryByText(/LEGACY/)).not.toBeInTheDocument();
  });
});
```

## DoD

- [ ] NV legacy → branch read-only con chip y botón "Registrar pago".
- [ ] NV normal → branch editable (sin cambios).
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- SaleOrderDrawer
```

## Riesgos

- **`SaleOrderEditableView`**: si no existe como componente separado, refactorizar el drawer existente primero.
- **`DrawerContent` debe aceptar children arbitrarios**: ya debería.
