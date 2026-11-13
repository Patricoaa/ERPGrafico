"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EmptyState } from "../EmptyState"
import { SkeletonShell } from "../SkeletonShell"
import { SectionTitleIdContext } from "./SectionContext"
import { SectionHeader, type SectionHeaderProps } from "./SectionHeader"

export interface SectionStateProps {
    isLoading?: boolean
    /** Hay un error al cargar el contenido. */
    isError?: boolean
    /** No hay filas que mostrar. */
    isEmpty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    onRetry?: () => void
}

export interface SectionProps extends Omit<SectionHeaderProps, "title" | "id" | "spaced">, SectionStateProps {
    /** Sin título la sección es solo la lista de filas. */
    title?: string
    className?: string
    children?: React.ReactNode
}

/**
 * Sección: cabecera opcional + filas separadas por líneas. Resuelve `loading` / `empty` / `error`.
 * Filas: `Section.Row` · notas: `Section.Note` · acciones: `Section.Action` · cabecera suelta: `Section.Header`.
 */
export function SectionRoot({
    title, description, icon, count, actions, as, className, children,
    isLoading, isError, isEmpty, emptyTitle = "Sin datos", emptyDescription, onRetry,
}: SectionProps) {
    const titleId = React.useId()

    let body: React.ReactNode
    if (isLoading) {
        body = <SkeletonShell isLoading ariaLabel={title ? `Cargando ${title}` : "Cargando"} />
    } else if (isError) {
        body = (
            <div role="alert" className="flex items-center justify-between gap-3 py-3 text-sm text-muted-foreground">
                <span>No se pudo cargar el contenido.</span>
                {onRetry && <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>Reintentar</Button>}
            </div>
        )
    } else if (isEmpty) {
        body = <EmptyState variant="minimal" title={emptyTitle} description={emptyDescription} />
    } else {
        body = <ul className="divide-y divide-border">{children}</ul>
    }

    return (
        <SectionTitleIdContext.Provider value={title ? titleId : undefined}>
            <section aria-labelledby={title ? titleId : undefined} className={cn(className)}>
                {title && <SectionHeader title={title} description={description} icon={icon} count={count} actions={actions} as={as} />}
                {body}
            </section>
        </SectionTitleIdContext.Provider>
    )
}
