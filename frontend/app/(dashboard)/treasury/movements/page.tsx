import { Metadata } from "next"
import { Suspense } from "react"
import { TreasuryMovementsClientView } from "@/features/treasury"
import { TableSkeleton } from "@/components/shared"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

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
        <div className="pt-2">
            <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
            </Suspense>
        </div>
    )
}
