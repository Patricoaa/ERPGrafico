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
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { useJournalEntry, usePostJournalEntry, useReverseJournalEntry, useDeleteJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import type { JournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { Chip } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { journalEntryLineEntity, journalEntryLineSheetViews } from "@/features/accounting"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { journalEntryActions } from "@/features/accounting/journalEntryActions"

const LABEL = "accounting.journalentry"
const AUDIT_TYPE = "journal_entry"

/**
 * Ficha documental de Asiento Contable (ADR-0083, component-document-sheet.md).
 * Modo VISTA: usa DocumentDrawerShell con tabs Resumen · Relaciones,
 * ciclo de vida, actions menu e ActivitySidebar.
 */
export interface JournalEntrySheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    onActionSuccess?: () => void
    /** Lado del drawer para drilldown: "left" | "right". Default: "left". */
    side?: "left" | "right"
}

export function JournalEntrySheet({ id, open, onOpenChange, embedded = false, onActionSuccess, side = "left" }: JournalEntrySheetProps) {
    const { data: journalEntry, isLoading: loading, isError, refetch: fetchEntryDetails } = useJournalEntry(id ?? undefined)
    const { data: relations } = useDocumentRelations(LABEL, id)
    const invalidateDocuments = useInvalidateDocuments()

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const handleSuccess = () => {
        void fetchEntryDetails()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const { postEntry, isPostingEntry } = usePostJournalEntry({ onSuccess: handleSuccess })
    const { reverseEntry, isReversingEntry } = useReverseJournalEntry({ onSuccess: handleSuccess })
    const { deleteEntry, isDeletingEntry } = useDeleteJournalEntry({ onSuccess: handleSuccess })

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = journalEntry?.display_id ?? journalEntry?.number
    const identity = useDrawerIdentity(LABEL, "view", journalEntry, { overrideTitle: displayId ?? "Asiento Contable" })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (journalEntry?.id && displayId) setEntityDisplay(LABEL, journalEntry.id, String(displayId))
    }, [journalEntry?.id, displayId, setEntityDisplay])

    const resolved = resolveRegistryActions(journalEntryActions, journalEntry, [], (actionId) => {
        if (actionId === "post-entry") return journalEntry?.status !== "DRAFT"
        if (actionId === "reverse-entry") return journalEntry?.status !== "POSTED"
        if (actionId === "delete-entry") return journalEntry?.status !== "DRAFT"
        return false
    })

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<JournalEntry>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {
            if (action.id === "post-entry") postEntry(journalEntry!.id)
            else if (action.id === "reverse-entry") reverseEntry(journalEntry!.id)
            else if (action.id === "delete-entry") deleteEntry(journalEntry!.id)
        },
    })

    const primary = resolved.find((r) => r.action.id === "post-entry" && !r.disabled) ?? null
    const secondary = resolved.filter((r) => r.action.id !== "post-entry" && r.action.id !== "delete-entry")
    const destructive = resolved.find((r) => r.action.id === "delete-entry") ?? null

    const lifecycleSteps = journalEntry ? getJournalEntryLifecycle(journalEntry) : null

    const lines = journalEntry?.items ?? []

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "accounting", "treasury"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = journalEntry ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <JournalEntrySummaryTab entry={journalEntry} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={journalEntry.id}
                    sectionActions={getSectionActions(resolved, journalEntry.id, postEntry)}
                    rowActions={getRowActions()}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <>
            {journalEntry && (
                <PrintableLayout
                    ref={printRef}
                    title="Asiento Contable"
                    displayId={String(displayId ?? "")}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Descripción:</span><span>{journalEntry.description || "-"}</span></div>
                        {journalEntry.source_document && (
                            <div className="flex justify-between"><span>Documento origen:</span><span>{journalEntry.source_document.display_id}</span></div>
                        )}
                        <div className="flex justify-between"><span>Tipo:</span><span>{journalEntry.is_manual ? "Manual" : journalEntry.reversal_of ? "Reversión" : "Automático"}</span></div>
                        <div className="flex justify-between"><span>Fecha:</span><span>{journalEntry.date ? format(toDate(journalEntry.date), "dd/MM/yyyy") : "-"}</span></div>
                    </div>
                    <div className="text-4xs">
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-b mb-1 pb-1">
                            <span>Cuenta</span>
                            <span className="text-right">Debe</span>
                            <span className="text-right">Haber</span>
                        </div>
                        {lines.map((item, idx) => (
                            <div key={item.id ?? idx} className="grid grid-cols-[1fr,50px,50px] gap-1 border-b border-dashed py-0.5">
                                <span>{item.account_code} · {item.account_name}</span>
                                <span className="text-right">{item.debit > 0 ? formatCurrency(item.debit) : "-"}</span>
                                <span className="text-right">{item.credit > 0 ? formatCurrency(item.credit) : "-"}</span>
                            </div>
                        ))}
                        <div className="grid grid-cols-[1fr,50px,50px] gap-1 font-bold border-t mt-1 pt-1">
                            <span>Total</span>
                            <span className="text-right">{formatCurrency(lines.reduce((sum, l) => sum + (l.debit || 0), 0))}</span>
                            <span className="text-right">{formatCurrency(lines.reduce((sum, l) => sum + (l.credit || 0), 0))}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                side={side}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={journalEntry && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={[
                            ...secondary.map(toItem),
                            ...(destructive ? [toItem(destructive)] : []),
                        ]}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!journalEntry && !isError)}
                error={isError ? new Error("No se pudo cargar el asiento") : undefined}
                loadingLabel="Cargando asiento contable"
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
                sidebar={journalEntry && !embedded ? <ActivitySidebar entityType={AUDIT_TYPE} entityId={journalEntry.id} /> : undefined}
            />
        </>
    )
}

