import { Metadata } from "next"
import { TreasuryMovementsClientView } from "@/features/treasury"
import { ToolbarCreateButton } from '@/components/shared'

export const metadata: Metadata = {
    title: "Movimientos de Tesorería | ERPGrafico",
    description: "Registro histórico de ingresos, egresos y traslados de fondos.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function TreasuryMovementsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const modalOpen = params.modal === "new"

    const createAction = (
        <ToolbarCreateButton
            label="Nuevo Movimiento"
            href="/treasury/movements?modal=new"
        />
    )

    return (
        <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
    )
}
