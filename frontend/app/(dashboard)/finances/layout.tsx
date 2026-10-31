import { PageContainer } from "@/components/shared"
import { FinancesHeader } from "./FinancesHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const generateMetadata = createAutoMetadata("finances")

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="finances.view_dashboard_finances">
            <PageContainer className="flex flex-col">
                <FinancesHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
