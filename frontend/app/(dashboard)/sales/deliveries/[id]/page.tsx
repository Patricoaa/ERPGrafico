import { redirect } from "next/navigation"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function SaleDeliveryDetailPage({ params }: PageProps) {
    const { id } = await params
    redirect(`/sales/deliveries?selected=${id}`)
}
