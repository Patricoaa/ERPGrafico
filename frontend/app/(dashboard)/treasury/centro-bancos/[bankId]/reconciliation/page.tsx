import { BankPageHeader, BankCenterView } from "@/features/treasury"

export default async function BankReconciliationPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    const id = Number(bankId)
    return (
        <div className="flex-1 flex flex-col min-h-0">
            <BankPageHeader bankId={id} />
            <BankCenterView bankId={id} />
        </div>
    )
}
