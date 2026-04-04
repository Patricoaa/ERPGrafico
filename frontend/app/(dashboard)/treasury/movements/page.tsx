import { Metadata } from "next"
import { TreasuryMovementsClientView } from "@/features/treasury"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"

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

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Movimientos de Tesorería"
                description="Registro histórico de ingresos, egresos y traslados de fondos."
                iconName="banknote"
                variant="minimal"
                titleActions={
                    <Link href="/treasury/movements?modal=new">
                        <PageHeaderButton
                            iconName="plus"
                            circular
                            title="Nuevo Movimiento"
                        />
                    </Link>
                }
            />
            
            <div className="pt-4">
                <TreasuryMovementsClientView externalOpen={modalOpen} />
            </div>
        </div>
    )
}
