"use client"

import { useEffect, useState } from "react"
import { FileText, Link2, type LucideIcon } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentDrawerShell,
    DocumentActionsMenu,
    DocumentLifecycle,
    DocumentFieldGrid,
    FormSection,
    StatusBadge,
    type DocumentActionItem,
    type DocumentField,
    type DocumentSheetTab,
    type LifecycleStep,
} from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout } from "@/features/_shared"
import { useDocumentRelations } from "@/features/documents/hooks/useDocumentRelations"
import type { DocumentDomain, DocumentLink } from "@/features/documents/types"
import { DocumentRelationsTab } from "@/features/documents/components/DocumentRelationsTab"
import { useF29Detail } from "@/features/tax/hooks/useTaxQueries"
import type { F29Detail } from "@/features/tax/types"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { useAuth } from "@/contexts/AuthContext"
import { format } from "date-fns"
import { toDate } from "@/lib/utils"

const LABEL = "tax.f29declaration"
const AUDIT_TYPE = "f29_declaration" as const

/**
 * Ficha documental de Declaración F29 (ADR-0083, component-document-sheet.md).
 * Modo VISTA: usa DocumentDrawerShell con tabs Resumen · Relaciones,
 * ciclo de vida, actions menu e ActivitySidebar.
 */
export interface F29DeclarationSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    onActionSuccess?: () => void
}

export function F29DeclarationSheet({ id, open, onOpenChange, embedded = false, onActionSuccess }: F29DeclarationSheetProps) {
    const { f29Detail: declaration, isLoading: loading, isError, refetch } = useF29Detail(id ?? undefined)
    const { data: relations } = useDocumentRelations(LABEL, id ?? null)
    const invalidateDocuments = useInvalidateDocuments()
    const { user } = useAuth()
    const permissions: string[] = user?.permissions ?? []

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const handleSuccess = () => {
        void refetch()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = declaration?.id ?? `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", declaration, { overrideTitle: `Declaración F29 — ${declaration?.period_display || id}` })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (declaration?.id && displayId) setEntityDisplay(LABEL, declaration.id, String(displayId))
    }, [declaration?.id, displayId, setEntityDisplay])

    // No actions registry for F29 yet
    const resolved: ResolvedDocumentAction<F29Detail>[] = []

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<F29Detail>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {},
    })

    const primary = null
    const secondary = resolved

    const lifecycleSteps = declaration ? getF29Lifecycle(declaration) : null

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "treasury", "accounting"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = declaration ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <F29SummaryTab declaration={declaration} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={declaration.id}
                    sectionActions={getSectionActions(resolved)}
                    rowActions={getRowActions()}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <>
            {declaration && (
                <PrintableLayout
                    ref={printRef}
                    title="Declaración F29"
                    displayId={declaration.period_display ?? String(displayId)}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Período:</span><span>{declaration.period_display}</span></div>
                        <div className="flex justify-between"><span>Estado:</span><span>{declaration.is_registered ? "Registrada" : "Borrador"}</span></div>
                        <div className="flex justify-between"><span>Fecha de Registro:</span><span>{declaration.declaration_date ? format(toDate(declaration.declaration_date), "dd/MM/yyyy") : "—"}</span></div>
                        <div className="flex justify-between"><span>Asiento Contable:</span><span>{declaration.journal_entry_display || declaration.journal_entry || "—"}</span></div>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={declaration && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={secondary.map(toItem)}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!declaration && !isError)}
                error={isError ? new Error("No se pudo cargar la declaración") : undefined}
                loadingLabel="Cargando declaración F29"
                lifecycle={lifecycleSteps && (
                    <DocumentLifecycle
                        steps={lifecycleSteps}
                        onStepClick={openRelationsAt}
                        activeStepId={tab === "relations" ? domain : null}
                    />
                )}
                tabs={tabs}
                tab={tab}
                onTabChange={setTab}
                sidebar={declaration && !embedded ? <ActivitySidebar entityType={AUDIT_TYPE} entityId={declaration.id} /> : undefined}
            />
        </>
    )
}

function F29SummaryTab({ declaration }: { declaration: F29Detail }) {
    const contextFields: DocumentField[] = [
        {
            label: "Período",
            value: declaration.period_display,
        },
        {
            label: "Estado",
            value: <StatusBadge status={declaration.is_registered ? "POSTED" : "DRAFT"} variant="badge" />,
        },
        {
            label: "Fecha de Registro",
            value: declaration.declaration_date ? format(toDate(declaration.declaration_date), "dd/MM/yyyy") : "—",
        },
        {
            label: "Asiento Contable",
            value: declaration.journal_entry_display || declaration.journal_entry || "—",
        },
        {
            label: "Declarado por",
            value: declaration.declared_by || "—",
        },
    ]

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>
        </div>
    )
}

function getF29Lifecycle(declaration: F29Detail): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (declaration.is_registered) {
        steps.push({ id: "registered", label: "Registrada", icon: FileText, status: "success" })
    } else {
        steps.push({ id: "registered", label: "Registrar", icon: FileText, status: "neutral" })
    }

    if (declaration.journal_entry) {
        steps.push({ id: "posted", label: "Asiento Generado", icon: FileText, status: "success" })
    } else if (declaration.is_registered) {
        steps.push({ id: "posted", label: "Generar Asiento", icon: FileText, status: "neutral" })
    } else {
        steps.push({ id: "posted", label: "Generar Asiento", icon: FileText, status: "not_applicable" })
    }

    return steps
}

function getSectionActions(resolved: ResolvedDocumentAction<F29Detail>[]): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
    return {}
}

function getRowActions(): (link: DocumentLink) => DocumentActionItem[] {
    return function(_link: DocumentLink): DocumentActionItem[] { return [] }
}