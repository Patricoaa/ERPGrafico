---
layer: 90-governance
doc: zero-any-policy
status: active
owner: frontend-team
last_review: 2026-04-21
---

# Zero `any` Policy

`any` is forbidden in TypeScript. No exceptions without ADR.

## Why

- `any` disables type checking locally AND propagates (return value, arguments).
- Loses Zod → serializer contract guarantees.
- Silent breakage at refactor time.

## What to use instead

| Situation | Use |
|-----------|-----|
| Unknown shape from external boundary | `unknown` + type guard |
| API response | Zod schema + `z.infer` |
| Form values | Zod schema + `z.infer` |
| Generic utility | type parameter `<T>` |
| Third-party lib missing types | declare local `.d.ts` with precise shape |
| Truly dynamic dispatch | discriminated union |

## Patterns

### Unknown + guard

```ts
function isOrder(x: unknown): x is Order {
  return typeof x === 'object' && x !== null && 'id' in x && 'folio' in x
}

const parsed: unknown = JSON.parse(raw)
if (!isOrder(parsed)) throw new Error('invalid shape')
// parsed is Order here
```

### Zod parse

```ts
const OrderSchema = z.object({ id: z.string().uuid(), folio: z.string() })
type Order = z.infer<typeof OrderSchema>
const order = OrderSchema.parse(payload)
```

### Generic

```ts
function firstOf<T>(xs: T[]): T | undefined { return xs[0] }
```

## Escape hatches (rare)

When nothing else works — still not `any`:

```ts
// Narrow as possible — document why
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }
```

## Enforcement

- ESLint: `@typescript-eslint/no-explicit-any: error`.
- ESLint: `@typescript-eslint/no-unsafe-*` errors.
- CI fails on violation.
- `// eslint-disable-next-line` for `any` → requires linked ADR in comment.

## Review checklist

- [ ] No `any` in PR diff.
- [ ] No `as unknown as X` double-cast (sign of wrong type somewhere upstream).
- [ ] No `Function` type (use signature).
- [ ] No `object` type (use `Record<string, unknown>` or proper shape).
