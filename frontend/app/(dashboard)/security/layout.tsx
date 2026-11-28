import { PageContainer } from "@/components/shared"
import { SecurityHeader } from "./SecurityHeader"

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer>
      <SecurityHeader />
      {children}
    </PageContainer>
  )
}
