import { BankPageHeader, BankCenterView } from "@/features/treasury"

export default async function BankCardsPage({
    params,
}: {
    params: Promise<{ bankId: string; cardSubtab?: string[] }>
}) {
    const { bankId, cardSubtab } = await params
    const subtab = cardSubtab?.[0] || 'unbilled'
    const id = Number(bankId)
    return (
        <div className="h-full flex flex-col">
            <BankPageHeader bankId={id} title="Tarjeta de crédito" subtab={subtab} />
            <BankCenterView bankId={id} subtab={subtab} />
        </div>
    )
}
