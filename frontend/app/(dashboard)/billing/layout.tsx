import { PageContainer } from "@/components/shared"
import { BillingHeader } from "./BillingHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"

export const generateMetadata = createAutoMetadata("billing")

export default function BillingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <BillingHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
