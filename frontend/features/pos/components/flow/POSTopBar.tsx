"use client"

import type { ReactNode } from "react"
import { Store } from "lucide-react"
import { cn } from "@/lib/utils"

interface POSTopBarProps {
    /** Nombre del punto de venta (o "Punto de Venta" sin sesión). */
    title: string
    /** Modo de caja o tarea en curso ("Multiusuario", "Apertura de caja"…). */
    subtitle?: ReactNode
    /** Barra de progreso del flujo activo (`POSStepper`). */
    progress?: ReactNode
    /** Acciones a la derecha (Salir, menú, borradores…). */
    actions?: ReactNode
    className?: string
}

/**
 * Barra superior única del POS: identidad (icono + punto de venta + modo de caja) · progreso · acciones.
 * La comparten la venta, la apertura y el cierre de sesión, para que el operador siempre lea
 * dónde está y en qué paso va con la misma estructura.
 */
export function POSTopBar({ title, subtitle, progress, actions, className }: POSTopBarProps) {
    return (
        <header className={cn("flex shrink-0 items-center gap-4 border-b border-border bg-background px-4 py-3 lg:gap-6 lg:px-6", className)}>
            <div className="flex min-w-0 shrink-0 items-center gap-3 lg:w-72">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                    <Store className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-lg font-bold leading-tight">{title}</p>
                    {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                </div>
            </div>

            <div className="flex min-w-0 flex-1 justify-center">{progress}</div>

            <div className="flex shrink-0 items-center justify-end gap-2 lg:min-w-72">{actions}</div>
        </header>
    )
}
