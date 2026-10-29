import { redirect } from 'next/navigation'

// Legacy link: a stock move has no list page of its own, its detail is the drawer
// behind the canonical document URL (ADR-0080).
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/d/inventory.stockmove/${id}`)
}
