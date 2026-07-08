import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from '@/components/shared'
import { TreasuryMovementsClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Operaciones de Tesorería | ERPGrafico",
    description: "Movimientos, cheques, cuentas de tesorería y métodos de pago.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function OperacionesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const modalOpen = modal === "new"
    const createAction = (
        <ToolbarCreateButton
            label="Nuevo Movimiento"
            href="/treasury/operaciones/movements?modal=new"
        />
    )

    return (
        <>
            <PageSectionHeader title="Operaciones de Tesorería" description="Movimientos, cheques y cuentas de tesorería" />
            <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
        </>)
}
