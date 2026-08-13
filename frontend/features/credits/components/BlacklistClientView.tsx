"use client"

import { formatCurrency } from "@/lib/money"

import React, { useState, useMemo, useEffect } from "react"
import {
    getContactCreditLedger,
    unblockContact,
    recoverDebt
} from '@/features/credits/api/creditsApi'
import { type CreditContact, type CreditLedgerEntry } from '@/features/credits/api/creditsApi'
import {UnifiedSearchBar, useUnifiedSearch} from '@/components/shared'
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useBlacklistedPortfolio } from "../hooks/useCredits"

import { DataTable, createExpanderColumn } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from '@/components/shared'

import { Button } from "@/components/ui/button"
import { UserCheck, DollarSign, AlertCircle } from "lucide-react"

import { toast } from "sonner"
import { SkeletonShell, ActionConfirmModal } from "@/components/shared"
import { Input } from "@/components/ui/input"

import { DataCell } from '@/components/shared'
import { blacklistFields } from "../blacklistFields"
import { creditLedgerEntryFields } from "@/features/credits/creditLedgerEntryFields"

// ─── Sub-components ──────────────────────────────────────────────────────────

function BlacklistContactPanel({ contact, onRefresh }: { contact: CreditContact, onRefresh: () => void }) {
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [loadingLedger, setLoadingLedger] = useState(false)
    const [unblocking, setUnblocking] = useState(false)
    const [recoveryAmount, setRecoveryAmount] = useState("")
    const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)

    const handleUnblock = async () => {
        setUnblocking(true)
        try {
            await unblockContact(contact.id)
            toast.success("Cliente desbloqueado correctamente.")
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
            toast.error(e.response?.data?.error || "Error al desbloquear cliente.")
        } finally {
            setUnblocking(false)
        }
    }

    const handleRecover = async () => {
        if (!recoveryAmount) return
        try {
            await recoverDebt(contact.id, recoveryAmount)
            toast.success(`Recuperación de ${formatCurrency(recoveryAmount)} registrada correctamente.`)
            setShowRecoveryDialog(false)
            setRecoveryAmount("")
            onRefresh()
            const data = await getContactCreditLedger(contact.id, true)
            setLedger(data)
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
            toast.error(e.response?.data?.error || "Error al registrar recuperación.")
        }
    }

    // Lazy load ledger on first expansion
    useEffect(() => {
        if (ledger === null && !loadingLedger) {
            requestAnimationFrame(() => {
                setLoadingLedger(true)
                getContactCreditLedger(contact.id, true)
                    .then(setLedger)
                    .catch((err) => {
                        console.error("Error fetching credit ledger:", err)
                    })
                    .finally(() => setLoadingLedger(false))
            })
        }
    }, [ledger, loadingLedger, contact.id])

    return (
        <>
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Historial de Castigos</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-destructive/20 text-destructive hover:bg-destructive/5"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowRecoveryDialog(true)
                        }}
                    >
                        <DollarSign className="h-3.5 w-3.5" />
                        Registrar Pago
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-success/20 text-success hover:bg-success/5"
                        disabled={unblocking}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleUnblock()
                        }}
                    >
                        <UserCheck className="h-3.5 w-3.5" />
                        Rehabilitar Crédito
                    </Button>
                </div>
            </div>

            {loadingLedger ? (
                <SkeletonShell isLoading ariaLabel="Cargando..." />
            ) : ledger && ledger.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-3xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/50">
                                <th className="pb-2 text-center">N° Documento</th>
                                <th className="pb-2 text-center">Fecha</th>
                                <th className="pb-2 text-center">Total</th>
                                <th className="pb-2 text-center">Pagado</th>
                                <th className="pb-2 text-center">Saldo</th>
                                <th className="pb-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {ledger.map((entry) => (
                                <tr key={entry.id} className="text-xs group">
                                    <td className="py-2 pr-4 text-center">
                                        {creditLedgerEntryFields.render('document', entry)}
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        {creditLedgerEntryFields.render('date', entry)}
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        {creditLedgerEntryFields.render('total', entry)}
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        {creditLedgerEntryFields.render('paid', entry)}
                                    </td>
                                    <td className="py-2 pr-4 text-center">
                                        {creditLedgerEntryFields.render('balance', entry)}
                                    </td>
                                    <td className="py-2 text-center">
                                        {creditLedgerEntryFields.render('status', entry)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Sin registros de deudas castigadas.</p>
            )}

            <ActionConfirmModal
                open={showRecoveryDialog}
                onOpenChange={setShowRecoveryDialog}
                onConfirm={handleRecover}
                title="Recuperación de Deuda"
                description={
                    <div className="space-y-4">
                        <p>Ingrese el monto recaudado para este cliente incobrable.</p>
                        <div className="py-2">
                            <Input
                                type="number"
                                placeholder="Ingrese monto..."
                                value={recoveryAmount}
                                onChange={(e) => setRecoveryAmount(e.target.value)}
                                className="font-mono text-lg text-foreground bg-background"
                            />
                        </div>
                    </div>
                }
                variant="default"
                confirmText="Registrar Pago"
            />
        </>
    )
}

export function BlacklistClientView() {
    const { contacts: rawContacts, isLoading: loading, refetch: fetchData } = useBlacklistedPortfolio()
    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'search', label: 'Cliente / RUT', serverParam: 'search', clientKey: ['name', 'tax_id'] },
        ],
        filters: [
            { key: 'risk_level', label: 'Riesgo', type: 'single', serverParam: 'risk_level', options: [
                { label: 'Bajo', value: 'LOW' },
                { label: 'Medio', value: 'MEDIUM' },
                { label: 'Alto', value: 'HIGH' },
                { label: 'Crítico', value: 'CRITICAL' },
            ]},
        ],
        groupBy: [
            { key: 'credit_risk_level', label: 'Riesgo', field: 'credit_risk_level' },
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const contacts = useMemo(() => {
        let result = rawContacts
        if (search.filters.risk_level) result = result.filter(c => c.credit_risk_level === search.filters.risk_level)
        return search.filterFn(result)
    }, [rawContacts, search.filterFn, search.filters.risk_level])

    const [balanceCol, evaluatedCol] = blacklistFields.toColumns()

    const columns = useMemo<ColumnDef<CreditContact>[]>(() => [
        createExpanderColumn<CreditContact>(),
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.ContactLink contactId={row.original.id}>
                    {row.original.name}
                </DataCell.ContactLink>
            ),
            meta: { title: "Cliente" },
        },
        balanceCol,
        evaluatedCol,
    ], [balanceCol, evaluatedCol])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={contacts}
                    variant="embedded"
                    isLoading={loading}
                    unifiedSearch={<UnifiedSearchBar
                        config={config}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Cliente o RUT..."
                    />}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    isFiltered={search.isFiltered}
                    renderSubComponent={(row) => (
                        <BlacklistContactPanel contact={row.original} onRefresh={fetchData} />
                    )}
                    emptyState={{
                        context: "search",
                        title: "Lista Negra Vacía",
                        description: "No hay clientes bloqueados o en historial de castigos actualmente.",
                    }}
                />
            </div>
        </div>
    )
}
