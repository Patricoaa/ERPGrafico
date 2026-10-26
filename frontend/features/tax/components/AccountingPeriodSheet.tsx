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
import { useTaxPeriod } from "@/features/tax/hooks/useTaxQueries"
import type { TaxPeriodDetail } from "@/features/tax/types"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { useAuth } from "@/contexts/AuthContext"
import { format } from "date-fns"
import { toDate } from "@/lib/utils"

const LABEL = "tax.accountingperiod"
const AUDIT_TYPE = "tax_period" as const

/**
 * Ficha documental de Período Contable (ADR-0083, component-document-sheet.md).
 * Modo VISTA: usa DocumentDrawerShell con tabs Resumen · Relaciones,
 * ciclo de vida, actions menu e ActivitySidebar.
 */
export interface AccountingPeriodSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    onActionSuccess?: () => void
}

export function AccountingPeriodSheet({ id, open, onOpenChange, embedded = false, onActionSuccess }: AccountingPeriodSheetProps) {
    const { taxPeriod: period, isLoading: loading, isError, refetch } = useTaxPeriod(id ?? undefined)
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
    const displayId = period?.id ?? `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", period, { overrideTitle: `Período ${period?.month_display || period?.id || id}` })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (period?.id && displayId) setEntityDisplay(LABEL, period.id, String(displayId))
    }, [period?.id, displayId, setEntityDisplay])

    // No actions registry for accounting period yet
    const resolved: ResolvedDocumentAction<TaxPeriodDetail>[] = []

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<TaxPeriodDetail>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {},
    })

    const primary = null
    const secondary = resolved

    const lifecycleSteps = period ? getAccountingPeriodLifecycle(period) : null

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "treasury", "accounting"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = period ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <AccountingPeriodSummaryTab period={period} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={period.id}
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
            {period && (
                <PrintableLayout
                    ref={printRef}
                    title="Período Contable"
                    displayId={period.month_display ?? String(displayId)}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Mes:</span><span>{period.month_display}</span></div>
                        <div className="flex justify-between"><span>Año:</span><span>{period.year}</span></div>
                        <div className="flex justify-between"><span>Estado:</span><span>{period.status}</span></div>
                        <div className="flex justify-between"><span>Período Tributario:</span><span>{period.tax_period_display || "—"}</span></div>
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
                headerActions={period && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={secondary.map(toItem)}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!period && !isError)}
                error={isError ? new Error("No se pudo cargar el período") : undefined}
                loadingLabel="Cargando período contable"
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
                sidebar={period && !embedded ? <ActivitySidebar entityType={AUDIT_TYPE} entityId={period.id} /> : undefined}
            />
        </>
    )
}

function AccountingPeriodSummaryTab({ period }: { period: TaxPeriodDetail }) {
    const contextFields: DocumentField[] = [
        {
            label: "Mes",
            value: period.month_display,
        },
        {
            label: "Año",
            value: period.year,
        },
        {
            label: "Estado",
            value: <StatusBadge status={period.status} variant="badge" />,
        },
        {
            label: "Período Tributario",
            value: period.tax_period_display || "—",
        },
        {
            label: "Fecha Inicio",
            value: period.start_date ? format(toDate(period.start_date), "dd/MM/yyyy") : "—",
        },
        {
            label: "Fecha Fin",
            value: period.end_date ? format(toDate(period.end_date), "dd/MM/yyyy") : "—",
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

function getAccountingPeriodLifecycle(period: TaxPeriodDetail): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (period.status === "CLOSED") {
        steps.push({ id: "closed", label: "Cerrado", icon: FileText, status: "success" })
    } else if (period.status === "OPEN") {
        steps.push({ id: "closed", label: "Cerrar", icon: FileText, status: "active" })
    } else {
        steps.push({ id: "closed", label: "Cerrar", icon: FileText, status: "neutral" })
    }

    return steps
}

function getSectionActions(resolved: ResolvedDocumentAction<TaxPeriodDetail>[]): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
    return {}
}

function getRowActions(): (link: DocumentLink) => DocumentActionItem[] {
    return function(_link: DocumentLink): DocumentActionItem[] { return [] }
}