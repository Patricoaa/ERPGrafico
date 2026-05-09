import { DeliveryDetailClient } from "@/features/sales"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function DeliveryDetailPage({ params }: PageProps) {
    const { id } = await params
    return <DeliveryDetailClient orderId={id} />
}
