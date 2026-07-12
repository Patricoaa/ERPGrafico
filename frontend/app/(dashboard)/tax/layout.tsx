import { PageContainer } from "@/components/shared"
import { TaxHeader } from "./TaxHeader"

export default function TaxLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <TaxHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
