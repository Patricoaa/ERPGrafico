import { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { POSSessionsClientView } from "@/features/sales"

export const metadata: Metadata = {
    title: "Historial de Sesiones | ERPGrafico",
    description: "Registro cronológico de aperturas y cierres de terminales POS.",
}

export default function POSSessionsPage() {
    return (
        <div className="h-full flex flex-col">
            <PageSectionHeader title="Sesiones POS" description="Registro de aperturas y cierres de cajas" />
            <POSSessionsClientView hideHeader />
        </div>
    )
}
