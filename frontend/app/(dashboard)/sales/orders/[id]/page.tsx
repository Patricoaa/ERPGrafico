import { SaleOrderDetailClient } from "@/features/sales"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SaleOrderDetailPage({ params }: PageProps) {
    const { id } = await params
    return <SaleOrderDetailClient orderId={id} />
}
