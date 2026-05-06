import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useAutoSaveForm } from './useAutoSaveForm'

interface TestFormValues {
    name: string
    age: number
}

function setupHook(opts?: {
    onSave?: (values: TestFormValues) => Promise<void>
    debounceMs?: number
    enabled?: boolean
    validate?: (values: TestFormValues) => true | string
    syncedDurationMs?: number
    defaultValues?: TestFormValues
}) {
    const onSave = opts?.onSave ?? vi.fn().mockResolvedValue(undefined)
    const defaultValues = opts?.defaultValues ?? { name: 'init', age: 30 }

    const result = renderHook(() => {
        const form = useForm<TestFormValues>({ defaultValues })
        useEffect(() => {
            form.register('name')
            form.register('age')
        }, [form])
        const auto = useAutoSaveForm({
            form,
            onSave,
            debounceMs: opts?.debounceMs ?? 30,
            enabled: opts?.enabled ?? true,
            validate: opts?.validate,
            syncedDurationMs: opts?.syncedDurationMs ?? 80,
        })
        return { form, auto }
    })

    return { ...result, onSave }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useAutoSaveForm', () => {
    it('starts in idle status with a clean form', () => {
        const { result } = setupHook()
        expect(result.current.auto.status).toBe('idle')
        expect(result.current.auto.invalidReason).toBeNull()
        expect(result.current.auto.lastSavedAt).toBeNull()
    })

    it('debounces the save and fires once after the delay', async () => {
        const { result, onSave } = setupHook({ debounceMs: 50 })

        act(() => {
            result.current.form.setValue('name', 'changed', { shouldDirty: true })
        })

        await waitFor(() => expect(result.current.auto.status).toBe('dirty'))
        expect(onSave).not.toHaveBeenCalled()

        await wait(20)
        expect(onSave).not.toHaveBeenCalled()

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'changed' }))
    })

    it('coalesces consecutive edits into a single save', async () => {
        const { result, onSave } = setupHook({ debounceMs: 60 })

        act(() => {
            result.current.form.setValue('name', 'a', { shouldDirty: true })
        })
        await wait(20)
        act(() => {
            result.current.form.setValue('name', 'ab', { shouldDirty: true })
        })
        await wait(20)
        act(() => {
            result.current.form.setValue('name', 'abc', { shouldDirty: true })
        })

        expect(onSave).not.toHaveBeenCalled()

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'abc' }))
    })

    it('transitions through dirty → saving → synced → idle', async () => {
        const { result, onSave } = setupHook({ debounceMs: 30, syncedDurationMs: 60 })

        act(() => {
            result.current.form.setValue('name', 'changed', { shouldDirty: true })
        })

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(result.current.auto.status).toBe('synced'))
        expect(result.current.auto.lastSavedAt).toBeInstanceOf(Date)

        await waitFor(() => expect(result.current.auto.status).toBe('idle'), { timeout: 200 })
    })

    it('gates the save when validate returns a string and exposes the reason', async () => {
        const validate = (v: TestFormValues) => v.age >= 18 || 'Debe ser mayor de edad'
        const { result, onSave } = setupHook({ debounceMs: 30, validate })

        act(() => {
            result.current.form.setValue('age', 10, { shouldDirty: true })
        })

        await waitFor(() => expect(result.current.auto.status).toBe('invalid'))
        expect(result.current.auto.invalidReason).toBe('Debe ser mayor de edad')

        await wait(80)
        expect(onSave).not.toHaveBeenCalled()

        act(() => {
            result.current.form.setValue('age', 25, { shouldDirty: true })
        })

        await waitFor(() => expect(result.current.auto.status).toBe('dirty'))
        expect(result.current.auto.invalidReason).toBeNull()

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    })

    it('marks status as error when onSave throws', async () => {
        const onSave = vi.fn().mockRejectedValue(new Error('boom'))
        const { result } = setupHook({ debounceMs: 30, onSave })

        act(() => {
            result.current.form.setValue('name', 'x', { shouldDirty: true })
        })

        await waitFor(() => expect(result.current.auto.status).toBe('error'))
    })

    it('retry() reintenta el save tras error', async () => {
        const onSave = vi
            .fn<(values: TestFormValues) => Promise<void>>()
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce(undefined)
        const { result } = setupHook({ debounceMs: 30, onSave })

        act(() => {
            result.current.form.setValue('name', 'x', { shouldDirty: true })
        })

        await waitFor(() => expect(result.current.auto.status).toBe('error'))

        await act(async () => {
            await result.current.auto.retry()
        })

        await waitFor(() => expect(result.current.auto.status).toBe('synced'))
        expect(onSave).toHaveBeenCalledTimes(2)
    })

    it('flush() guarda inmediatamente y cancela el debounce pendiente', async () => {
        const { result, onSave } = setupHook({ debounceMs: 5000 })

        act(() => {
            result.current.form.setValue('name', 'urgent', { shouldDirty: true })
        })

        expect(onSave).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.auto.flush()
        })

        expect(onSave).toHaveBeenCalledTimes(1)
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'urgent' }))
    })

    it('respeta enabled=false (no dispara save)', async () => {
        const { result, onSave } = setupHook({ debounceMs: 30, enabled: false })

        act(() => {
            result.current.form.setValue('name', 'x', { shouldDirty: true })
        })

        await wait(80)
        expect(onSave).not.toHaveBeenCalled()
    })
})
