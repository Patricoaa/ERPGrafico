import { redirect } from "next/navigation"

export default async function BankCardsRootPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    redirect(`/treasury/centro-bancos/${bankId}/cards/unbilled`)
}
