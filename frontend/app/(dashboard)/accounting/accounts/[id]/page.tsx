import { Metadata } from "next"
import { AccountDetailClient } from "@/features/finance/components/AccountDetailClient"

export const metadata: Metadata = {
    title: "Detalle de Cuenta | ERP Gráfico",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: PageProps) {
    const { id } = await params
    return <AccountDetailClient accountId={id} />
}
