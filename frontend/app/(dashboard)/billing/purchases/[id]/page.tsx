import { InvoiceDetailClient } from "@/features/billing/components"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function PurchaseInvoiceDetailPage({ params }: PageProps) {
    const { id } = await params
    return <InvoiceDetailClient invoiceId={id} type="purchase" />
}
