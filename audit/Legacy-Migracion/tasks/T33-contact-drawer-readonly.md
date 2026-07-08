# T33 — `ContactDrawer` read-only branch

> **Phase**: 7
> **Tiempo estimado**: 30 min
> **Complejidad**: media

## Precondiciones

- [ ] T27, T32 cerradas.

## Archivos a modificar/crear

- `frontend/features/contacts/components/ContactDrawer.tsx` (modificar).
- `frontend/features/contacts/components/ContactReadOnlyView.tsx` (NUEVO).

## Implementación

### `ContactDrawer.tsx`

```tsx
import { isLegacyContact } from '@/lib/legacy';
import { ContactReadOnlyView } from './ContactReadOnlyView';
// import { ContactEditableView } from './ContactEditableView';  // ya existe

export function ContactDrawer({ contact, open, onClose }: Props) {
  const isLegacy = isLegacyContact(contact);

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent>
        {isLegacy ? (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <LegacyBadge size="md" /> {contact.name}
              </DrawerTitle>
            </DrawerHeader>
            <ContactReadOnlyView contact={contact} />
          </>
        ) : (
          <ContactEditableView contact={contact} />
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

### `ContactReadOnlyView.tsx` (NUEVO)

```tsx
import { LegacyBadge } from '@/components/shared';

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function ContactReadOnlyView({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-4 p-4">
      <ReadOnlyField label="Nombre">{contact.name}</ReadOnlyField>
      <ReadOnlyField label="RUT (raw)">{(contact as any).legacy_origin?.raw_tax_id ?? '—'}</ReadOnlyField>
      <ReadOnlyField label="RUT (validado)">
        {contact.tax_id || '—'}
        {(contact as any).legacy_origin?.tax_id_exception && <LegacyBadge />}
      </ReadOnlyField>
      <ReadOnlyField label="Email">{contact.email || '—'}</ReadOnlyField>
      <ReadOnlyField label="Teléfono">{contact.phone || '—'}</ReadOnlyField>
      <ReadOnlyField label="Dirección">{contact.address || '—'}</ReadOnlyField>
      <p className="text-xs text-muted-foreground">Importado del sistema legacy.</p>
    </div>
  );
}
```

**Decisión sobre `legacy_origin`**: se agrega como opcional al tipo `Contact`:

```ts
// frontend/features/contacts/types/index.ts
export const LegacyOriginSchema = z.object({
  raw_tax_id: z.string(),
  tax_id_exception: z.boolean(),
}).optional();

export const ContactSchema = z.object({
  // ... campos existentes
  is_legacy: z.boolean().default(false),
  legacy_origin: LegacyOriginSchema,
});
```

## Tests

```tsx
describe('ContactDrawer', () => {
  it('renders read-only view for legacy contact', () => {
    render(<ContactDrawer contact={{ ...contact, is_legacy: true, legacy_origin: { raw_tax_id: '12.345.678-9', tax_id_exception: false } }} open onClose={vi.fn()} />);
    expect(screen.getByText(/LEGACY/)).toBeInTheDocument();
    expect(screen.getByText('12.345.678-9')).toBeInTheDocument();
  });
});
```

## DoD

- [ ] Contacto legacy → branch read-only con `legacy_origin.raw_tax_id`.
- [ ] Contacto normal → branch editable.
- [ ] Tipo `Contact` incluye `legacy_origin` opcional.
- [ ] 1+ test pasa.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- ContactDrawer ContactReadOnlyView
```

## Riesgos

- **`legacy_origin` opcional**: si el backend no lo expone, queda undefined y se muestra `—`.
