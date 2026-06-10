# T34 — `useGlobalSearch` exclude legacy contacts

> **Phase**: 7
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T28, T32 cerradas.

## Archivos a modificar

- `frontend/features/search/hooks/useGlobalSearch.ts`.

## Implementación

```ts
// frontend/features/search/hooks/useGlobalSearch.ts
import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/features/sales/api/salesApi';
import { contactsApi } from '@/features/contacts/api/contactsApi';

export function useGlobalSearch(query: string) {
  const salesResults = useQuery({
    queryKey: ['search', 'sales', { q: query, include_legacy: true }],
    queryFn: () => salesApi.list({ search: query, include_legacy: true }),
    enabled: query.length >= 2,
  });

  const contactsResults = useQuery({
    queryKey: ['search', 'contacts', { q: query, include_legacy: false }],
    queryFn: () => contactsApi.list({ search: query, include_legacy: false }),
    enabled: query.length >= 2,
  });

  return {
    salesResults,
    contactsResults,
  };
}
```

**Decisión**:
- NVs legacy: **incluidas** (búsqueda "NV 12345" debe encontrar).
- Contactos legacy: **excluidos** (búsqueda "Pérez" no debe mostrar contactos legacy).
- Vendedores legacy: no se buscan (no son Contact ni SaleOrder).

## Si `contactsApi.list` no acepta `include_legacy`

Verificar que el backend filtra por `is_legacy` cuando se pasa el flag. Si no, agregar al backend un filtro `?is_legacy=false` o usar un parámetro distinto.

**Decisión actual**: el flag se llama `include_legacy` en el frontend y se traduce a `?include=legacy|none` solo en `salesApi`. Para `contactsApi`, el backend ya expone `is_legacy` como campo; se puede filtrar con `?is_legacy=false` (DRF Filter):

```python
# backend/contacts/views.py
from django_filters.rest_framework import DjangoFilterBackend

class ContactViewSet(...):
    filter_backends = [..., DjangoFilterBackend, ...]
    filterset_fields = ['is_legacy', ...]
```

Si esto requiere más setup, alternativa: en el frontend filtrar client-side (peor).

## Tests

```tsx
describe('useGlobalSearch', () => {
  it('includes legacy sale notes', async () => {
    const { result } = renderHook(() => useGlobalSearch('NV-12345'), { wrapper: QueryClientProvider });
    await waitFor(() => expect(result.current.salesResults.isSuccess).toBe(true));
    expect(salesApi.list).toHaveBeenCalledWith(expect.objectContaining({ include_legacy: true }));
  });

  it('excludes legacy contacts', async () => {
    const { result } = renderHook(() => useGlobalSearch('Pérez'), { wrapper: QueryClientProvider });
    await waitFor(() => expect(result.current.contactsResults.isSuccess).toBe(true));
    expect(contactsApi.list).toHaveBeenCalledWith(expect.objectContaining({ include_legacy: false }));
  });
});
```

## DoD

- [ ] Search global incluye NVs legacy.
- [ ] Search global excluye contactos legacy.
- [ ] 2+ tests pasan.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- useGlobalSearch
```

## Riesgos

- **Backend filter**: si el backend no filtra, el frontend recibe contactos legacy y debe filtrar client-side. Aceptable pero peor.
