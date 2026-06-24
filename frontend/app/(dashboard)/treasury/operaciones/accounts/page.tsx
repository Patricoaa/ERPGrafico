import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { TreasuryAccountsClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Cuentas de Tesorería | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function OperacionesAccountsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const modalOpen = modal === "new"
    const action = <ToolbarCreateButton label="Nueva Cuenta" href="/treasury/operaciones/accounts?modal=new" />

    return (
        <>
            <PageSectionHeader title="Cuentas de Tesorería" description="Administración de cuentas bancarias y de efectivo" />
            <TreasuryAccountsClientView activeTab="accounts" externalOpen={modalOpen} createAction={action} />
        </>)
}
