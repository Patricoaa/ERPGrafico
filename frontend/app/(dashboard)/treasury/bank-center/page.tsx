import type { Metadata } from "next"
import { BankCenterPageClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

export default function BankCenterPage() {
    return <BankCenterPageClientView />
}
