import { Metadata } from "next"
import { TreasuryMovementsClientView } from "@/features/treasury"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

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
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Movimientos de Tesorería"
                description="Registro histórico de ingresos, egresos y traslados de fondos."
                iconName="banknote"
                variant="minimal"
            />

            <div className="pt-4">
                <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
            </div>
        </div>
    )
}
