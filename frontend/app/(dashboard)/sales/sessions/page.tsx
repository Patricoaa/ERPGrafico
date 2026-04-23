import { Metadata } from "next"
import { POSSessionsView } from "@/features/sales"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Historial de Sesiones | ERPGrafico",
    description: "Registro cronológico de aperturas y cierres de terminales POS.",
}

export default function POSSessionsPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Sesiones Punto de Venta"
                description="Historial de aperturas y cierres de caja."
                iconName="list"
                variant="minimal"
                titleActions={
                    <Link href="/pos" target="_blank">
                        <PageHeaderButton 
                            iconName="store" 
                            circular 
                            title="Ir al POS" 
                        />
                    </Link>
                }
            />
            
            <div className="pt-4">
                <POSSessionsView hideHeader />
            </div>
        </div>
    )
}
