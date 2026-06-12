import { BankPageHeader, BankCenterView } from "@/features/treasury"

export default async function BankCardsPage({
    params,
    searchParams,
}: {
    params: Promise<{ bankId: string }>
    searchParams: Promise<{ subtab?: string }>
}) {
    const { bankId } = await params
    const { subtab } = await searchParams
    const id = Number(bankId)
    return (
        <div className="flex-1 flex flex-col min-h-0">
            <BankPageHeader bankId={id} title="Tarjeta de crédito" subtab={subtab} />
            <BankCenterView bankId={id} />
        </div>
    )
}
