import { BankPageHeader, BankCenterView } from "@/features/treasury"

export default async function UnbilledPage({ params }: { params: Promise<{ bankId: string }> }) {
    const { bankId } = await params
    const id = Number(bankId)
    return (
        <div className="h-full flex flex-col">
            <BankPageHeader bankId={id} title="Tarjeta de crédito" subtab="unbilled" />
            <BankCenterView bankId={id} subtab="unbilled" />
        </div>
    )
}
