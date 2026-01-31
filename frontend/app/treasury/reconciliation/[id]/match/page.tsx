"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import api from "@/lib/api"
import ReconciliationPanel from "@/components/treasury/ReconciliationPanel"

interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
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

    const handleConfirmStatement = async () => {
        if (!confirm('¿Confirmar extracto? Esto lo bloqueará y no podrá modificarse.')) return

        try {
            setConfirming(true)
            await api.post(`/treasury/statements/${statementId}/confirm/`)
            alert('✅ Extracto confirmado exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: any) {
            console.error('Error confirming statement:', error)
            alert(error.response?.data?.error || 'Error al confirmar extracto')
        } finally {
            setConfirming(false)
        }
    }

    if (loading) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <p className="text-red-600">Extracto no encontrado</p>
            </div>
        )
    }

    const canConfirm = statement.reconciliation_progress === 100

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/treasury/reconciliation/${statementId}`)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            Reconciliar {statement.display_id}
                        </h2>
                        <p className="text-muted-foreground">{statement.treasury_account_name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">
                        {statement.reconciled_lines} / {statement.total_lines} reconciliadas
                    </Badge>
                    {canConfirm && (
                        <Button onClick={handleConfirmStatement} disabled={confirming}>
                            {confirming ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Confirmando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Confirmar Extracto
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Progreso de Reconciliación</CardTitle>
                    <CardDescription>
                        {statement.reconciliation_progress}% completado
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${statement.reconciliation_progress === 100
                                ? 'bg-green-600'
                                : 'bg-blue-600'
                                }`}
                            style={{ width: `${statement.reconciliation_progress}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Reconciliation Panel */}
            <ReconciliationPanel
                statementId={statementId}
                onComplete={handleComplete}
            />
        </div>
    )
}
