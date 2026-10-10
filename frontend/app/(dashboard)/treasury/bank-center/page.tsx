import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import BankCenterPageClient from "./BankCenterPageClient"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

export default function BankCenterPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Centro de Bancos" description="Vista consolidada de bancos y productos financieros" />
            <BankCenterPageClient />
        </>)
}
