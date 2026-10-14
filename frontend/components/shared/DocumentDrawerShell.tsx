"use client"

import type { ReactNode } from "react"
import { formDrawerWidth } from "@/lib/form-widths"
import { getErrorMessage } from "@/lib/errors"
import { Drawer } from "./Drawer"
import type { PanelBaseProps } from "./PanelHeader"
import { SkeletonShell } from "./SkeletonShell"

/**
 * Ficha documental común (ADR-0080, GAP-10). Zonas: encabezado (identidad del caller vía
 * useDrawerIdentity), resumen, contenido propio del tipo y documentos relacionados.
 * El "volver" de la pila de openEntity lo aporta `Drawer`.
 */
export interface DocumentDrawerShellProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: PanelBaseProps["title"]
    subtitle?: PanelBaseProps["subtitle"]
    icon?: PanelBaseProps["icon"]
    headerActions?: ReactNode
    isLoading?: boolean
    error?: unknown
    /** Texto para el estado de carga (accesibilidad). */
    loadingLabel?: string
    /** Datos clave del documento (estado, fechas, contraparte…). */
    summary?: ReactNode
    /** Contenido específico del tipo (líneas, etapas…). */
    children?: ReactNode
    /** Normalmente <DocumentRelationsSection label id /> de @/features/documents. */
    related?: ReactNode
}

export function DocumentDrawerShell({
    open, onOpenChange, title, subtitle, icon, headerActions,
    isLoading, error, loadingLabel = "Cargando documento", summary, children, related,
}: DocumentDrawerShellProps) {
    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize={formDrawerWidth("master", true)}
            title={title}
            subtitle={subtitle}
            icon={icon}
            headerActions={headerActions}
            mode="view"
        >
            {isLoading ? (
                <SkeletonShell isLoading ariaLabel={loadingLabel} />
            ) : error ? (
                <p className="p-4 text-sm text-destructive">No se pudo cargar el documento: {getErrorMessage(error)}</p>
            ) : (
                <div className="p-4 space-y-6">
                    {summary}
                    {children}
                    {related && (
                        <section className="space-y-2">
                            <h4 className="text-sm font-medium">Documentos relacionados</h4>
                            {related}
                        </section>
                    )}
                </div>
            )}
        </Drawer>
    )
}
