"use client"

import { Drawer, EmptyState, MoneyDisplay, SkeletonShell, StatusBadge } from "@/components/shared"
import { useDrawerIdentity } from "@/features/_shared/drawer"
import { useBankStatement } from "../hooks/useBankStatement"
import { formDrawerWidth } from "@/lib/form-widths"

interface BankStatementData {
    id: number
    display_id: string
    treasury_account_name: string
    status: string
    opening_balance: number
    closing_balance: number
    reconciliation_progress: number
}

interface BankStatementDrawerProps {
    statementId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BankStatementDrawer({ statementId, open, onOpenChange }: BankStatementDrawerProps) {
    const { statement, isLoading, isError } = useBankStatement<BankStatementData>(statementId, open)
    const identity = useDrawerIdentity('treasury.bankstatement', 'view', statement, {
        overrideTitle: statement ? `Cartola ${statement.display_id || statement.id}` : "Cartola Bancaria",
        overrideSubtitle: statement?.treasury_account_name,
    })

    return (
        <Drawer
            mode="view"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize={formDrawerWidth("master", false)}
            title={identity.title}
            subtitle={identity.subtitle}
            icon={identity.icon}
        >
            {isError ? (
                <div className="p-4">
                    <EmptyState
                        context="treasury"
                        title="Error al cargar cartola"
                        description="No se pudo cargar la información de la cartola bancaria."
                    />
                </div>
            ) : (
            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando cartola">
                {statement ? (
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Cuenta</span>
                                <p className="font-medium">{statement.treasury_account_name}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Estado</span>
                                <p><StatusBadge status={statement.status} /></p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Saldo Inicial</span>
                                <p className="font-medium"><MoneyDisplay amount={statement.opening_balance || 0} inline /></p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Saldo Final</span>
                                <p className="font-medium"><MoneyDisplay amount={statement.closing_balance || 0} inline /></p>
                            </div>
                        </div>
                        {statement.reconciliation_progress != null && (
                            <div>
                                <span className="text-muted-foreground text-sm">Progreso de Conciliación</span>
                                <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${statement.reconciliation_progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{statement.reconciliation_progress}%</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </SkeletonShell>
            )}
        </Drawer>
    )
}
