# T32 — `ContactListView` chip

> **Phase**: 7
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T26, T27 cerradas.

## Archivos a modificar

- `frontend/features/contacts/components/ContactListView.tsx`.
- `frontend/features/contacts/types/index.ts` (Zod).
- `frontend/features/contacts/api/contactsApi.ts` (`include_legacy: true` default).
- `frontend/features/contacts/hooks/useContacts.ts`.

## Implementación

### 1. Tipos

```ts
// frontend/features/contacts/types/index.ts
export const ContactSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
});
```

### 2. API

```ts
// frontend/features/contacts/api/contactsApi.ts
export const contactsApi = {
  list: (params: { include_legacy?: boolean; [k: string]: any } = {}) => {
    return api.get('/contacts/contacts/', {
      params: { include_legacy: params.include_legacy },
    });
  },
};
```

### 3. Hook

```ts
// frontend/features/contacts/hooks/useContacts.ts
export function useContacts(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: ['contacts', { include_legacy: true, ...filters }],
    queryFn: () => contactsApi.list({ include_legacy: true, ...filters }),
  });
}
```

### 4. Vista

```tsx
// frontend/features/contacts/components/ContactListView.tsx
import { LegacyBadge } from '@/components/shared';
import { isLegacyContact } from '@/lib/legacy';

<TableCell>
  <div className="flex items-center gap-2">
    {isLegacyContact(contact) && <LegacyBadge />}
    <span>{contact.name}</span>
  </div>
</TableCell>
```

## Tests

```tsx
it('renders LegacyBadge for legacy contacts', () => {
  render(<ContactListView contacts={[{ ...contact, is_legacy: true }]} />);
  expect(screen.getByText('LEGACY')).toBeInTheDocument();
});
```

## DoD

- [ ] Chip aparece en contactos legacy.
- [ ] No afecta contactos no-legacy.
- [ ] 1+ test pasa.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- ContactListView
```

## Riesgos

- **El backend usa `select_related('legacy_origin')`**: ya cubierto en T23.
