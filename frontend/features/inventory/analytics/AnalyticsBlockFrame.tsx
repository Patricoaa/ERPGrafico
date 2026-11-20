"use client"

import type { ReactNode } from "react"
import { SkeletonShell } from "@/components/shared"

interface AnalyticsBlockFrameProps {
    isLoading: boolean
    isError: boolean
    errorMessage: string
    isEmpty: boolean
    emptyMessage: string
    /** Layout placeholder del bloque; si se omite, `SkeletonShell` usa su placeholder estándar. */
    skeleton?: ReactNode
    children: ReactNode
}

/** Estados de carga, error y vacío de un bloque de análisis de producto. */
export function AnalyticsBlockFrame({
    isLoading, isError, errorMessage, isEmpty, emptyMessage, skeleton, children,
}: AnalyticsBlockFrameProps) {
    if (isLoading) {
        return <SkeletonShell isLoading ariaLabel="Cargando análisis del producto">{skeleton}</SkeletonShell>
    }
    if (isError) {
        return <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
    }
    if (isEmpty) {
        return <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
    }
    return <>{children}</>
}
