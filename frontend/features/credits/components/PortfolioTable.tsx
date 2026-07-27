"use client"

import { useState, useMemo, useEffect } from "react"
import {
    getContactCreditLedger,
    writeOffSaleOrder,
    type CreditContact,
    type CreditLedgerEntry,
} from '@/features/credits/api/creditsApi'
import { toast } from "sonner"
import {
    ShieldAlert, Gavel
} from "lucide-react"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { SkeletonShell, ActionConfirmModal, DataCell, MoneyDisplay } from "@/components/shared"
import { DataTable, createExpanderColumn } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { formatMoney } from "@/lib/money"

const agingLabel: Record<string, string> = {
    current: "Al día",
    overdue_30: "1-30 días",
    overdue_60: "31-60 días",
    overdue_90: "61-90 días",
    overdue_90plus: "+90 días"
}

function PortfolioContactPanel({ contact, onRefresh }: { contact: CreditContact, onRefresh: () => void }) {
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)

    const isDefault = contact.is_default_customer
    const [writingOffDocId, setWritingOffDocId] = useState<number | null>(null)
    const [showWriteOffDocDialog, setShowWriteOffDocDialog] = useState<{ id: number, number: string, balance: number } | null>(null)

    // Lazy load ledger on first expansion
    useEffect(() => {
        if (ledger === null && !loadingLedger) {
            requestAnimationFrame(() => {
                setLoadingLedger(true)
                getContactCreditLedger(contact.id)
                    .then(setLedger)
                    .catch(() => {
                        toast.error("Error al cargar historial de documentos")
                        setLedger([])
                    })
                    .finally(() => setLoadingLedger(false))
            })
        }
    }, [ledger, loadingLedger, contact.id])

    const handleWriteOffDoc = async (saleOrderId: number) => {
        setWritingOffDocId(saleOrderId)
        try {
            const res = await writeOffSaleOrder(saleOrderId)
            toast.success(`Documento castigado: ${res.journal_entry} por ${formatMoney(res.amount)}`)
            setLedger(null)
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } }; message?: string }
            const errorMsg = e.response?.data?.error || e.message || "Error al castigar documento"
            toast.error(errorMsg)
        } finally {
            setWritingOffDocId(null)
            setShowWriteOffDocDialog(null)
        }
    }

    const ledgerColumns = useMemo<ColumnDef<CreditLedgerEntry>[]>(() => [
        {
            id: "document",
            header: "N° Documento",
            cell: ({ row }) => <DataCell.Entity entityLabel="sales.saleorder" data={row.original as unknown as Record<string, unknown>} />
        },
        {
            id: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />
        },
        {
            id: "due_date",
            header: "Vencimiento",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 w-full">
                    <DataCell.Date value={row.original.due_date} />
                    {row.original.days_overdue > 0 && (
                        <span className="text-destructive font-bold text-[11px]">({row.original.days_overdue}d)</span>
                    )}
                </div>
            )
        },
        {
            id: "total",
            header: "Total",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.effective_total} />
        },
        {
            id: "paid",
            header: "Pagado",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.paid_amount} className="text-success font-medium" />
        },
        {
            id: "balance",
            header: "Saldo",
            meta: { align: "right" },
            cell: ({ row }) => <DataCell.Currency value={row.original.balance} className="font-bold" />
        },
        {
            id: "origin",
            header: "Origen",
            cell: ({ row }) => row.original.credit_assignment_origin_display ? (
                <DataCell.Chip
                    intent={row.original.credit_assignment_origin === "MANUAL" ? "neutral" : row.original.credit_assignment_origin === "SALE" ? "info" : "warning"}
                    size="xs"
                    className="w-fit"
                >
                    {row.original.credit_assignment_origin_display}
                </DataCell.Chip>
            ) : <span className="text-muted-foreground/30">—</span>
        },
        {
            id: "status",
            header: "Estado",
            cell: ({ row }) => (
                <DataCell.Status
                    status={row.original.aging_bucket === 'current' ? 'SUCCESS' : (row.original.days_overdue > 60 ? 'ERROR' : 'WARNING')}
                    label={agingLabel[row.original.aging_bucket]}
                />
            )
        },
        {
            id: "actions",
            header: "",
            meta: { align: "right" },
            cell: ({ row }) => {
                const entry = row.original
                if (writingOffDocId === entry.id) return null
                if (isDefault && Number(entry.balance) > 0) {
                    return (
                        <DataCell.Action
                            icon={Gavel}
                            title="Castigar Documento"
                            className="text-destructive"
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowWriteOffDocDialog({ id: entry.id, number: entry.number, balance: Number(entry.balance) })
                            }}
                        />
                    )
                }
                return <span className="text-muted-foreground/30">—</span>
            }
        }
    ], [isDefault, writingOffDocId])

    return (
        <>
            {loadingLedger ? (
                <SkeletonShell isLoading ariaLabel="Cargando..." />
            ) : ledger && ledger.length > 0 ? (
                <DataTable
                    variant="minimal"
                    columns={ledgerColumns}
                    data={ledger}
                    noBorder
                />
            ) : (
                <p className="text-[12px] text-muted-foreground italic text-center py-4">Sin documentos pendientes.</p>
            )}

            <ActionConfirmModal
                open={!!showWriteOffDocDialog}
                onOpenChange={(o) => !o && setShowWriteOffDocDialog(null)}
                onConfirm={() => showWriteOffDocDialog ? handleWriteOffDoc(showWriteOffDocDialog.id) : undefined}
                title={`¿Castigar Documento ${formatEntityDisplay('sales.saleorder', { number: showWriteOffDocDialog?.number })}?`}
                description={
                    <div className="space-y-3 pt-1 text-sm leading-relaxed">
                        <p>Se castigará el saldo pendiente de <strong><MoneyDisplay amount={showWriteOffDocDialog?.balance} inline /></strong> para este documento.</p>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />
        </>
    )
}

export function PortfolioTable({
    columns,
    data,
    isLoading,
    onRefresh,
    createAction,
    unifiedSearch,
}: {
    columns: ColumnDef<CreditContact>[],
    data: CreditContact[],
    isLoading: boolean,
    onRefresh: () => void,
    createAction?: React.ReactNode,
    unifiedSearch?: React.ReactNode,
}) {
    const columnsWithExpander = useMemo<ColumnDef<CreditContact>[]>(() => [
        createExpanderColumn<CreditContact>(),
        ...columns,
    ], [columns])

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columnsWithExpander}
                    data={data}
                    variant="embedded"
                    isLoading={isLoading}
                    renderSubComponent={(row) => (
                        <PortfolioContactPanel contact={row.original} onRefresh={onRefresh} />
                    )}
                    emptyState={{
                        context: "finance",
                        title: "No hay clientes con crédito",
                        description: "Habilite cupos de crédito para sus clientes para comenzar el seguimiento.",
                    }}
                    createAction={createAction}
                    unifiedSearch={unifiedSearch}
                />
            </div>
        </div>
    )
}
