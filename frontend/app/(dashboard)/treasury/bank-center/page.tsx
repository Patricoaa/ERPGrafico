import type { Metadata } from "next"
import BankCenterPageClient from "./BankCenterPageClient"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

export default function BankCenterPage() {
    return (
        <>
            <BankCenterPageClient />
        </>)
}
