'use client'

import { useRef } from 'react'
import { shouldKeepIdempotencyKey } from '@/lib/idempotency'
import { generateUuidV4 } from '@/lib/uuid'

/**
 * `Idempotency-Key` por intención del usuario (docs/20-contracts/idempotency.md).
 * La clave se conserva mientras el payload sea el mismo y el resultado anterior sea
 * desconocido (reintento / doble clic); se renueva tras éxito, tras un rechazo del
 * servidor o si el payload cambió (el backend responde 409 si el cuerpo difiere).
 */
export function useIdempotencyKey() {
    const ref = useRef<{ key: string; signature: string } | null>(null)

    const keyFor = (payload: unknown): string => {
        const signature = JSON.stringify(payload) ?? ''
        if (ref.current?.signature !== signature) ref.current = { key: generateUuidV4(), signature }
        return ref.current.key
    }
    /** Éxito: la próxima acción es una intención nueva. */
    const succeeded = () => { ref.current = null }
    /** Fallo: renueva salvo que el desenlace sea incierto (sin respuesta / 425). */
    const failed = (error: unknown) => { if (!shouldKeepIdempotencyKey(error)) ref.current = null }

    return { keyFor, succeeded, failed }
}
