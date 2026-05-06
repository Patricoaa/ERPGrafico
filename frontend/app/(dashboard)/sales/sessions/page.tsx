import { Metadata } from "next"
import { POSSessionsView } from "@/features/sales"

export const metadata: Metadata = {
    title: "Historial de Sesiones | ERPGrafico",
    description: "Registro cronológico de aperturas y cierres de terminales POS.",
}

export default function POSSessionsPage() {
    return (
        <div className="pt-2">
            <POSSessionsView hideHeader />
        </div>
    )
}
