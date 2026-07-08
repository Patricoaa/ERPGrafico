import { redirect } from "next/navigation"

export default async function BankStatementDetailRedirect({
    params,
}: {
    params: Promise<{ bankId: string; statementId: string }>
}) {
    const { bankId, statementId } = await params
    redirect(`/treasury/bank-center/${bankId}/reconciliation?selected=${statementId}`)
}
