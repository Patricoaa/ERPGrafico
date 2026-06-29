"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2 } from "lucide-react"
import { useStatementQuery } from "@/features/finance"
import { ReconciliationPanel } from "@/features/finance"
import { useConfirmStatement } from "@/features/treasury"
import { ActionConfirmModal, PageHeader } from '@/components/shared'
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { SkeletonShell } from "@/components/shared"

export default function WorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()

    const statementId = parseInt(id)
    const { data: statement, isLoading, refetch } = useStatementQuery(statementId)

    const confirmMutation = useConfirmStatement()
    const confirmAction = useConfirmAction(async () => {
        try {
            await confirmMutation.mutateAsync(statementId)
            toast.success('Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: unknown) {
            console.error('Error confirming statement:', error)
            showApiError(error, 'Error al confirmar cartola')
        }
    })

    if (isLoading) {
        return (
            <div className="flex-1">
                <SkeletonShell isLoading ariaLabel="Cargando..." />
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <p className="text-muted-foreground">No se encontró la cartola.</p>
            </div>
        )
    }

    const navigation = {
        moduleName: "Tesorería",
        moduleHref: "/treasury",
        tabs: [
            { value: "operaciones", label: "Operaciones", iconName: "banknote", href: "/treasury/operaciones/movements" },
            { value: "bank-center", label: "Centro de Bancos", iconName: "landmark", href: "/treasury/bank-center" },
            { value: "terminal-cobro", label: "Terminal de Cobro", iconName: "cpu", href: "/treasury/terminal-cobro/providers" },
        ],
        activeValue: "bank-center",
        breadcrumbs: [
            { label: statement.display_id, href: `/treasury/reconciliation/${statement.id}` },
            { label: "Mesa de Conciliación" }
        ]
    }

    return (
        <div className="h-full flex flex-col">
            <PageHeader
                title="Mesa de Conciliación"
                description={`${statement.display_id} — ${statement.treasury_account_name}`}
                variant="minimal"
                navigation={navigation}
                status={{
                    label: statement.state_display || statement.state,
                    type: statement.state === 'CONFIRMED' ? 'synced' : 'info'
                }}
                titleActions={
                    statement.reconciliation_progress === 100 && statement.state !== 'CONFIRMED' && (
                        <Button
                            onClick={() => confirmAction.requestConfirm()}
                            disabled={confirmAction.isConfirming}
                            className="bg-success hover:bg-success/90 shadow-card px-5 font-bold text-sm"
                        >
                            {confirmAction.isConfirming ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finalizando...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar Cartola</>
                            )}
                        </Button>
                    )
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
