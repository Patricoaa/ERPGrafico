"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2 } from "lucide-react"
import { useStatementQuery } from "@/features/finance"
import { ReconciliationPanel } from "@/features/treasury"
import { ActionConfirmModal } from '@/components/shared'
import { BankPageHeader } from "@/features/treasury"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import api from "@/lib/api"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { SkeletonShell } from "@/components/shared"

export default function BankWorkbenchPage({
    params,
}: {
    params: Promise<{ bankId: string; statementId: string }>
}) {
    const { bankId, statementId } = use(params)
    const bankIdNum = Number(bankId)
    const statementIdNum = parseInt(statementId)
    const router = useRouter()

    const reconciliationBase = `/treasury/centro-bancos/${bankId}/reconciliation`
    const { data: statement, isLoading, refetch } = useStatementQuery(statementIdNum)

    const confirmAction = useConfirmAction(async () => {
        try {
            await api.post(`/treasury/statements/${statementIdNum}/confirm/`)
            toast.success('Cartola confirmada exitosamente')
            router.push(reconciliationBase)
        } catch (error: unknown) {
            showApiError(error, 'Error al confirmar cartola')
        }
    })

    if (isLoading) return <div className="flex-1"><SkeletonShell isLoading ariaLabel="Cargando..." /></div>

    if (!statement) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <p className="text-muted-foreground">No se encontró la cartola.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 pt-2 h-full flex flex-col">
            <BankPageHeader
                bankId={bankIdNum}
                title="Mesa de Conciliación"
                description={`${statement.display_id} — ${statement.treasury_account_name}`}
                status={{ label: statement.state_display || statement.state, type: statement.state === 'CONFIRMED' ? 'synced' : 'info' }}
                breadcrumbs={[
                    { label: "Conciliación", href: reconciliationBase },
                    { label: statement.display_id, href: `${reconciliationBase}/${statement.id}` },
                    { label: "Mesa de Conciliación" },
                ]}
                titleActions={
                    statement.reconciliation_progress === 100 && statement.state !== 'CONFIRMED' ? (
                        <Button
                            onClick={() => confirmAction.requestConfirm()}
                            disabled={confirmAction.isConfirming}
                            className="bg-success hover:bg-success/90 shadow-sm px-5 font-bold text-sm"
                        >
                            {confirmAction.isConfirming ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finalizando...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar Cartola</>
                            )}
                        </Button>
                    ) : undefined
                }
            />

            <ReconciliationPanel
                statementId={statement.id}
                treasuryAccountId={(statement as any).treasury_account || (statement as any).treasury_account_id || 0}
                onComplete={() => refetch()}
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
