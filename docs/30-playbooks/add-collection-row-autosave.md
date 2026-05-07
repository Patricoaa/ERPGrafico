---
layer: 30-playbooks
doc: add-collection-row-autosave
status: active
owner: frontend-team
last_review: 2026-05-07
preconditions:
  - autosave-contract.md
  - add-settings-panel.md
---

# Playbook: autosave por fila en colecciones editables

Guía para conectar `useAutoSaveForm` a colecciones donde **cada fila tiene su propio estado de guardado**, en lugar de un único form a nivel de página.

> **Cuándo usarlo**: cuando cada ítem de la lista guarda de forma independiente vía PATCH/POST y el usuario puede editar varias filas simultáneamente (ej. reglas de workflow, configuración de filas de catálogo con edición inline).  
> No usar para catálogos CRUD con alta/baja — ver [add-catalog-crud.md](./add-catalog-crud.md).

---

## 1. Patrón base: un form por fila

Cada fila es un componente `React.memo` con su propio `useForm` + `useAutoSaveForm`.

```tsx
const MyRow = React.memo(function MyRow({
    item,
    rule,
}: {
    item: ItemDef
    rule: MyRule | undefined
}) {
    const queryClient = useQueryClient()

    // Ref estable para el closure de onSave — evita re-crear onSave cuando rule cambia
    const ruleRef = useRef(rule)
    ruleRef.current = rule

    const form = useForm<MyValues>({
        resolver: zodResolver(mySchema),
        defaultValues: ruleToValues(rule),
    })

    // Sincronizar cuando el servidor devuelve datos frescos (post-invalidación)
    useEffect(() => {
        if (!form.formState.isDirty) {
            form.reset(ruleToValues(ruleRef.current))
        }
    }, [rule, form])

    const onSave = useCallback(async (data: MyValues) => {
        const current = ruleRef.current
        if (current?.id) {
            await api.patch(`/my-endpoint/${current.id}/`, buildPayload(item, data))
        } else {
            await api.post("/my-endpoint/", buildPayload(item, data))
        }
        // Invalidar para que la fila reciba el id real tras un POST
        queryClient.invalidateQueries({ queryKey: myKeys.list() })
    }, [item.id, queryClient])

    const { status } = useAutoSaveForm({ form, onSave, debounceMs: 400 })

    return (
        <div className="...">
            {/* campos de la fila */}
            <RowSaveIndicator status={status} />
        </div>
    )
})
```

### Por qué `ruleRef` en vez de incluir `rule` en deps de `onSave`

Si incluyéramos `rule` en las deps, `onSave` cambiaría de referencia cada vez que el servidor devuelve datos frescos. `useAutoSaveForm` usa `onSaveRef.current`, así que la referencia no importa para el hook — pero un `useCallback` inestable re-registra el timer innecesariamente. La ref garantiza que `onSave` siempre lea el `rule` más actualizado sin reconstruir el callback.

---

## 2. Fila con dos endpoints (upsert + settings parcial)

Cuando una fila guarda a dos endpoints distintos (ej. regla de asignación a `/rules/` y día de generación a `/settings/current/`), usa dos forms + `useCombinedAutoSaveStatus`.

```tsx
const RecurrentRow = React.memo(function RecurrentRow({ item, rule, dayValue }: ...) {
    // — Form 1: regla de asignación —
    const assignmentForm = useForm<AssignmentValues>({ ... })
    const onSaveAssignment = useCallback(async (data) => { /* PATCH /rules/ */ }, [...])
    const { status: assignmentStatus } = useAutoSaveForm({
        form: assignmentForm, onSave: onSaveAssignment, debounceMs: 400,
    })

    // — Form 2: campo numérico en settings —
    const dayForm = useForm<DayValues>({ ... })
    const onSaveDay = useCallback(async (data) => { /* PATCH /settings/current/ */ }, [...])
    const { status: dayStatus } = useAutoSaveForm({
        form: dayForm,
        onSave: onSaveDay,
        debounceMs: 400,
        validate: (v) => (v.value >= 1 && v.value <= 28) || "El día debe estar entre 1 y 28",
    })

    // Estado combinado: muestra el "peor" de los dos
    const combinedStatus = useCombinedAutoSaveStatus([assignmentStatus, dayStatus])

    return (
        <div className="...">
            {/* Campos de dayForm con <Controller> */}
            {/* Campos de assignmentForm */}
            <RowSaveIndicator status={combinedStatus} />
        </div>
    )
})
```

