import { redirect } from "next/navigation"

export default async function BankRootPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    redirect(`/treasury/centro-bancos/${bankId}/overview`)
}
