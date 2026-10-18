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
    return buildBankMetadata(bankName, "checks")
  } catch {
    return buildBankMetadata(`Banco ${id}`, "checks")
  }
}

export default async function BankChecksPage({ params }: PageProps) {
  const { bankId } = await params
  const id = Number(bankId)
  return (
    <div className="h-full flex flex-col">
      <BankPageHeader bankId={id} subView="checks" />
      <BankCenterDashboard bankId={id} />
    </div>
  )
}