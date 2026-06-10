# T26 — `lib/legacy.ts` helper

> **Phase**: 7
> **Tiempo estimado**: 15 min
> **Complejidad**: baja

## Precondiciones

- [ ] Phase 6 cerrada.

## Archivos a crear

- `frontend/lib/legacy.ts`.

## Implementación

```typescript
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

## Tests (Vitest)

```typescript
// frontend/lib/legacy.test.ts
import { describe, it, expect } from 'vitest';
import { isLegacyContact, isLegacySaleOrder, formatLegacyId } from './legacy';

describe('isLegacyContact', () => {
  it('returns true when is_legacy is true', () => {
    expect(isLegacyContact({ is_legacy: true } as any)).toBe(true);
  });
  it('returns false when is_legacy is false', () => {
    expect(isLegacyContact({ is_legacy: false } as any)).toBe(false);
  });
  it('returns false when is_legacy is undefined', () => {
    expect(isLegacyContact({} as any)).toBe(false);
  });
});

describe('isLegacySaleOrder', () => {
  it('returns true when is_legacy is true', () => {
    expect(isLegacySaleOrder({ is_legacy: true } as any)).toBe(true);
  });
});

describe('formatLegacyId', () => {
  it('formats with NV- prefix and es-CL locale', () => {
    expect(formatLegacyId(12345)).toBe('NV-12.345');
  });
  it('returns empty string for null', () => {
    expect(formatLegacyId(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(formatLegacyId(undefined)).toBe('');
  });
});
```

## DoD

- [ ] `lib/legacy.ts` existe.
- [ ] 3 funciones exportadas.
- [ ] 5+ tests pasan.
- [ ] `npm run type-check` pasa.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run test -- legacy
```

## Riesgos

- **Tipos**: `SaleOrder` y `Contact` deben estar definidos en sus features. Verificar que los imports funcionan.
