import { Metadata } from "next"
import { JournalEntryDetailClient } from "@/features/accounting/components/JournalEntryDetailClient"

export const metadata: Metadata = {
    title: "Asiento Contable | ERP Gráfico",
}

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function JournalEntryDetailPage({ params }: PageProps) {
    const { id } = await params
    return <JournalEntryDetailClient entryId={id} />
}
