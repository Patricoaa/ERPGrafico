"use client"

import React from "react"
import dynamic from "next/dynamic"

// ADR-0109: pide el motivo si un movimiento toca otra caja POS con sesión abierta
const POSExternalReasonModal = dynamic(
    () => import("@/features/treasury").then(m => ({ default: m.POSExternalReasonModal })),
    { ssr: false },
)

/**
 * Contenedor del POS. Antes se desplazaba cuando el Order Hub global estaba abierto; desde
 * ADR-0083 el POS usa fichas documentales incrustadas y el Hub no existe en este flujo.
 */
export function POSShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            {children}
            <POSExternalReasonModal />
        </div>
    )
}
