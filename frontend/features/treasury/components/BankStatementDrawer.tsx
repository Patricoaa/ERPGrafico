"use client"

import { Drawer, SkeletonShell, StatusBadge } from "@/components/shared"
import { BookOpen } from "lucide-react"
import { useBankStatement } from "../hooks/useBankStatement"

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
    const { statement, isLoading } = useBankStatement<BankStatementData>(statementId, open)

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize="55%"
            title={statement ? `Cartola ${statement.display_id || statement.id}` : "Cartola Bancaria"}
            subtitle={statement?.treasury_account_name}
            icon={BookOpen}
        >
            {isLoading ? (
                <SkeletonShell isLoading={true} ariaLabel="Cargando cartola" />
            ) : statement ? (
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
                            <p className="font-medium">${Number(statement.opening_balance || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Saldo Final</span>
                            <p className="font-medium">${Number(statement.closing_balance || 0).toLocaleString()}</p>
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
        </Drawer>
    )
}
