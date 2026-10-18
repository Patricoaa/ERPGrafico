import { PageContainer } from "@/components/shared"
import { PurchasingHeader } from "./PurchasingHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"

export const generateMetadata = createAutoMetadata("purchasing")

export default function PurchasingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <PurchasingHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
