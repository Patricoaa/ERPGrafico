import { redirect } from "next/navigation"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function PurchaseReceiptDetailPage({ params }: PageProps) {
    const { id } = await params
    redirect(`/purchasing/receipts?selected=${id}`)
}
