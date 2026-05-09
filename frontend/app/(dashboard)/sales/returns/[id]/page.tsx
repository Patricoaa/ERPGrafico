import { SaleReturnDetailClient } from "@/features/sales"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SaleReturnDetailPage({ params }: PageProps) {
    const { id } = await params
    return <SaleReturnDetailClient orderId={id} />
}
