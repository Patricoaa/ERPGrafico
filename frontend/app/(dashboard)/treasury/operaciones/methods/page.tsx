import type { Metadata } from "next"
import { ToolbarCreateButton } from '@/components/shared'
import { TreasuryAccountsView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Métodos de Pago | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function OperacionesMethodsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const modalOpen = modal === "new"
    const action = <ToolbarCreateButton label="Nuevo Método" href="/treasury/operaciones/methods?modal=new" />

    return <TreasuryAccountsView activeTab="methods" externalOpen={modalOpen} createAction={action} />
}
