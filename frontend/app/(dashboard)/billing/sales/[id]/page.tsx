import { InvoiceDetailClient } from "@/features/billing/components"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SaleInvoiceDetailPage({ params }: PageProps) {
    const { id } = await params
    return <InvoiceDetailClient invoiceId={id} type="sale" />
}
