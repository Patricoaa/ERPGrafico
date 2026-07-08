import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { BankCenterPageClientView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

export default function BankCenterPage() {
    return (
        <>
            <PageSectionHeader title="Centro de Bancos" description="Vista consolidada de bancos y productos financieros" />
            <BankCenterPageClientView />
        </>)
}
