---
layer: 30-playbooks
doc: add-settings-panel
status: active
owner: frontend-team
last_review: 2026-05-28
preconditions:
  - autosave-contract.md
  - component-form-patterns.md §8
---

# Playbook: agregar un panel de configuración (settings page-level)

Guía para añadir o migrar un panel de configuración singleton que sigue el patrón autosave centralizado.

> **Regla primaria**: todo panel de settings singleton usa `useAutoSaveForm` + `AutoSaveStatusBadge`. Nunca un botón "Guardar" manual. Ver la matriz de decisión en [component-form-patterns.md §8](../20-contracts/component-form-patterns.md).

---

## 1. Estructura mínima

```tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import api from "@/lib/api"
import { Form, FormField } from "@/components/ui/form"
import { AutoSaveStatusBadge, SkeletonShell } from "@/components/shared"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { mySchema, type MyFormValues } from "./MySettingsView.schema"

export function MySettingsView() {
    const [loading, setLoading] = useState(true)

    const form = useForm<MyFormValues>({
        resolver: zodResolver(mySchema),
        defaultValues: { /* ... */ },
    })

    // 1. Cargar datos del servidor al montar
    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get('/my-module/settings/current/')
                form.reset(mapApiToForm(res.data))
            } catch { /* silent — badge handles save errors */ }
            finally { setLoading(false) }
        }
        fetch()
    }, [form])

    // 2. Definir onSave (solo lanza, no maneja errores — el hook los captura)
    const onSave = useCallback(async (data: MyFormValues) => {
        await api.patch('/my-module/settings/current/', data)
    }, [])

    // 3. Conectar al hook centralizado
    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({
        form,
        onSave,
        enabled: !loading,   // no guardar mientras carga
        debounceMs: 1000,    // estándar; 400 ms para colecciones tipo workflow
    })

    // 4. Guardar en unmount + advertir si hay cambios pendientes al navegar
    useUnsavedChangesGuard(status)

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <SkeletonShell isLoading={loading} ariaLabel="Cargando configuración">
                {/* Badge siempre en la esquina superior derecha */}
                <div className="flex justify-end">
                    <AutoSaveStatusBadge
                        status={status}
                        invalidReason={invalidReason}
                        lastSavedAt={lastSavedAt}
                        onRetry={retry}
                    />
                </div>

                <Form {...form}>
                    <form className="space-y-6">
                        {/* campos */}
                    </form>
                </Form>
            </SkeletonShell>
        </div>
    )
}
```

---

## 2. Con validación cruzada (gating semántico)

Cuando un grupo de campos debe cumplir una invariante antes de guardar (ej.: pesos que suman 100 %):

```tsx
const { status, invalidReason } = useAutoSaveForm({
    form,
    onSave,
    validate: (v) =>
        sumWeights(v) === 100 || "Los pesos deben sumar 100 % — los cambios no se guardarán hasta corregir",
})
```

El badge mostrará `invalidReason` en estado `invalid` hasta que la invariante se cumpla.

---

## 3. Usando un hook de dominio (TanStack Query)

Si el módulo ya tiene un hook TanStack Query (`useSalesSettings`, `useInventorySettings`, etc.):

```tsx
const { settings, updateSettings } = useSalesSettings()

const onSave = useCallback(async (data: SalesFormValues) => {
    await updateSettings(data)   // el hook maneja toasts de error internamente
}, [updateSettings])

const { status, ... } = useAutoSaveForm({ form, onSave })
```

No llamar `form.reset(data)` en `onSave` — `useAutoSaveForm` ya hace el reset interno.

---

## 4. Checklist pre-PR

- [ ] El componente **no** tiene botón "Guardar" ni `useEffect + setTimeout` manual.
- [ ] `useAutoSaveForm` recibe `enabled: !loading` para evitar guardar durante la carga inicial.
- [ ] `AutoSaveStatusBadge` está renderizado (siempre visible, no solo en dirty).
- [ ] `useUnsavedChangesGuard(status)` está conectado.
- [ ] `onSave` no envuelve en try/catch — deja que el hook lo capture.
- [ ] El schema Zod está en un archivo `.schema.ts` separado.
- [ ] `npm run type-check` sin errores nuevos.

---

## 5. Anti-patrones prohibidos

| Patrón | Motivo |
|:---|:---|
| `useEffect(() => { const t = setTimeout(() => form.handleSubmit(fn)(), 1000) }, [watchedValues])` | Reemplazado por `useAutoSaveForm` |
| `form.reset(data)` dentro de `onSave` | `useAutoSaveForm` ya lo hace; hacerlo de nuevo puede crear bucles |
| `toast.success("Guardado")` en `onSave` | El badge `synced` cubre este rol |
| `setSaving(true/false)` manual + `onSavingChange?.(saving)` | El status del hook expone el estado; usar `status === 'saving'` si el padre lo necesita |
| Botón "Guardar" en paneles singleton | Solo válido en catálogos CRUD (submit manual) — ver [component-form-patterns.md §8](../20-contracts/component-form-patterns.md) |
