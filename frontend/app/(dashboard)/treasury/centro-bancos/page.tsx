import type { Metadata } from "next"
import { CentroBancosClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

export default function CentroBancosPage() {
    return <CentroBancosClientView />
}
