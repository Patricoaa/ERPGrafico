import { BankPageHeader, BankCenterDashboard } from "@/features/treasury"
import { treasuryApi } from "@/features/treasury/api/treasuryApi"
import { buildBankMetadata } from "@/features/treasury/navigation.server"

interface PageProps {
  params: Promise<{ bankId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<import("next").Metadata> {
  const { bankId } = await params
  const id = Number(bankId)
  try {
    const overview = await treasuryApi.getBankOverview(id)
    const bankName = (overview?.bank as { name?: string } | undefined)?.name || `Banco ${id}`
    return buildBankMetadata(bankName, "cards")
  } catch {
    return buildBankMetadata(`Banco ${id}`, "cards")
  }
}

export default async function UnbilledPage({ params }: PageProps) {
  const { bankId } = await params
  const id = Number(bankId)
  return (
    <div className="h-full flex flex-col">
      <BankPageHeader bankId={id} subView="cards" />
      <BankCenterDashboard bankId={id} subtab="unbilled" />
    </div>
  )
}