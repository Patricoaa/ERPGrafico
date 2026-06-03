# T27 — `LegacyBadge` shared component

> **Phase**: 7
> **Tiempo estimado**: 20 min
> **Complejidad**: baja

## Precondiciones

- [ ] T26 cerrada.

## Archivos a crear/modificar

- `frontend/components/shared/LegacyBadge.tsx` (nuevo).
- `frontend/components/shared/index.ts` (modificar — agregar export).

## Implementación

```tsx
// frontend/components/shared/LegacyBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LegacyBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function LegacyBadge({ className, size = 'sm' }: LegacyBadgeProps) {
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

```ts
// frontend/components/shared/index.ts (agregar al final)
export * from './LegacyBadge';
```

## Tests

```tsx
// frontend/components/shared/LegacyBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegacyBadge } from './LegacyBadge';

describe('LegacyBadge', () => {
  it('renders LEGACY text', () => {
    render(<LegacyBadge />);
    expect(screen.getByText('LEGACY')).toBeInTheDocument();
  });
  it('renders with size=md', () => {
    render(<LegacyBadge size="md" />);
    expect(screen.getByText('LEGACY')).toBeInTheDocument();
  });
  it('accepts className', () => {
    render(<LegacyBadge className="custom" />);
    expect(screen.getByText('LEGACY').parentElement).toHaveClass('custom');
  });
});
```

## DoD

- [ ] Componente existe.
- [ ] Export en barrel.
- [ ] 3+ tests pasan.
- [ ] `npm run type-check` y `npm run lint` pasan.

## Comandos de verificación

```bash
cd frontend
npm run type-check
npm run lint
npm run test -- LegacyBadge
```

## Riesgos

- **Raw colors (`amber-*`)**: excepción documentada en `01-architecture-decision.md` y `06-frontend-unified-ui.md`. Se centraliza en este 1 archivo.
- **`Badge` y `cn`**: deben existir en el design system. Verificar.
