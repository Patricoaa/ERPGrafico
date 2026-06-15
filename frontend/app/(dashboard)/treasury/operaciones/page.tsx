import type { Metadata } from "next"
import { ToolbarCreateButton } from '@/components/shared'
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

    return <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
}
