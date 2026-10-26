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
import { formatCurrency } from "@/lib/money"
import { format } from "date-fns"
import { toDate } from "@/lib/utils"
import { useBankStatement, type BankStatementData } from "@/features/treasury/hooks/useBankStatement"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { useAuth } from "@/contexts/AuthContext"
import { showApiError } from "@/lib/errors"

const LABEL = "treasury.bankstatement"
const AUDIT_TYPE = "bankstatement" as const

/**
 * Ficha documental de Cartola Bancaria (ADR-0083, component-document-sheet.md).
 * Modo VISTA: usa DocumentDrawerShell con tabs Resumen · Relaciones,
 * ciclo de vida, actions menu e ActivitySidebar.
 */
export interface BankStatementSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    onActionSuccess?: () => void
}

export function BankStatementSheet({ id, open, onOpenChange, embedded = false, onActionSuccess }: BankStatementSheetProps) {
    const { statement, isLoading: loading, isError, refetch } = useBankStatement(id ?? null)
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
    const displayId = statement?.display_id ?? `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", statement, { overrideTitle: displayId })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (statement?.id && displayId) setEntityDisplay(LABEL, statement.id, String(displayId))
    }, [statement?.id, displayId, setEntityDisplay])

    // No actions registry for bank statement yet
    const resolved: ResolvedDocumentAction<BankStatementData>[] = []

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<BankStatementData>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {},
    })

    const primary = null
    const secondary = resolved

    const lifecycleSteps = statement ? getBankStatementLifecycle(statement) : null

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "treasury", "accounting"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = statement ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <BankStatementSummaryTab statement={statement} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={statement.id}
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
            {statement && (
                <PrintableLayout
                    ref={printRef}
                    title="Cartola Bancaria"
                    displayId={String(displayId)}
                    subtitle={statement.treasury_account_name}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Cuenta:</span><span>{statement.treasury_account_name}</span></div>
                        <div className="flex justify-between"><span>Saldo Inicial:</span><span className="font-bold">{formatCurrency(Number(statement.opening_balance || 0))}</span></div>
                        <div className="flex justify-between"><span>Saldo Final:</span><span className="font-bold">{formatCurrency(Number(statement.closing_balance || 0))}</span></div>
                        <div className="flex justify-between"><span>Fecha:</span><span>{statement.date ? format(toDate(statement.date), "dd/MM/yyyy") : "-"}</span></div>
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
                headerActions={statement && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={secondary.map(toItem)}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!statement && !isError)}
                error={isError ? new Error("No se pudo cargar la cartola") : undefined}
                loadingLabel="Cargando cartola bancaria"
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
                // No ActivitySidebar for bank statements yet - entity type not in ActivitySidebar union
                sidebar={undefined}
            />
        </>
    )
}

function BankStatementSummaryTab({ statement }: { statement: BankStatementData }) {
    const contextFields: DocumentField[] = [
        {
            label: "Cuenta Tesorería",
            value: statement.treasury_account_name,
        },
        {
            label: "Estado",
            value: <StatusBadge status={statement.status} variant="badge" />,
        },
        {
            label: "Saldo Inicial",
            value: <span className="font-bold tabular-nums">{formatCurrency(Number(statement.opening_balance || 0))}</span>,
        },
        {
            label: "Saldo Final",
            value: <span className="font-bold tabular-nums">{formatCurrency(Number(statement.closing_balance || 0))}</span>,
        },
        ...(statement.reconciliation_progress != null ? [{
            label: "Progreso Conciliación",
            value: (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${statement.reconciliation_progress}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium tabular-nums">{statement.reconciliation_progress}%</span>
                </div>
            ),
        }] : []),
        {
            label: "Fecha",
            value: statement.date ? format(toDate(statement.date), "dd/MM/yyyy") : "—",
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

function getBankStatementLifecycle(statement: BankStatementData): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (statement.status === "CONFIRMED" || statement.status === "RECONCILED") {
        steps.push({ id: "confirmed", label: "Confirmada", icon: FileText, status: "success" })
    } else {
        steps.push({ id: "confirmed", label: "Confirmar", icon: FileText, status: "neutral" })
    }

    if (statement.reconciliation_progress === 100) {
        steps.push({ id: "reconciled", label: "Conciliada", icon: FileText, status: "success" })
    } else if (statement.status === "CONFIRMED") {
        steps.push({ id: "reconciled", label: "Conciliar", icon: FileText, status: "neutral" })
    } else {
        steps.push({ id: "reconciled", label: "Conciliar", icon: FileText, status: "not_applicable" })
    }

    return steps
}

function getSectionActions(resolved: ResolvedDocumentAction<BankStatementData>[]): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
    const result: Partial<Record<DocumentDomain, DocumentActionItem[]>> = {}
    for (const r of resolved) {
        const domain = r.category as DocumentDomain
        if (domain) {
            (result[domain] ??= []).push({
                id: r.action.id,
                label: r.action.label,
                icon: r.action.icon,
                disabled: r.disabled,
                disabledReason: r.disabledReason,
                onClick: () => {},
            })
        }
    }
    return result
}

function getRowActions(): (link: DocumentLink) => DocumentActionItem[] {
    return function(_link: DocumentLink): DocumentActionItem[] { return [] }
}