---

## 3. Indicador de guardado inline

Para filas, en lugar del `AutoSaveStatusBadge` (que muestra texto), usa un indicador mínimo que no desplace el layout:

```tsx
function RowSaveIndicator({ status }: { status: AutoSaveStatus }) {
    return (
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {status === "saving"  && <Loader2     className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {status === "synced"  && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            {status === "error"   && <AlertCircle  className="h-3.5 w-3.5 text-destructive" />}
            {status === "invalid" && <AlertCircle  className="h-3.5 w-3.5 text-warning" />}
        </div>
    )
}
```

El contenedor `w-4 h-4` fijo evita layout shift cuando el estado pasa de idle (vacío) a saving (icono).

---

## 4. Carga y organización en el padre

El componente padre fetcha los datos con TanStack Query y los pasa a cada fila. Las filas se montan solo cuando los datos están disponibles (mostrar skeleton mientras `isLoading`).

```tsx
export function MyCollection() {
    const { data: rules = [], isLoading } = useMyRulesQuery()

    if (isLoading) return <CardSkeleton count={5} variant="list" />

    const ruleByType = Object.fromEntries(rules.map((r) => [r.type, r]))

    return (
        <div className="grid gap-2">
            {ITEM_TYPES.map((item) => (
                <MyRow key={item.id} item={item} rule={ruleByType[item.id]} />
            ))}
        </div>
    )
}
```

Ventaja: las filas se montan con `defaultValues` ya correctos (no hay flash de valores vacíos). El `useEffect` de sincronización solo actúa en actualizaciones posteriores.

---

## 5. Inputs controlados en lugar de `defaultValue + onBlur`

Para campos numéricos inline (ej. `<Input type="number">`), usa `<Controller>` en lugar del patrón uncontrolled:

```tsx
// ❌ Anti-patrón: uncontrolled + onBlur
<Input
    defaultValue={rule?.day}
    onBlur={(e) => handleSave(e.target.value)}
/>

// ✅ Patrón correcto: controlled con Controller
<Controller
    control={form.control}
    name="value"
    render={({ field }) => (
        <Input
            type="number"
            value={field.value}
            onChange={(e) => field.onChange(
                e.target.value === "" ? NaN : parseInt(e.target.value, 10)
            )}
        />
    )}
/>
```

El hook detecta el cambio vía `form.watch(callback)` y dispara el debounce automáticamente.

---

## 6. Checklist pre-PR

- [ ] Cada fila es un componente `React.memo` con su propio `useForm` + `useAutoSaveForm`.
- [ ] `onSave` usa `useRef` para leer `rule` — no está en las deps del `useCallback`.
- [ ] `useEffect` de sincronización guarda con `isDirty` como guardia.
- [ ] Inputs numéricos inline usan `<Controller>`, no `defaultValue + onBlur`.
- [ ] `debounceMs: 400` (más rápido que el estándar de 1000 ms).
- [ ] `<RowSaveIndicator>` con contenedor de ancho fijo para evitar layout shift.
- [ ] `onSave` no envuelve en try/catch — deja que el hook capture errores.
- [ ] El padre muestra skeleton (`isLoading`) antes de renderizar filas.
- [ ] `npm run type-check` sin errores nuevos.

---

## 7. Anti-patrones prohibidos

| Patrón | Motivo |
|:---|:---|
| `defaultValue + onBlur` en `<Input>` | Uncontrolled; el hook no puede observar cambios. |
| `setSaving(taskType)` global en el padre | Elimina la independencia entre filas. |
| `toast.success` en `onSave` | El `RowSaveIndicator` asume este rol. |
| `rule` en deps de `onSave` | Causa re-registro del timer en cada re-fetch; usar `useRef`. |
| Form a nivel de página para N filas | Una fila sucia bloquea el guardado de las demás. |
