"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { useDirtyGuard } from "./useDirtyGuard"

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

interface UseInitializeDrawerFormOptions<TData, TForm extends FieldValues> {
    form: UseFormReturn<TForm>
    open: boolean
    initialData: TData | undefined | null
    /**
     * Function to extract a unique ID from the initial data.
     * Defaults to looking for an 'id' property.
     */
    getEntityId?: (data: TData) => string | number | undefined | null
    /**
     * Function to map the initial data to form values when editing.
     */
    mapData?: (data: TData) => Partial<TForm>
    /**
     * Function to return default form values when creating (initialData is null/undefined).
     * Alternatively, pass a static object.
     */
    defaultValues: Partial<TForm> | (() => Partial<TForm>)
    /** Nombre del documento en el diálogo de cambios sin guardar (p. ej. "OV-000183"). */
    guardName?: string
}

/** Nombre legible del registro para el diálogo de cambios sin guardar, sin que cada drawer lo declare. */
function defaultGuardName(data: unknown): string | undefined {
    if (!data || typeof data !== "object") return undefined
    const record = data as Record<string, unknown>
    for (const key of ["display_id", "name", "title", "code"]) {
        const value = record[key]
        if (typeof value === "string" && value.trim()) return value
    }
    return undefined
}

/**
 * Hook to initialize react-hook-form inside a Drawer (or Modal).
 *
 * The reset runs in a layout effect instead of during render. `form.reset()`
 * updates react-hook-form's store, which mounted `Controller` components
 * subscribe to; doing that while the parent renders triggers React 19's
 * "Cannot update a component while rendering a different component" warning.
 *
 * `useLayoutEffect` runs before paint, so the form still initializes without
 * flashing stale values. The reset key (open state + entity id) is the only
 * trigger: it changes when the drawer opens, closes, or switches entity.
 *
 * Also registers the form in the unsaved-changes guard (`useDirtyGuard`): while it is dirty, the
 * entity stack blocks opening, going back or closing until the user saves or discards.
 */
export function useInitializeDrawerForm<TData, TForm extends FieldValues>({
    form,
    open,
    initialData,
    getEntityId,
    mapData,
    defaultValues,
    guardName,
}: UseInitializeDrawerFormOptions<TData, TForm>): void {
    useDirtyGuard({ form, open, name: guardName ?? defaultGuardName(initialData) })
    const prevResetKeyRef = useRef<string>("")

    const id = getEntityId
        ? getEntityId(initialData as TData)
        : (initialData as { id?: string | number } | null | undefined)?.id

    const resetKey = open
        ? (id?.toString() ?? "__new__")
        : "__closed__"

    useIsomorphicLayoutEffect(() => {
        if (resetKey === prevResetKeyRef.current) {
            return
        }
        prevResetKeyRef.current = resetKey

        if (!open) {
            return
        }

        const values = initialData
            ? (mapData ? mapData(initialData) : (initialData as unknown as Partial<TForm>))
            : (typeof defaultValues === 'function' ? defaultValues() : defaultValues)

        // Only the reset key may trigger this effect. The latest render's data is
        // intentionally used so opening or switching entities resets exactly once.
        form.reset(values as TForm)
    }, [resetKey])
}
