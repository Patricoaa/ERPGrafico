import { BankPageHeader, BankCenterDashboard } from "@/features/treasury"
import { buildBankPageMetadata } from "@/features/treasury/navigation.server"

interface PageProps {
  params: Promise<{ bankId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<import("next").Metadata> {
  const { bankId } = await params
  return buildBankPageMetadata(Number(bankId), "cards")
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