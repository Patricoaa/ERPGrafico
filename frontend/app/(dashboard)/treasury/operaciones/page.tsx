import type { Metadata } from "next"
import { TreasuryMovementsClientView, TreasuryAccountsView, ChecksView } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export const metadata: Metadata = {
    title: "Operaciones de Tesorería | ERPGrafico",
    description: "Movimientos, cheques, cuentas de tesorería y métodos de pago.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function OperacionesPage({ searchParams }: PageProps) {
    const { tab, modal } = await searchParams
    const activeTab = tab || "movements"
    const modalOpen = modal === "new"

    if (activeTab === "accounts") {
        const action = <ToolbarCreateButton label="Nueva Cuenta" href="/treasury/operaciones?tab=accounts&modal=new" />
        return <TreasuryAccountsView activeTab="accounts" externalOpen={modalOpen} createAction={action} />
    }

    if (activeTab === "methods") {
        const action = <ToolbarCreateButton label="Nuevo Método" href="/treasury/operaciones?tab=methods&modal=new" />
        return <TreasuryAccountsView activeTab="methods" externalOpen={modalOpen} createAction={action} />
    }

    if (activeTab === "checks") {
        return <ChecksView />
    }

    const createAction = (
        <ToolbarCreateButton
            label="Nuevo Movimiento"
            href="/treasury/operaciones?tab=movements&modal=new"
        />
    )

    return <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
}
