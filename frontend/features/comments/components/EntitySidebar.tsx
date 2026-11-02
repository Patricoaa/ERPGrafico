"use client"

import { ActivitySidebar } from "@/features/audit"
import { cn } from "@/lib/utils"
import { COMMENT_LABEL_BY_AUDIT_TYPE, type AuditEntityType } from "../lib/entityLabels"
import { CommentsPanel } from "./CommentsPanel"

interface EntitySidebarProps {
    /** Clave de historial de ActivitySidebar; también resuelve el label comentable. */
    entityType: AuditEntityType
    entityId: number | string
    /** Título de la sección de actividad. */
    title?: string
    className?: string
}

/**
 * Rail derecho de drawers: comentarios arriba y actividad (auditoría) abajo (ADR-0111).
 * Misma API que ActivitySidebar: reemplazarlo es cambiar solo el nombre del componente.
 */
export function EntitySidebar({ entityType, entityId, title, className }: EntitySidebarProps) {
    const label = COMMENT_LABEL_BY_AUDIT_TYPE[entityType]
    return (
        <div className={cn("flex h-full min-h-0 flex-col", className)}>
            {label && <CommentsPanel target={{ label, id: entityId }} />}
            {/* Con comentarios, la actividad arranca cerrada: en el rail lo principal es la conversación. */}
            <ActivitySidebar entityId={entityId} entityType={entityType} title={title} defaultOpen={!label} />
        </div>
    )
}