function JournalEntrySummaryTab({ entry }: { entry: JournalEntry }) {
    const lines = entry.items ?? []

    const totalDebit = lines.reduce((sum: number, l: typeof lines[0]) => sum + (l.debit || 0), 0)
    const totalCredit = lines.reduce((sum: number, l: typeof lines[0]) => sum + (l.credit || 0), 0)

    const contextFields: DocumentField[] = [
        {
            label: "Tipo",
            value: <Chip size="xs" intent={entry.is_manual ? "neutral" : entry.reversal_of ? "warning" : "info"}>{entry.is_manual ? "Manual" : entry.reversal_of ? "Reversión" : "Automático"}</Chip>,
        },
        {
            label: "Fecha",
            value: entry.date ? format(toDate(entry.date), "dd/MM/yyyy") : "—",
        },
        ...(entry.reversal_of ? [{
            label: "Reversión de",
            value: (
                <a href={`/accounting/entries/${entry.reversal_of.id}`} className="text-primary underline hover:text-primary/80">
                    {entry.reversal_of.display_id}
                </a>
            ),
        }] : []),
    ]

    const collection = useEntityCollection(
        journalEntryLineEntity,
        { rows: lines },
        { pagination: { mode: "none" } },
    )

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>

            <section className="space-y-4">
                <FormSection title="Líneas del Asiento" icon={FileText} />
                <Collection.Root collection={collection}>
                    <Collection.View
                        table={journalEntryLineSheetViews.table}
                        emptyTitle="Sin líneas"
                        emptyDescription="El asiento no tiene líneas."
                    />
                </Collection.Root>
                <div className="flex justify-end gap-4 pt-2 border-t text-sm font-semibold tabular-nums">
                    <div>Total Debe: {formatCurrency(totalDebit)}</div>
                    <div>Total Haber: {formatCurrency(totalCredit)}</div>
                </div>
            </section>
        </div>
    )
}

function getJournalEntryLifecycle(entry: JournalEntry): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (entry.is_manual) {
        steps.push({ id: "draft", label: "Borrador", icon: FileText, status: "active" })
    } else {
        steps.push({ id: "auto", label: "Generado", icon: FileText, status: "success" })
    }

    if (entry.status === "POSTED" || entry.status === "CLOSED" || entry.status === "REVERSAL") {
        steps.push({ id: "posted", label: "Publicado", icon: FileText, status: "success" })
    } else {
        steps.push({ id: "posted", label: "Publicar", icon: FileText, status: "neutral" })
    }

    if (entry.status === "CLOSED") {
        steps.push({ id: "closed", label: "Cerrado", icon: FileText, status: "success" })
    } else if (entry.status === "REVERSAL") {
        steps.push({ id: "reversal", label: "Reversión", icon: FileText, status: "destructive" })
    } else if (entry.status === "POSTED") {
        steps.push({ id: "closed", label: "Cerrar periodo", icon: FileText, status: "neutral" })
    }

    return steps
}

function getSectionActions(
    resolved: ResolvedDocumentAction<JournalEntry>[],
    entryId: number,
    postEntry: (id: number) => Promise<void>
): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
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
                onClick: () => {
                    if (r.action.id === "post-entry") postEntry(entryId)
                },
            })
        }
    }
    return result
}

function getRowActions(): (link: DocumentLink) => DocumentActionItem[] {
    return () => []
}