"use client"

import { useEffect, useState } from "react"
import { SessionOperatorGate, useOperatorGate } from "../operator"
import type { POSSession, POSSessionAudit } from "@/types/pos"
import { SessionCloseModal } from "./SessionCloseModal"

interface GatedSessionCloseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    session: POSSession
    onSuccess?: (audit: POSSessionAudit) => void
}

function GatedClose({ open, onOpenChange, session, onSuccess }: GatedSessionCloseModalProps) {
    const { ensureOperator, release, forget } = useOperatorGate()
    const [identified, setIdentified] = useState(false)

    // En caja multiusuario el cierre pide operador antes de mostrar el formulario.
    useEffect(() => {
        if (!open) return
        let cancelled = false
        void ensureOperator('SESSION_CLOSE').then((ok) => {
            if (cancelled) return
            if (ok) setIdentified(true)
            else onOpenChange(false)
        })
        return () => { cancelled = true }
    }, [open, ensureOperator, onOpenChange])

    return (
        <SessionCloseModal
            open={open && identified}
            onOpenChange={(next) => {
                if (!next) { setIdentified(false); void release('SESSION_CLOSE') }
                onOpenChange(next)
            }}
            session={session}
            onSuccess={(audit) => {
                setIdentified(false)
                forget() // el backend ya consumió el pase de cierre
                onSuccess?.(audit)
            }}
        />
    )
}

/** Cierre de sesión desde fuera del POS (lista de sesiones), con el mismo desafío de operador. */
export function GatedSessionCloseModal(props: GatedSessionCloseModalProps) {
    return (
        <SessionOperatorGate sessionId={props.session.id} isMultiUser={props.session.my_mode === "MULTI"}>
            <GatedClose {...props} />
        </SessionOperatorGate>
    )
}
