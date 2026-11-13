"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSectionTitleId } from "./SectionContext"
import { formatRecordCount, useRecordCount } from "./RecordCountContext"

export interface SectionHeaderProps {
    title: string
    /** Texto de apoyo bajo el título. */
    description?: React.ReactNode
    icon?: LucideIcon | React.ElementType
    /** Conteo o resumen junto al título (`3`, `"2 de 5"`, un monto…). Sin él, muestra el total de la `Collection` del ámbito (`Section.Scope`). */
    count?: React.ReactNode
    /** Acciones a la derecha (por defecto botones ghost: ver `Section.Action`). */
    actions?: React.ReactNode
    /** Nivel semántico del encabezado. */
    as?: "h2" | "h3" | "h4"
    /** Agrega aire superior: úsalo cuando la cabecera separa grupos dentro de un formulario o pestaña. */
    spaced?: boolean
    id?: string
    className?: string
}

/**
 * Cabecera de sección (N1): título en mayúsculas con icono y conteo opcionales, línea inferior y
 * acciones a la derecha. Se usa sola para separar grupos de un formulario o dentro de `Section`.
 */
export function SectionHeader({ title, description, icon: Icon, count, actions, as: Heading = "h3", spaced, id, className }: SectionHeaderProps) {
    const contextId = useSectionTitleId()
    const recordCount = useRecordCount()
    const shownCount = count ?? (recordCount !== null ? formatRecordCount(recordCount) : undefined)
    return (
        <div className={cn("flex items-start justify-between gap-3 border-b border-border pb-1 select-none", spaced && "pt-4", className)}>
            <div className="min-w-0">
                <Heading id={id ?? contextId} className="flex min-w-0 items-center gap-2 text-2xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
                    <span className="truncate">{title}</span>
                </Heading>
                {description && <div className="mt-1 text-2xs font-normal normal-case tracking-normal text-muted-foreground">{description}</div>}
            </div>
            {(shownCount != null || actions) && (
                <div className="flex shrink-0 items-center gap-2 select-text">
                    {shownCount != null && <span className="text-2xs tabular-nums text-muted-foreground">{shownCount}</span>}
                    {actions}
                </div>
            )}
        </div>
    )
}
