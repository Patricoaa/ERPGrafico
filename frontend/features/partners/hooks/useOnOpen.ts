'use client'

import { useState } from 'react'

/**
 * Ejecuta `onOpen` una vez cada vez que `open` pasa a verdadero, durante el render
 * (patrón «ajustar estado al cambiar una prop»), sin `useEffect` ni `setState` en efecto.
 * `onClose` se ejecuta al pasar a falso. Úsalo para sembrar/reiniciar el borrador de un modal.
 */
export function useOnOpen(open: boolean, onOpen: () => void, onClose?: () => void): void {
    const [wasOpen, setWasOpen] = useState(false)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) onOpen()
        else onClose?.()
    }
}
