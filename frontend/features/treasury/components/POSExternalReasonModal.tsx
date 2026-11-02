"use client"

import { useEffect, useRef, useState } from "react"
import { Store } from "lucide-react"
import { ActionConfirmModal } from "@/components/shared"
import {
    registerPosExternalReasonHandler,
    type PosExternalReasonChallenge,
} from "@/lib/pos-external-reason"

interface PendingChallenge {
    id: number
    challenge: PosExternalReasonChallenge
    resolve: (reason: string | null) => void
}

/**
 * Pide el motivo cuando un movimiento toca una caja POS con sesión abierta
 * desde fuera de esa sesión (ADR-0109). Se monta una vez por shell; el
 * interceptor de `lib/api` reintenta la request con el motivo.
 */
export function POSExternalReasonModal() {
    const [queue, setQueue] = useState<PendingChallenge[]>([])
    const answered = useRef(false)
    const nextId = useRef(0)

    useEffect(() => registerPosExternalReasonHandler(
        (challenge) => new Promise<string | null>((resolve) => {
            nextId.current += 1
            const id = nextId.current
            setQueue((q) => [...q, { id, challenge, resolve }])
        })
    ), [])

    const current = queue[0]

    const settle = (reason: string | null) => {
        if (!current) return
        current.resolve(reason)
        setQueue((q) => q.slice(1))
    }

    if (!current) return null
    const { challenge } = current
    const terminal = challenge.terminal_name ? ` en ${challenge.terminal_name}` : ""

    return (
        <ActionConfirmModal
            key={current.id}
            open
            onOpenChange={(open) => {
                if (open) return
                if (!answered.current) settle(null)
                answered.current = false
            }}
            onConfirm={(reason) => {
                answered.current = true
                settle(reason ?? null)
            }}
            variant="warning"
            icon={Store}
            title="Caja POS en uso"
            description={
                <div className="space-y-2">
                    <p>
                        La caja <strong className="text-foreground">{challenge.account_name}</strong> tiene
                        la sesión POS #{challenge.session_id} abierta por {challenge.cashier_name}{terminal}.
                    </p>
                    <p>
                        Este movimiento quedará fuera de esa sesión y aparecerá en sus informes X y Z
                        como movimiento externo, junto con el motivo.
                    </p>
                </div>
            }
            requireReason
            reasonLabel="Motivo"
            reasonPlaceholder="Ej.: pago a proveedor con efectivo de caja autorizado por gerencia"
            confirmText="Registrar con motivo"
        />
    )
}
