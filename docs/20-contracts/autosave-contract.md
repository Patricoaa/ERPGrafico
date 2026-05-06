---
layer: 20-contracts
doc: autosave-contract
status: active
owner: frontend-team
last_review: 2026-05-05
stability: contract-changes-require-ADR
preconditions:
  - hook-contracts.md
  - component-form-patterns.md
adr:
  - 0011-centralized-autosave-for-settings-panels
---

# Autosave Contract

Contrato del sistema centralizado de autosave para paneles de configuración. Este contrato deriva del [ADR-0011](../10-architecture/adr/0011-centralized-autosave-for-settings-panels.md).

> **Cuándo aplica**: edición de cualquier panel de configuración cuyo backend acepte `PATCH` parcial idempotente sobre un singleton, o `PATCH/POST` upsert sobre un recurso de colección. **Cuándo NO aplica**: catálogos CRUD con alta/baja explícita — esos siguen el patrón `BaseModal` + submit manual descrito en [component-form-patterns.md](./component-form-patterns.md).

## Surface

```ts
import { useAutoSaveForm, type AutoSaveStatus } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { AutoSaveStatusBadge } from "@/components/shared"
```

## `useAutoSaveForm<T>(opts)` 🟢

```ts
const { status, invalidReason, lastSavedAt, flush, retry } = useAutoSaveForm({
    form,                       // UseFormReturn<T>
    onSave,                     // (values: T) => Promise<void>
    debounceMs: 1000,           // optional, default 1000
    enabled: !loading,          // optional, default true
    validate,                   // optional, (values) => true | string
    syncedDurationMs: 3000,     // optional, default 3000
})
```

### Inputs

| Prop | Tipo | Default | Notas |
|---|---|---|---|
| `form` | `UseFormReturn<T>` | — | Instancia de react-hook-form. Los campos deben estar registrados (vía `register`, `Controller` o el `<FormField>` de shadcn). |
| `onSave` | `(values: T) => Promise<void>` | — | Debe persistir los valores. La instancia es reemplazable entre renders (el hook captura la última referencia mediante un ref). |
| `debounceMs` | `number` | `1000` | Ventana de debounce. Para colecciones de filas, usar `300–500`. |
| `enabled` | `boolean` | `true` | Mientras sea `false`, el hook no programa saves (típicamente `!loading` durante la carga inicial). |
| `validate` | `(values: T) => true \| string` | — | Si devuelve `string`, el guardado queda bloqueado y el motivo se expone vía `invalidReason`. Si devuelve `true`, autoriza el flujo normal. |
| `syncedDurationMs` | `number` | `3000` | Tiempo que el estado se mantiene en `synced` antes de volver a `idle`. |

### Outputs

| Return | Tipo | Notas |
|---|---|---|
| `status` | `"idle" \| "dirty" \| "invalid" \| "saving" \| "synced" \| "error"` | Máquina de estados del autosave. |
| `invalidReason` | `string \| null` | Motivo cuando `status === "invalid"`. |
| `lastSavedAt` | `Date \| null` | Marca temporal del último guardado exitoso. |
| `flush` | `() => Promise<void>` | Cancela el debounce pendiente y guarda inmediatamente si hay cambios. |
| `retry` | `() => Promise<void>` | Reintenta el guardado tras `error`, sin esperar debounce. |

### Máquina de estados

```
                    setValue
        ┌────────────────────────────┐
        ▼                            │
     idle ──── setValue ──► dirty ──┘
       ▲                     │
       │                     │ debounce expira
       │                     ▼
       │                   saving ──── error ──► error ──┐
       │                     │                            │ retry()
       │                     ▼                            │
       └──── syncedDuration synced ◄─────────────────────┘
                             ▲
                  validate=string
                   bloquea aquí
                             │
                          invalid ──► (al pasar valid) ──► dirty
```

- **idle**: sin cambios pendientes. Estado inicial y final tras `synced`.
- **dirty**: hay cambios; el debounce está corriendo.
- **invalid**: validación bloqueante activa; el guardado queda en pausa hasta que `validate` devuelva `true` (al cambiar valores se reevalúa).
- **saving**: PATCH en vuelo.
- **synced**: PATCH exitoso; `lastSavedAt` actualizado. Tras `syncedDurationMs` vuelve a `idle` salvo que el form se ensucie de nuevo.
- **error**: el `onSave` rechazó. El form mantiene los valores actuales; `retry()` reintenta sin perderlos.

### Garantías

1. **Coalescencia**: ediciones consecutivas dentro de la ventana de debounce producen un único `onSave`.
2. **No concurrencia**: si un save está en vuelo, no se programa otro hasta que termina; ediciones durante `saving` agendan un nuevo ciclo al concluir.
3. **Sin loop tras success**: el reset interno tras `onSave` está marcado por un ref para que el `watch` no reagende.
4. **Flush en unmount**: si el componente se desmonta con cambios pendientes, el hook intenta guardar antes de que React limpie el efecto.
5. **Validez como gate**: cuando `validate` devuelve string, ningún PATCH se emite; el motivo es legible y queda expuesto vía `invalidReason` para UI o tooltip.

### Restricciones

- ❌ No usar con formularios sin Zod + react-hook-form (invariante 6 del [README](../README.md)).
- ❌ No leer `data`/`error`/`mutate` raw de TanStack en el caller; envolver `onSave` en una mutation o función de feature hook.
- ❌ No combinar con un botón "Guardar" tradicional (anti-patrón). Si necesitas un commit explícito, usar `flush()` desde un atajo de teclado.

