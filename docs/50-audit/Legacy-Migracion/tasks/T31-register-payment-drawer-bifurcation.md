# T31 — `RegisterPaymentDrawer` bifurcation

> **Phase**: 7
> **Tiempo estimado**: 30 min
> **Complejidad**: media

## Precondiciones

- [ ] T26, T29 cerradas.

## Archivos a modificar

- `frontend/features/sales/components/RegisterPaymentDrawer.tsx`.

## Implementación

```tsx
// frontend/features/sales/components/RegisterPaymentDrawer.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isLegacySaleOrder } from '@/lib/legacy';
import { api } from '@/lib/api';

export function RegisterPaymentDrawer({ order, open, onClose }: Props) {
  const isLegacy = isLegacySaleOrder(order);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: isLegacy ? registerLegacyPayment : registerTreasuryPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders', order.id] });
      onClose();
    },
  });

  // ... form fields (mismo RHF + zodResolver)
  // ... onSubmit: mutation.mutate({ order_id: order.id, ...formData, idempotency_key: crypto.randomUUID() })
}

async function registerLegacyPayment(payload: any) {
  const idempotencyKey = payload.idempotency_key;
  const { idempotency_key, ...body } = payload;
  return api.post(
    `/legacy/sale-notes/${payload.order_id}/register-payment/`,
    body,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
}

async function registerTreasuryPayment(payload: any) {
  return api.post(`/treasury/movements/`, payload);
}
```

**Decisión sobre el form**: el mismo form sirve para ambos casos (mismo shape: `paid_at`, `amount`, `method`, `notes`). El bifurcación es solo en el `mutationFn`.

## Tests

```tsx
describe('RegisterPaymentDrawer', () => {
  it('calls legacy endpoint for legacy order', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    render(<RegisterPaymentDrawer order={{ ...order, is_legacy: true }} open onClose={vi.fn()} />);
    // fill form, submit
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/legacy/sale-notes/'),
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    );
  });

  it('calls treasury endpoint for normal order', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    render(<RegisterPaymentDrawer order={{ ...order, is_legacy: false }} open onClose={vi.fn()} />);
    // fill form, submit
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/treasury/'),
      expect.anything(),
      expect.anything(),
    );
  });
});
```

## DoD

- [ ] Bifurcación por `is_legacy`.
- [ ] Legacy usa endpoint `/api/legacy/sale-notes/<id>/register-payment/` con `Idempotency-Key`.
- [ ] Normal usa endpoint treasury existente.
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- RegisterPaymentDrawer
```

## Riesgos

- **Form schema**: si el form usa `zodResolver` con un schema distinto para legacy vs normal, hay que unificar. Por ahora mismo schema.
- **Error handling**: si el endpoint legacy devuelve 403, mostrar mensaje "Necesitas permisos adicionales".
