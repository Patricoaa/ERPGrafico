"use client"

import React from "react"

/**
 * Contenedor del POS. Antes se desplazaba cuando el Order Hub global estaba abierto; desde
 * ADR-0083 el POS usa fichas documentales incrustadas y el Hub no existe en este flujo.
 */
export function POSShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            {children}
        </div>
    )
}
