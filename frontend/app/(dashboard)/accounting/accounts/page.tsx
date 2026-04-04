import { Metadata } from "next"
import { AccountsClientView } from "@/features/accounting/components/AccountsClientView"

export const metadata: Metadata = {
    title: "Plan de Cuentas | ERPGrafico",
    description: "Estructura de cuentas contables y estados financieros.",
}

export default function AccountsPage() {
    return <AccountsClientView />
}

