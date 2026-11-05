"use client"

import { useEffect, useState } from "react"
import { Activity, Download, FileText, Link2, ListChecks, Trash2 } from "lucide-react"
import { useGlobalModalActions, useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    ActionConfirmModal,
    DocumentDrawerShell,
    DocumentActionsMenu,
    DocumentLifecycle,
    DocumentFieldGrid,
    StatusBadge,
    type DocumentActionItem,
    type DocumentField,
    type DocumentSheetTab,
    type LifecycleStep,
} from "@/components/shared"
import { EntitySidebar } from "@/features/comments"
import {
    StatementDetailPanel,
    canDeleteStatement,
    canReconcileStatement,
    deleteBlockedReason,
    useDeleteStatementMutation,
    useDownloadStatementFile,
} from "@/features/finance"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout } from "@/features/_shared"
import { useDocumentRelations } from "@/features/documents/hooks/useDocumentRelations"
import type { DocumentDomain } from "@/features/documents/types"
import { DocumentRelationsTab } from "@/features/documents/components/DocumentRelationsTab"
import { formatCurrency } from "@/lib/money"
import { format } from "date-fns"
import { toDate } from "@/lib/utils"
import { useBankStatement, type BankStatementData } from "@/features/treasury/hooks/useBankStatement"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"

const LABEL = "treasury.bankstatement"
const AUDIT_TYPE = "bankstatement" as const

/**
 * Ficha documental de la cartola bancaria (ADR-0083, component-document-sheet.md), abierta como pestaña
 * del espacio de trabajo (`openEntity`). Tabs: Resumen · Líneas · Relaciones. Rail: comentarios y actividad.
 * Acciones: reconciliar (mesa en otra pestaña), eliminar un borrador sin trabajo y descarga del original.
 */
export interface BankStatementSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    /** Tras eliminar la cartola: la pestaña que la muestra se cierra. */
    onActionSuccess?: () => void
}

export function BankStatementSheet({ id, open, onOpenChange, embedded = false, onActionSuccess }: BankStatementSheetProps) {
    const { statement, isLoading: loading, isError, refetch } = useBankStatement(id ?? null)
    const { data: relations } = useDocumentRelations(LABEL, id ?? null)
    const invalidateDocuments = useInvalidateDocuments()
    const { openWorkbench } = useGlobalModalActions()
    const deleteMutation = useDeleteStatementMutation()
    const { mutate: downloadFile } = useDownloadStatementFile()

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = statement?.display_id ?? `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", statement, { overrideTitle: displayId })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (statement?.id && displayId) setEntityDisplay(LABEL, statement.id, String(displayId))
    }, [statement?.id, displayId, setEntityDisplay])

    const canReconcile = !!statement && canReconcileStatement({ state: statement.status, reconciliation_progress: statement.reconciliation_progress })
    const canDelete = !!statement && canDeleteStatement({ state: statement.status, touched_lines: statement.touched_lines ?? 0 })
    const deniedDelete = statement ? deleteBlockedReason({ state: statement.status, touched_lines: statement.touched_lines ?? 0 }) : null

    const actions: DocumentActionItem[] = statement ? [
        {
            id: "reconcile",
            label: "Reconciliar",
            icon: Activity,
            onClick: () => openWorkbench(statement.id, statement.display_id),
            disabled: !canReconcile,
            disabledReason: canReconcile ? undefined : "La cartola ya está confirmada o conciliada al 100 %.",
        },
        {
            id: "download",
            label: "Descargar original",
            icon: Download,
            onClick: () => downloadFile({ statementId: statement.id, fileName: statement.file_name ?? statement.display_id }),
            disabled: !statement.has_file,
            disabledReason: statement.has_file ? undefined : "La cartola no tiene archivo original.",
        },
        {
            id: "delete",
            label: "Eliminar",
            icon: Trash2,
            onClick: () => setDeleteOpen(true),
            disabled: !canDelete,
            disabledReason: deniedDelete ?? undefined,
            destructive: true,
        },
    ] : []

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "treasury", "accounting"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const lifecycleSteps = statement ? getBankStatementLifecycle(statement) : null

    const tabs: DocumentSheetTab[] = statement ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <BankStatementSummaryTab statement={statement} /> },
        {
            value: "lines", label: "Líneas", icon: ListChecks, badge: statement.total_lines,
            content: <StatementDetailPanel statementId={statement.id} detailOnly />,
        },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={statement.id}
                    sectionActions={{}}
                    rowActions={() => []}
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
                        <div className="flex justify-between"><span>Fecha:</span><span>{statement.statement_date ? format(toDate(statement.statement_date), "dd/MM/yyyy") : "-"}</span></div>
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
                        primary={null}
                        actions={actions}
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
                sidebar={statement ? <EntitySidebar entityType={AUDIT_TYPE} entityId={statement.id} /> : undefined}
            />

            <ActionConfirmModal
                open={deleteOpen}
                onOpenChange={(next) => { if (!next) setDeleteOpen(false) }}
                onConfirm={async () => {
                    if (!statement) return
                    await deleteMutation.mutateAsync(statement.id)
                    setDeleteOpen(false)
                    onActionSuccess?.()
                }}
                title={`Eliminar ${displayId}`}
                description="Se eliminará el borrador, sus líneas y el archivo original importado. No se puede deshacer."
                variant="destructive"
                confirmText="Eliminar"
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
        {
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
        },
        {
            label: "Fecha",
            value: statement.statement_date ? format(toDate(statement.statement_date), "dd/MM/yyyy") : "—",
        },
        {
            label: "Importada",
            value: `${format(new Date(statement.imported_at), "dd/MM/yyyy HH:mm")} · ${statement.imported_by_name}`,
        },
        {
            label: "Archivo original",
            value: statement.has_file ? (statement.file_name ?? "Disponible") : "Sin archivo",
        },
    ]

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>
            {statement.notes ? (
                <section aria-label="Notas" className="space-y-1">
                    <h3 className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Notas</h3>
                    <p className="whitespace-pre-line text-xs text-foreground">{statement.notes}</p>
                </section>
            ) : null}
        </div>
    )
}

function getBankStatementLifecycle(statement: BankStatementData): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (statement.status === "CONFIRMED") {
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