## `useUnsavedChangesGuard(status)` 🟢

```ts
useUnsavedChangesGuard(status)
```

Engancha `beforeunload` mientras `status ∈ {dirty, saving, invalid}` para advertir al usuario que está cerrando con cambios pendientes. Se desengancha automáticamente cuando vuelve a `idle | synced | error`.

> **Limitación**: los navegadores muestran un texto genérico, no el `returnValue` que pasemos. La función igualmente cumple su rol de bloquear la salida.

## `AutoSaveStatusBadge`

```tsx
<AutoSaveStatusBadge
    status={status}
    invalidReason={invalidReason}
    lastSavedAt={lastSavedAt}
    onRetry={retry}
/>
```

| Prop | Tipo | Notas |
|---|---|---|
| `status` | `AutoSaveStatus` | Obligatorio. |
| `invalidReason` | `string \| null` | Si presente y `status === "invalid"`, se muestra como tooltip. |
| `lastSavedAt` | `Date \| null` | Cuando `status === "idle"` y existe, el badge muestra "Guardado hace …". |
| `onRetry` | `() => void \| Promise<void>` | Cuando `status === "error"`, renderiza un botón "Reintentar" al lado. |

Mapeo visual:

| Estado | Variant | Texto | Icon |
|---|---|---|---|
| idle | outline | "Sin cambios" o "Guardado hace …s" | `CheckCircle2` |
| dirty | secondary | "Cambios pendientes" | `Pencil` |
| invalid | warning | "Cambios sin guardar" + tooltip con motivo | `AlertCircle` |
| saving | info | "Guardando…" (icon spin) | `Loader2` |
| synced | success | "Guardado" | `CheckCircle2` |
| error | destructive | "Error al guardar" + botón Reintentar | `CloudOff` |

## Patrón de uso completo (singleton)

```tsx
const form = useForm<MyValues>({ resolver, defaultValues: DEFAULTS })

useEffect(() => {
    void loadInitial().then((data) => form.reset(data))
}, [form])

const onSave = useCallback(async (data: MyValues) => {
    await api.patch('/my/settings/current/', data)
}, [])

const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
    form, onSave, enabled: !loading,
})

useUnsavedChangesGuard(status)

return (
    <>
        <AutoSaveStatusBadge
            status={status}
            invalidReason={invalidReason}
            lastSavedAt={lastSavedAt}
            onRetry={retry}
        />
        <Form {...form}>{/* fields */}</Form>
    </>
)
```

## Patrón con `validate` (singleton con validación terminal)

Caso de referencia: ReconciliationIntelligence (los pesos deben sumar 100 % para autorizar el guardado).

```tsx
const validate = (v: MyValues) =>
    v.amount_weight + v.date_weight + v.reference_weight + v.contact_weight === 100
        || "Los pesos deben sumar 100% — los cambios no se guardarán hasta corregir"

useAutoSaveForm({ form, onSave, validate })
```

Mientras la validación falle, `status === "invalid"` y `onSave` no se llama. Al alcanzar la validez, el hook reagenda automáticamente con el debounce normal.

## Patrón colección (autosave por fila)

Caso de referencia: WorkflowSettings (asignación de reglas).

```tsx
function RuleRow({ rule }: { rule: Rule }) {
    const form = useForm<RuleValues>({ defaultValues: rule })
    const onSave = useCallback(async (data: RuleValues) => {
        await api.patch(`/workflow/assignment-rules/${rule.id}/`, data)
    }, [rule.id])
    const auto = useAutoSaveForm({ form, onSave, debounceMs: 400 })
    return (
        <div>
            {/* fields */}
            <AutoSaveStatusBadge {...auto} onRetry={auto.retry} />
        </div>
    )
}
```

Cuando una fila tiene varios forms (ej. la regla + un campo singleton embebido), combinar estados con `useCombinedAutoSaveStatus(...statuses)` (entregado en PR-4).

## Forbidden patterns

- ❌ Implementar el debounce con `useEffect + setTimeout` directamente en un componente. Siempre usar el hook.
- ❌ Mostrar feedback de guardado con `toast.success` por cambio. El badge sustituye al toast (el toast queda reservado para errores fatales del backend más allá de "save falló").
- ❌ Coexistir un botón "Guardar" tradicional + autosave en la misma surface — confunde al usuario sobre cuál es la fuente de verdad.
- ❌ Llamar a `flush()` dentro de un efecto de cambio de pestaña sin verificar `status`: el hook ya garantiza flush en unmount.

## Testing

Los tests del hook están en [`frontend/hooks/useAutoSaveForm.test.ts`](../../frontend/hooks/useAutoSaveForm.test.ts) y cubren:

- Estado inicial `idle`.
- Debounce: dispara una vez tras la ventana, coalesciona ediciones consecutivas.
- Transición `dirty → saving → synced → idle`.
- `validate` bloquea con motivo y libera al volver a válido.
- `error` tras fallo del save.
- `retry()` y `flush()` ejecutan correctamente.
- `enabled: false` no programa saves.

> En tests, registrar los campos manualmente con `form.register('field')` antes de hacer `form.setValue(...)`. RHF v7 sólo emite `info.name` en watch para campos registrados.
