"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

export type AutoSaveStatus = "idle" | "dirty" | "invalid" | "saving" | "synced" | "error"

export type AutoSaveValidateResult = true | string

export interface UseAutoSaveFormOptions<T extends FieldValues> {
    form: UseFormReturn<T>
    onSave: (values: T) => Promise<void>
    debounceMs?: number
    enabled?: boolean
    validate?: (values: T) => AutoSaveValidateResult
    syncedDurationMs?: number
}

export interface UseAutoSaveFormReturn {
    status: AutoSaveStatus
    invalidReason: string | null
    lastSavedAt: Date | null
    flush: () => Promise<void>
    retry: () => Promise<void>
}

/**
 * Centralized autosave for react-hook-form.
 *
 * Subscribes to field-level changes via `form.watch(callback)`. Programmatic
 * resets (no `info.name`) are ignored, so loading initial data via
 * `form.reset(values)` does not trigger a save loop. Successful saves
 * re-baseline the form via an internal reset flagged with `isResettingRef`.
 *
 * Statuses: `idle | dirty | invalid | saving | synced | error`.
 */
export function useAutoSaveForm<T extends FieldValues>(
    opts: UseAutoSaveFormOptions<T>,
): UseAutoSaveFormReturn {
    const {
        form,
        onSave,
        debounceMs = 1000,
        enabled = true,
        validate,
        syncedDurationMs = 3000,
    } = opts

    const [status, setStatus] = useState<AutoSaveStatus>("idle")
    const [invalidReason, setInvalidReason] = useState<string | null>(null)
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onSaveRef = useRef(onSave)
    const validateRef = useRef(validate)
    const enabledRef = useRef(enabled)
    const debounceMsRef = useRef(debounceMs)
    const isSavingRef = useRef(false)
    const isResettingRef = useRef(false)
    const hasPendingChangesRef = useRef(false)

    onSaveRef.current = onSave
    validateRef.current = validate
    enabledRef.current = enabled
    debounceMsRef.current = debounceMs

    const clearDebounce = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
    }

    const clearSyncedTimer = () => {
        if (syncedTimerRef.current) {
            clearTimeout(syncedTimerRef.current)
            syncedTimerRef.current = null
        }
    }

    const performSave = useCallback(async () => {
        if (isSavingRef.current) return
        const values = form.getValues()
        const validation = validateRef.current?.(values) ?? true
        if (validation !== true) {
            setStatus("invalid")
            setInvalidReason(validation)
            return
        }
        isSavingRef.current = true
        setStatus("saving")
        setInvalidReason(null)
        try {
            await onSaveRef.current(values)
            isResettingRef.current = true
            form.reset(values, {
                keepValues: true,
                keepErrors: true,
                keepTouched: true,
                keepIsSubmitted: true,
            })
            isResettingRef.current = false
            hasPendingChangesRef.current = false
            setLastSavedAt(new Date())
            setStatus("synced")
            clearSyncedTimer()
            syncedTimerRef.current = setTimeout(() => {
                setStatus((current) => (current === "synced" ? "idle" : current))
                syncedTimerRef.current = null
            }, syncedDurationMs)
        } catch {
            setStatus("error")
        } finally {
            isSavingRef.current = false
        }
    }, [form, syncedDurationMs])

    const scheduleSave = useCallback(() => {
        if (!enabledRef.current) return
        if (isSavingRef.current) return
        const validation = validateRef.current?.(form.getValues()) ?? true
        if (validation !== true) {
            clearDebounce()
            setStatus("invalid")
            setInvalidReason(validation)
            return
        }
        setStatus("dirty")
        setInvalidReason(null)
        clearDebounce()
        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null
            void performSave()
        }, debounceMsRef.current)
    }, [form, performSave])

    useEffect(() => {
        const subscription = form.watch((_values, info) => {
            if (isResettingRef.current) return
            if (!info.name) return
            hasPendingChangesRef.current = true
            scheduleSave()
        })
        return () => subscription.unsubscribe()
    }, [form, scheduleSave])

    useEffect(() => {
        return () => {
            clearDebounce()
            clearSyncedTimer()
            if (hasPendingChangesRef.current && !isSavingRef.current) {
                void performSave()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const flush = useCallback(async () => {
        clearDebounce()
        if (hasPendingChangesRef.current) {
            await performSave()
        }
    }, [performSave])

    const retry = useCallback(async () => {
        clearDebounce()
        await performSave()
    }, [performSave])

    return { status, invalidReason, lastSavedAt, flush, retry }
}
