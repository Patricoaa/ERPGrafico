"use client"

import { useState } from "react"
import { Gavel, ShieldAlert, DollarSign, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { Drawer, DataCell, ActionConfirmModal, MoneyDisplay, SkeletonShell } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { formatMoney } from "@/lib/money"
import {
    writeOffSaleOrder,
    unblockContact,
    recoverDebt,
    type CreditContact,
    type CreditLedgerEntry,
} from "../api/creditsApi"
import { useCreditLedger } from "../hooks/useCreditLedger"
import { creditLedgerEntryEntity, creditLedgerEntryViews } from "../entity-view/creditLedgerEntry.entity"

export interface CreditContactLedgerDrawerProps {
    contact: CreditContact | null
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: "portfolio" | "blacklist"
    onRefresh: () => void
}

export function CreditContactLedgerDrawer({
    contact,
    open,
    onOpenChange,
    mode,
    onRefresh,
}: CreditContactLedgerDrawerProps) {
    const { ledger, isLoading, refetch } = useCreditLedger(contact?.id ?? 0, {
        includeAll: mode === "blacklist",
    })

    const [writingOffDocId, setWritingOffDocId] = useState<number | null>(null)
    const [writeOffDoc, setWriteOffDoc] = useState<{ id: number; number: string; balance: number } | null>(null)
    const [unblocking, setUnblocking] = useState(false)
    const [recoveryAmount, setRecoveryAmount] = useState("")
    const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)

    const handleWriteOffDoc = async (saleOrderId: number) => {
        setWritingOffDocId(saleOrderId)
        try {
            const res = await writeOffSaleOrder(saleOrderId)
            toast.success(`Documento castigado: ${res.journal_entry} por ${formatMoney(res.amount)}`)
            refetch()
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } }; message?: string }
            toast.error(e.response?.data?.error || e.message || "Error al castigar documento")
        } finally {
            setWritingOffDocId(null)
            setWriteOffDoc(null)
        }
    }

    const handleUnblock = async () => {
        if (!contact) return
        setUnblocking(true)
        try {
            await unblockContact(contact.id)
            toast.success("Cliente desbloqueado correctamente.")
            onRefresh()
            onOpenChange(false)
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
            toast.error(e.response?.data?.error || "Error al desbloquear cliente.")
        } finally {
            setUnblocking(false)
        }
    }

    const handleRecover = async () => {
        if (!contact || !recoveryAmount) return
        try {
            await recoverDebt(contact.id, recoveryAmount)
            toast.success(`Recuperación de ${formatMoney(recoveryAmount)} registrada correctamente.`)
            setShowRecoveryDialog(false)
            setRecoveryAmount("")
            refetch()
            onRefresh()
        } catch (error) {
            const e = error as { response?: { data?: { error?: string } } }
            toast.error(e.response?.data?.error || "Error al registrar recuperación.")
        }
    }

    const isDefault = contact?.is_default_customer ?? false
    const drawerColumns = creditLedgerEntryViews.table.without(mode === "portfolio" ? "origin" : "status")

    const rowActions = mode === "portfolio"
        ? (entry: CreditLedgerEntry) => {
            if (writingOffDocId === entry.id) return null
            if (!isDefault || Number(entry.balance) <= 0) return null
            return (
                <DataCell.Action
                    icon={Gavel}
                    title="Castigar Documento"
                    className="text-destructive"
                    onClick={() => setWriteOffDoc({ id: entry.id, number: entry.number, balance: Number(entry.balance) })}
                />
            )
        }
        : undefined

    const collection = useEntityCollection(
        creditLedgerEntryEntity,
        { rows: isLoading ? [] : ledger },
        { pagination: { mode: "none" } },
    )

    return (
        <>
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                title={contact?.name ?? ""}
                subtitle={mode === "blacklist" ? "Historial de castigos e incobrables" : "Libro de créditos del cliente"}
                side="right"
                defaultSize="600px"
            >
                {mode === "blacklist" && (
                    <div className="mb-4 flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-destructive/20 text-destructive hover:bg-destructive/5"
                            onClick={() => setShowRecoveryDialog(true)}
                        >
                            <DollarSign className="h-3.5 w-3.5" />
                            Registrar Pago
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 border-success/20 text-success hover:bg-success/5"
                            disabled={unblocking}
                            onClick={handleUnblock}
                        >
                            <UserCheck className="h-3.5 w-3.5" />
                            Rehabilitar Crédito
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    <SkeletonShell isLoading ariaLabel="Cargando libro de créditos..." />
                ) : (
                    <Collection.Root collection={collection} actions={rowActions ? (entry) => rowActions(entry) : undefined}>
                        <Collection.View
                            table={drawerColumns}
                            emptyTitle="Sin documentos"
                            emptyDescription={
                                mode === "blacklist"
                                    ? "Sin registros de deudas castigadas."
                                    : "Este cliente no tiene documentos pendientes."
                            }
                        />
                    </Collection.Root>
                )}
            </Drawer>

            <ActionConfirmModal
                open={!!writeOffDoc}
                onOpenChange={(o) => !o && setWriteOffDoc(null)}
                onConfirm={() => writeOffDoc ? handleWriteOffDoc(writeOffDoc.id) : undefined}
                title={`¿Castigar Documento ${formatEntityDisplay("sales.saleorder", { number: writeOffDoc?.number })}?`}
                description={
                    <div className="space-y-3 pt-1 text-sm leading-relaxed">
                        <p>Se castigará el saldo pendiente de <strong><MoneyDisplay amount={writeOffDoc?.balance} inline weight="bold" /></strong> para este documento.</p>
                    </div>
                }
                variant="destructive"
                icon={ShieldAlert}
                confirmText="Confirmar Castigo"
            />

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
