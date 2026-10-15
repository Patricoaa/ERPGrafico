"use client"

import { useEffect, useState, type ReactNode } from "react"
import { FileText, Link2, type LucideIcon } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentActionsMenu,
    DocumentDrawerShell,
    DocumentFieldGrid,
    DocumentLifecycle,
    FormSection,
    StatusBadge,
    type DocumentActionItem,
    type DocumentField,
    type DocumentSheetTab,
    type LifecycleStep,
} from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { useDrawerIdentity } from "@/features/_shared"
import { useDocumentRelations } from "../hooks/useDocumentRelations"
import type { DocumentDomain, DocumentLink } from "../types"
import { DocumentRelationsTab } from "./DocumentRelationsTab"

type AuditEntityType = Parameters<typeof ActivitySidebar>[0]["entityType"]

export interface DocumentSheetSection {
    title: string
    icon: LucideIcon
    content: ReactNode
}

export interface DocumentSheetProps {
    /** Label del registro (`app.model`): identidad, relaciones y "volver". */
    label: string
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Documento cargado (null mientras carga). */
    document: { id: number; display_id?: string | null } | null
    isLoading?: boolean
    error?: unknown
    loadingLabel?: string
    /** Título explícito; por defecto, `display_id` del documento. */
    title?: string
    /** Estado del documento (StatusBadge en la cabecera) para fichas sin franja de ciclo. */
    status?: string | null
    /** Contexto en una fila (≤4 campos imprescindibles, alineados a la izquierda). */
    context: DocumentField[]
    /** Secciones propias del tipo bajo el contexto (líneas, partidas, detalle…). */
    sections?: DocumentSheetSection[]
    lifecycle?: LifecycleStep[]
    primaryAction?: DocumentActionItem | null
    actions?: DocumentActionItem[]
    onPrint?: () => void
    /** Acciones por área del tab Relaciones / sobre cada relacionado. */
    sectionActions?: Partial<Record<DocumentDomain, DocumentActionItem[]>>
    rowActions?: (link: DocumentLink) => DocumentActionItem[]
    /** Tabs propios del tipo, después de Resumen y antes de Relaciones. */
    extraTabs?: DocumentSheetTab[]
    /** Tipo del historial de auditoría (ActivitySidebar); sin él no hay sidebar. */
    auditType?: AuditEntityType
    embedded?: boolean
}

/**
 * Ficha documental estándar (ADR-0083, component-document-sheet.md): cabecera con menú de
 * acciones (incluye imprimir), ciclo opcional, tabs Resumen (contexto en una fila + secciones
 * del tipo) · [propios] · Relaciones, y sidebar de actividad. Fija el número del documento en
 * la pila de `openEntity` ("Volver a …"). La usan las fichas simples (U5); OV/OC/facturas
 * usan su propia composición con el mismo shell.
 */
export function DocumentSheet({
    label, open, onOpenChange, document, isLoading, error, loadingLabel, title, status,
    context, sections = [], lifecycle, primaryAction, actions = [], onPrint,
    sectionActions, rowActions, extraTabs = [], auditType, embedded = false,
}: DocumentSheetProps) {
    const displayId = title ?? document?.display_id ?? undefined
    const identity = useDrawerIdentity(label, "view", document, displayId ? { overrideTitle: displayId } : undefined)
    const { data: relations } = useDocumentRelations(label, document?.id ?? null)
    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (document?.id && displayId) setEntityDisplay(label, document.id, displayId)
    }, [label, document?.id, displayId, setEntityDisplay])

    const tabs: DocumentSheetTab[] = document ? [
        {
            value: "summary", label: "Resumen", icon: FileText,
            content: (
                <div className="space-y-8">
                    <section aria-label="Contexto"><DocumentFieldGrid fields={context} /></section>
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-4">
                            <FormSection title={section.title} icon={section.icon} />
                            {section.content}
                        </section>
                    ))}
                </div>
            ),
        },
        ...extraTabs,
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={label}
                    id={document.id}
                    sectionActions={sectionActions}
                    rowActions={rowActions}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    const hasMenu = !!primaryAction || actions.length > 0 || !!onPrint

    return (
        <DocumentDrawerShell
            open={open}
            onOpenChange={onOpenChange}
            embedded={embedded}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon}
            headerActions={document ? (
                <>
                    {status && <StatusBadge status={status} variant="badge" />}
                    {hasMenu && <DocumentActionsMenu primary={primaryAction} actions={actions} onPrint={onPrint} />}
                </>
            ) : undefined}
            isLoading={isLoading || (!document && !error)}
            error={error}
            loadingLabel={loadingLabel}
            lifecycle={lifecycle && lifecycle.length > 0 ? (
                <DocumentLifecycle
                    steps={lifecycle}
                    onStepClick={(stepId) => { setDomain(stepId as DocumentDomain); setTab("relations") }}
                    activeStepId={tab === "relations" ? domain : null}
                />
            ) : undefined}
            tabs={tabs}
            tab={tab}
            onTabChange={setTab}
            sidebar={document && auditType && !embedded ? <ActivitySidebar entityType={auditType} entityId={document.id} /> : undefined}
        />
    )
}

/** Celdas DataCell se centran por defecto; en el contexto de la ficha van a la izquierda. */
export const SHEET_LEFT = "w-auto justify-start text-left"
