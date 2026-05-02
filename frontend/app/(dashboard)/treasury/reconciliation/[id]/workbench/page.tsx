"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, CheckCircle2, Info } from "lucide-react"
import api from "@/lib/api"
import { ReconciliationPanel } from "@/features/treasury"
import { DataCell } from "@/components/ui/data-table-cells"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { TableSkeleton } from "@/components/shared/TableSkeleton"
import { ReconciliationBreadcrumbs } from "@/features/finance/bank-reconciliation/components"
import { toast } from "sonner"

interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    treasury_account: number
    state: string
    state_display: string
}

export default function ReconciliationWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const statementId = parseInt(id)

    const [statement, setStatement] = useState<BankStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [confirming, setConfirming] = useState(false)

    useEffect(() => {
        if (statementId) {
            fetchStatement()
        }
    }, [statementId])

    const fetchStatement = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/treasury/statements/${statementId}/`)
            setStatement(response.data)
        } catch (error) {
            console.error('Error fetching statement:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleComplete = async () => {
        await fetchStatement()
    }

    const confirmAction = useConfirmAction(async () => {
        try {
            setConfirming(true)
            await api.post(`/treasury/statements/${statementId}/confirm/`)
            toast.success('Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: unknown) {
            console.error('Error confirming statement:', error)
            showApiError(error, 'Error al confirmar cartola')
        } finally {
            setConfirming(false)
        }
    })

    const handleConfirmStatement = () => confirmAction.requestConfirm()

    if (loading) return (
        <div className="flex-1 p-8 pt-6">
            <TableSkeleton rows={12} columns={5} />
        </div>
    )

    if (!statement) {
        return (
            <div className="flex-1 p-8 pt-6">
                <Card className="max-w-md mx-auto mt-12 bg-destructive/10 border-destructive/20">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">No pudimos localizar la cartola #{id}. Por favor verifica el enlace.</p>
                        <Button onClick={() => router.push('/treasury/reconciliation')} variant="outline" className="mt-6 w-full font-bold">
                            Volver al listado
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const canConfirm = statement.reconciliation_progress === 100

    return (
        <div className="flex-1 space-y-4 p-6 pt-4 bg-muted/20 min-h-screen">
            <ReconciliationBreadcrumbs statementId={statementId} statementDisplayId={statement.display_id} isWorkbench />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-sm shadow-sm h-8 w-8"
                        onClick={() => router.push(`/treasury/reconciliation/${statementId}`)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold tracking-tighter uppercase text-foreground/80">
                                Conciliación
                            </h2>
                            <DataCell.Badge variant="secondary" className="bg-primary/10 text-primary border-none font-mono font-black px-2 text-xs">
                                {statement.display_id}
                            </DataCell.Badge>
                            <span className="text-xs text-muted-foreground font-medium hidden md:inline">— {statement.treasury_account_name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canConfirm && (
                        <Button
                            onClick={handleConfirmStatement}
                            disabled={confirming}
                            className="bg-success hover:bg-success/90 shadow-sm px-5 font-bold text-sm"
                        >
                            {confirming ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finalizando...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar Cartola</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Core Matching Engine (Panel) */}
            <ReconciliationPanel
                statementId={statementId}
                treasuryAccountId={statement.treasury_account}
                onComplete={handleComplete}
            />

            <ActionConfirmModal
                open={confirmAction.isOpen}
                onOpenChange={(open) => { if (!open) confirmAction.cancel() }}
                onConfirm={confirmAction.confirm}
                title="Confirmar Cartola"
                description="¿Está seguro de confirmar esta cartola? Esto validará todas las conciliaciones, actualizará los saldos de la cuenta y bloqueará la cartola para futuras modificaciones."
                confirmText="Confirmar"
            />
        </div>
    )
}
