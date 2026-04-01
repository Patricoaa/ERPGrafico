import { useState, useCallback } from "react"

interface ConfirmState<T = void> {
    open: boolean
    payload: T | null
}

interface UseConfirmActionReturn<T = void> {
    /** Whether the confirm modal is open */
    isOpen: boolean
    /** The payload that was passed when requesting confirmation */
    payload: T | null
    /** Request confirmation — opens the modal and stores payload */
    requestConfirm: (payload: T) => void
    /** Cancel — closes the modal without executing */
    cancel: () => void
    /** Confirm — executes the callback with the stored payload, then closes */
    confirm: () => Promise<void>
}

/**
 * Hook to replace native `confirm()` with ActionConfirmModal.
 * 
 * Usage:
 * ```tsx
 * const deleteConfirm = useConfirmAction<number>(async (id) => {
 *     await api.delete(`/items/${id}/`)
 *     toast.success("Eliminado")
 * })
 * 
 * // Trigger:
 * <Button onClick={() => deleteConfirm.requestConfirm(item.id)}>Delete</Button>
 * 
 * // Modal:
 * <ActionConfirmModal
 *     open={deleteConfirm.isOpen}
 *     onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
 *     onConfirm={deleteConfirm.confirm}
 *     ...
 * />
 * ```
 */
export function useConfirmAction<T = void>(
    onConfirm: (payload: T) => Promise<void>
): UseConfirmActionReturn<T> {
    const [state, setState] = useState<ConfirmState<T>>({ open: false, payload: null })

    const requestConfirm = useCallback((payload: T) => {
        setState({ open: true, payload })
    }, [])

    const cancel = useCallback(() => {
        setState({ open: false, payload: null })
    }, [])

    const confirm = useCallback(async () => {
        if (state.payload !== null) {
            await onConfirm(state.payload)
        }
        setState({ open: false, payload: null })
    }, [state.payload, onConfirm])

    return {
        isOpen: state.open,
        payload: state.payload,
        requestConfirm,
        cancel,
        confirm,
    }
}
