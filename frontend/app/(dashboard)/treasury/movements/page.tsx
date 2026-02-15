import { Metadata } from "next"
import { TreasuryMovementsClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Movimientos de Tesorería | ERPGrafico",
    description: "Registro histórico de ingresos, egresos y traslados de fondos.",
}

export default function TreasuryMovementsPage() {
    return <TreasuryMovementsClientView />
}
