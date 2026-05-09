import { PurchaseOrderDetailClient } from "@/features/purchasing/components"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
    const { id } = await params
    return <PurchaseOrderDetailClient orderId={id} />
}
