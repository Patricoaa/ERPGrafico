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
    /** Whether the confirm action is currently executing */
    isConfirming: boolean
    /** Request confirmation — opens the modal and stores payload */
    requestConfirm: (payload?: T) => void
    /** Cancel — closes the modal without executing */
    cancel: () => void
    /** Confirm — executes the callback with the stored payload, then closes */
    confirm: () => Promise<void>
}


export function useConfirmAction<T = void>(
    onConfirm: (payload: T) => Promise<void>
): UseConfirmActionReturn<T> {
    const [state, setState] = useState<ConfirmState<T>>({ open: false, payload: null })
    const [isConfirming, setIsConfirming] = useState(false)

    const requestConfirm = useCallback((payload?: T) => {
        setState({ open: true, payload: payload as T })
    }, [])

    const cancel = useCallback(() => {
        setState({ open: false, payload: null })
    }, [])

    const confirm = useCallback(async () => {
        if (state.payload !== null) {
            setIsConfirming(true)
            try {
                await onConfirm(state.payload)
            } finally {
                setIsConfirming(false)
            }
        } else {
            // Support void payload execution
            setIsConfirming(true)
            try {
                await onConfirm(undefined as unknown as T)
            } finally {
                setIsConfirming(false)
            }
        }
        setState({ open: false, payload: null })
    }, [state.payload, onConfirm])

    return {
        isOpen: state.open,
        payload: state.payload,
        isConfirming,
        requestConfirm,
        cancel,
        confirm,
    }
}
