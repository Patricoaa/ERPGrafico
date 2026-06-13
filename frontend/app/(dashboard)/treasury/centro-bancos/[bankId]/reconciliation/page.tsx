import { BankPageHeader, BankCenterView } from "@/features/treasury"

export default async function BankReconciliationPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    const id = Number(bankId)
    return (
        <div className="h-full flex flex-col">
            <BankPageHeader bankId={id} />
            <BankCenterView bankId={id} />
        </div>
    )
}
