"use client"

import { StatementsClientView } from "@/features/finance"
import { useTreasuryAccounts } from "../hooks/useTreasuryAccounts"

/**
 * Vista agregada de conciliación bancaria (Centro de Bancos → Conciliación).
 * Muestra las cartolas de todas las cuentas corrientes y permite importar.
 */
export function AllBanksReconciliationClientView() {
    const { accounts } = useTreasuryAccounts({ filters: { account_type: "CHECKING" } })
    const checkingAccounts = accounts
        .filter((a) => a.account_type === "CHECKING")
        .map((a) => ({ id: a.id, name: a.name }))

    return (
        <div className="flex-1 min-h-0">
            <StatementsClientView
                accounts={checkingAccounts}
                detailBasePath="/treasury/bank-center/reconciliation"
            />
        </div>
    )
}
