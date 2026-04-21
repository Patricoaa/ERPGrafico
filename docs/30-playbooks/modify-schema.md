---
layer: 30-playbooks
doc: modify-schema
task: "Change Zod schema / form shape"
triggers: ["modify schema", "add field", "change form", "update Zod"]
preconditions:
  - 20-contracts/api-contracts.md
  - 20-contracts/hook-contracts.md
validation:
  - npx tsc --noEmit
  - npm run test
forbidden:
  - diverging from backend serializer
  - breaking existing consumers silently
status: active
owner: frontend-team
last_review: 2026-04-21
---

# Playbook — Modify Zod schema / form

## Rule

Frontend Zod schema mirrors backend serializer. Never diverge unilaterally. If backend changes → start at [add-endpoint.md](add-endpoint.md) and cascade.

## Steps

### 1. Identify direction

| Trigger | Order |
|---------|-------|
| Backend field added | Backend migration → serializer → api-contracts.md → frontend Zod |
| Frontend-only derived field | Frontend Zod only, add `.transform()` |
| Validation rule only (client-side UX) | Frontend Zod refinement, backend stays permissive check |

### 2. Update schema

```ts
// features/[x]/components/forms/schema.ts
export const FooSchema = z.object({
  // existing fields
  newField: z.string().min(1),  // adjust
})
export type FooInput = z.infer<typeof FooSchema>
```

### 3. Update form

- New field component bound via `react-hook-form` `Controller` or `register`.
- Error rendered from `formState.errors.newField.message`.
- Default value in `useForm({ defaultValues })`.

### 4. Update hook

- If payload shape changes, adjust mutation body.
- Cache invalidation usually unchanged.

### 5. Update tests

- Valid input test passes new field.
- Invalid test covers new validation rule.
- Schema unit test asserts parse success/failure.

### 6. Backward compatibility

If field is optional on backend but added to frontend:
- Zod: `.optional()` or `.nullable()` matching API.
- Default value in form so existing edit flows don't break.

If field is required new on backend:
- Coordinate migration with data backfill.
- Deploy backend first.

## Validation

```bash
cd frontend
npx tsc --noEmit
npm run test -- [Schema]
# browser: open form, submit happy + error paths
```

## Definition of done

- [ ] Schema change matches api-contracts.md.
- [ ] Form UI updated + validation messages clear.
- [ ] Tests cover new rule.
- [ ] No implicit `any`.
- [ ] Existing consumers still compile and function.
