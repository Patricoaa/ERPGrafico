import { BankPageHeader, BankCenterDashboard } from "@/features/treasury"

export default async function BankLoansPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    const id = Number(bankId)
    return (
        <div className="h-full flex flex-col">
            <BankPageHeader bankId={id} />
            <BankCenterDashboard bankId={id} />
        </div>
    )
}
