import { redirect } from "next/navigation"

export default async function BankWorkbenchRedirect({
    params,
}: {
    params: Promise<{ bankId: string; statementId: string }>
}) {
    const { bankId, statementId } = await params
    redirect(`/treasury/bank-center/${bankId}/reconciliation?workbench=${statementId}`)
}
