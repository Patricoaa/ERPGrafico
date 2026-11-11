"use client"

import { BaseModal } from "@/components/shared"
import type { POSSession, POSSessionAudit } from "@/types/pos"
import { SessionCloseView } from "./SessionCloseView"

interface SessionCloseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    session: POSSession
    onSuccess?: (audit: POSSessionAudit) => void
}

/**
 * Cierre de sesión del POS a pantalla completa: un diálogo opaco que cubre toda la ventana (sin el
 * POS ni la lista detrás) con el mismo flujo táctil de la apertura. Se abre desde el POS, la lista
 * de sesiones y la ficha de sesión (siempre como diálogo, también dentro de un panel persistente).
 * Escape y el clic fuera no lo cierran: se sale con "Cancelar".
 */
export function SessionCloseModal({ open, onOpenChange, session, onSuccess }: SessionCloseModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            asDialog
            variant="raw"
            size="full"
            // El encabezado del diálogo queda solo para lectores de pantalla: la barra visible es la del flujo
            title="Cierre de sesión de POS"
            headerClassName="sr-only"
            showCloseButton={false}
            hideScrollArea
            onEscapeKeyDown={e => e.preventDefault()}
            onInteractOutside={e => e.preventDefault()}
            className="inset-0 top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 shadow-none sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        >
            {open && (
                <SessionCloseView
                    session={session}
                    onCancel={() => onOpenChange(false)}
                    onSuccess={audit => {
                        onSuccess?.(audit)
                        onOpenChange(false)
                    }}
                />
            )}
        </BaseModal>
    )
}
