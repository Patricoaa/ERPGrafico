"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, CheckCircle2, Info, GraduationCap } from "lucide-react"
import api from "@/lib/api"
import { ReconciliationPanel } from "@/features/treasury"
import { DataCell } from "@/components/ui/data-table-cells"
import { Progress } from "@/components/ui/progress"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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

export default function ReconciliationMatchPage({ params }: { params: Promise<{ id: string }> }) {
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
            alert('✅ Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: unknown) {
            console.error('Error confirming statement:', error)
            showApiError(error, 'Error al confirmar cartola')
        } finally {
            setConfirming(false)
        }
    })

    const handleConfirmStatement = () => confirmAction.requestConfirm()

    if (loading) {
        return (
            <div className="flex-1 p-8 pt-6">
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                    <p className="text-muted-foreground text-sm font-medium">Preparando entorno de reconciliación...</p>
                </div>
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 p-8 pt-6">
                <Card className="max-w-md mx-auto mt-12 bg-destructive/10/50 border-destructive/10">
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
        <div className="flex-1 space-y-6 p-8 pt-6 bg-muted/20 min-h-screen">
            {/* Header Area */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full shadow-sm"
                            onClick={() => router.push(`/treasury/reconciliation/${statementId}`)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold tracking-tight text-foreground/80">
                                    Motor de Reconciliación
                                </h2>
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold px-3">
                                    {statement.display_id}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">{statement.treasury_account_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-3 mr-4 text-right">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Sincronización</p>
                                <p className="text-xs font-black text-foreground/70">{statement.reconciled_lines} de {statement.total_lines} líneas procesadas</p>
                            </div>
                        </div>
                        {canConfirm && (
                            <Button
                                onClick={handleConfirmStatement}
                                disabled={confirming}
                                className="bg-success hover:bg-success shadow-lg shadow-emerald-600/20 px-6 font-bold"
                            >
                                {confirming ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Finalizando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Confirmar Cartola
                                    </>
                                )}
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                            <GraduationCap className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Global Progress Header Tooltip-like Area */}
                <div className="bg-card p-5 rounded-2xl border shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Flujo de conciliación en tiempo real</span>
                        </div>
                        <span className="text-sm font-black text-primary font-mono">{statement.reconciliation_progress}%</span>
                    </div>
                    <Progress value={statement.reconciliation_progress} className="h-2 bg-muted overflow-hidden" />
                </div>
            </div>

            {/* Core Matching Engine (Panel) */}
            <ReconciliationPanel
                statementId={statementId}
                treasuryAccountId={statement.treasury_account}
                onComplete={handleComplete}
            />

            {/* Context Help Footer */}
            {!canConfirm && (
                <div className="flex items-center justify-center p-8 opacity-40 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white px-4 py-2 rounded-full border shadow-sm">
                        <Info className="h-3.5 w-3.5" />
                        Para confirmar la cartola, debes reconciliar o excluir el 100% de las transacciones.
                    </div>
                </div>
            )}
            
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
