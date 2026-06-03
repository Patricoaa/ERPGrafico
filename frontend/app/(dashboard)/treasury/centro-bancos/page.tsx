import type { Metadata } from "next"
import { BankCenterAllView, BankCenterView } from "@/features/treasury"

export const metadata: Metadata = {
    title: "Centro de Bancos | ERPGrafico",
    description: "Vista consolidada de bancos, productos financieros y vencimientos.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; bank?: string }>
}

export default async function CentroBancosPage({ searchParams }: PageProps) {
    const { bank } = await searchParams

    if (bank) {
        const bankId = Number(bank)
        if (bankId) {
            return <BankCenterView bankId={bankId} />
        }
    }

    return <BankCenterAllView />
}
