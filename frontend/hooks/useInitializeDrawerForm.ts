"use client"

import { useRef } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

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
}

/**
 * Hook to initialize react-hook-form inside a Drawer (or Modal) following the
 * "Adjust state during render" pattern (ADR-0051). It avoids cascading re-renders
 * by calling form.reset() during the render phase when the drawer opens or the
 * entity ID changes.
 */
export function useInitializeDrawerForm<TData, TForm extends FieldValues>({
    form,
    open,
    initialData,
    getEntityId,
    mapData,
    defaultValues,
}: UseInitializeDrawerFormOptions<TData, TForm>): void {
    const prevResetKeyRef = useRef<string>("")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = getEntityId
        ? getEntityId(initialData as TData)
        : ((initialData as any)?.id)

    const resetKey = open
        ? (id?.toString() ?? "__new__")
        : "__closed__"

    if (resetKey !== prevResetKeyRef.current) {
        prevResetKeyRef.current = resetKey

        if (open) {
            const values = initialData
                ? (mapData ? mapData(initialData) : (initialData as unknown as Partial<TForm>))
                : (typeof defaultValues === 'function' ? defaultValues() : defaultValues)

            form.reset(values as any)
        }
    }
}
