"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirmStatement } from "@/features/treasury"
import { ActionConfirmModal, Drawer, SkeletonShell, SubmitButton } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { showApiError } from "@/lib/errors"
import { formatCurrency } from "@/lib/money"
import { cn, parseDateOnly } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useStatementQuery } from "../hooks/useReconciliationQueries"
import { reconciliationKeys } from "../hooks/queryKeys"
import type { BankStatement } from "../types"
import { ReconciliationPanel } from "./ReconciliationPanel"

interface ReconciliationWorkbenchTabProps {
    statementId: number
    /** Cierra la pestaña de la mesa (sin guarda: no hay formulario que proteger). */
    onClose: () => void
    /** La cartola quedó confirmada: la pestaña ya cumplió su función. */
    onConfirmed: () => void
}

/**
 * Mesa de conciliación como pestaña del espacio de trabajo (`openWorkbench`).
 * Encabezado con el estado de la cartola y la confirmación final; el trabajo lo hace `ReconciliationPanel`.
 */
export function ReconciliationWorkbenchTab({ statementId, onClose, onConfirmed }: ReconciliationWorkbenchTabProps) {
    const queryClient = useQueryClient()
    const statementQuery = useStatementQuery(statementId)
    const statement = statementQuery.data as BankStatement | undefined
    const confirmMutation = useConfirmStatement()

    const confirmAction = useConfirmAction(async () => {
        try {
            await confirmMutation.mutateAsync(statementId)
            toast.success("Cartola confirmada exitosamente")
            await queryClient.invalidateQueries({ queryKey: reconciliationKeys.statements() })
            onConfirmed()
        } catch (error: unknown) {
            showApiError(error, "Error al confirmar cartola")
        }
    })

    // Pendiente = sin conciliar o con match sin confirmar. Las excluidas ya están resueltas.
    // Mismo criterio que el backend (confirm) más MATCHED, que debe confirmarse antes.
    const pending = statement?.lines
        ? statement.lines.filter((line) => line.reconciliation_status === "UNRECONCILED" || line.reconciliation_status === "MATCHED").length
        : null
    const canConfirm = !!statement && statement.state === "DRAFT" && pending === 0

    // Como las fichas de entidad: la pestaña ocupa el área de trabajo mediante `Drawer` (en modo
    // persistente se expande al 100 %). Un `div` suelto en la página quedaba fuera de la vista.
    return (
        <Drawer
            open
            onOpenChange={(open) => { if (!open) onClose() }}
            side="bottom"
            boundary="embedded"
            defaultSize="100%"
            resizable={false}
            title={statementTitle(statementQuery.data as BankStatement | undefined)}
            fillContent
            contentClassName="p-0"
        >
        <div className="flex h-full min-h-0 flex-col">
            <WorkbenchHeader statement={statement} loading={statementQuery.isLoading} />

            <div className="min-h-0 flex-1 overflow-hidden p-4">
                <SkeletonShell isLoading={statementQuery.isLoading} ariaLabel="Cargando mesa de conciliación">
                    {statement && (
                        <ReconciliationPanel
                            statementId={statementId}
                            treasuryAccountId={statement.treasury_account}
                            onComplete={() => { void statementQuery.refetch() }}
                        />
                    )}
                </SkeletonShell>
            </div>

            <WorkbenchFooter
                statement={statement}
                pending={pending}
                canConfirm={canConfirm}
                confirming={confirmAction.isConfirming}
                onConfirm={() => confirmAction.requestConfirm()}
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
        </Drawer>
    )
}

function statementTitle(statement: BankStatement | undefined): string {
    return statement ? `Mesa de conciliación · ${statement.display_id}` : "Mesa de conciliación"
}

function WorkbenchHeader({ statement, loading }: { statement: BankStatement | undefined; loading: boolean }) {
    const progress = statement?.reconciliation_progress ?? 0
    const period = statement?.statement_date
        ? format(parseDateOnly(statement.statement_date), "dd MMM yyyy", { locale: es })
        : null

    return (
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-semibold text-foreground">
                    {loading ? "Cargando cartola…" : statement?.treasury_account_name ?? "Cartola no disponible"}
                </p>
                <p className="font-mono text-3xs tabular-nums text-muted-foreground">
                    {statement?.display_id ?? ""}{period ? `${statement ? " · " : ""}${period}` : ""}
                </p>
            </div>

            {statement && (
                <dl className="flex items-center gap-5 text-xs">
                    <div>
                        <dt className="text-3xs uppercase tracking-wider text-muted-foreground">Saldo inicial</dt>
                        <dd className="font-mono tabular-nums text-foreground">{formatCurrency(Number(statement.opening_balance))}</dd>
                    </div>
                    <div>
                        <dt className="text-3xs uppercase tracking-wider text-muted-foreground">Saldo final</dt>
                        <dd className="font-mono tabular-nums text-foreground">{formatCurrency(Number(statement.closing_balance))}</dd>
                    </div>
                </dl>
            )}

            {statement && (
                <div className="flex w-56 flex-col gap-1.5" aria-label="Avance de la conciliación">
                    <div className="flex items-baseline justify-between text-3xs">
                        <span className="text-muted-foreground">
                            {statement.reconciled_lines} de {statement.total_lines} líneas
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">{Math.round(progress)}%</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className={cn("h-full rounded-full transition-[width] duration-300", progress >= 100 ? "bg-success" : "bg-primary")}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>
            )}

        </header>
    )
}

/** Pie de la mesa: lo que falta para confirmar y la confirmación de la cartola. */
function WorkbenchFooter({
    statement,
    pending,
    canConfirm,
    confirming,
    onConfirm,
}: {
    statement: BankStatement | undefined
    pending: number | null
    canConfirm: boolean
    confirming: boolean
    onConfirm: () => void
}) {
    if (!statement) return null
    const isDraft = statement.state === "DRAFT"
    return (
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
                {!isDraft
                    ? "Cartola confirmada"
                    : canConfirm
                        ? "Todas las líneas están conciliadas o excluidas"
                        : pending === null ? "Cargando líneas…" : `Faltan ${pending} líneas por conciliar o excluir`}
            </p>
            {isDraft && (
                <SubmitButton
                    onClick={onConfirm}
                    loading={confirming}
                    disabled={!canConfirm}
                    icon={CheckCircle2}
                    className="bg-success px-5 font-bold text-sm hover:bg-success/90"
                >
                    {confirming ? "Finalizando…" : "Confirmar cartola"}
                </SubmitButton>
            )}
        </footer>
    )
}
