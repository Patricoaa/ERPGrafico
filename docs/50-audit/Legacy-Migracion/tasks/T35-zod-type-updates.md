# T35 — Zod type updates

> **Phase**: 7
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] T28, T32, T33 cerradas.

## Archivos a modificar

- `frontend/features/sales/types/index.ts`.
- `frontend/features/contacts/types/index.ts`.

## Implementación

### Sales

```ts
// frontend/features/sales/types/index.ts
export const SaleOrderSchema = z.object({
  // ... campos existentes ...
  is_legacy: z.boolean().default(false),
  legacy_external_id: z.number().int().nullable().default(null),
  category_snapshot: z.string().nullable().optional(),  // usado por SaleOrderReadOnlyView
});
```

### Contacts

```ts
// frontend/features/contacts/types/index.ts
export const LegacyOriginSchema = z.object({
  raw_tax_id: z.string(),
  tax_id_exception: z.boolean(),
});

export const ContactSchema = z.object({
  // ... campos existentes ...
  is_legacy: z.boolean().default(false),
  legacy_origin: LegacyOriginSchema.nullable().optional(),
});
```

## DoD

- [ ] `SaleOrderSchema` incluye `is_legacy`, `legacy_external_id`, `category_snapshot?`.
- [ ] `ContactSchema` incluye `is_legacy`, `legacy_origin?`.
- [ ] `npm run type-check` pasa.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
```

## Riesgos

- **`default(false)`**: evita romper código que crea `SaleOrder`/`Contact` sin estos campos.
