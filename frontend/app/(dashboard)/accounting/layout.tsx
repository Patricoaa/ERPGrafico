import { PageContainer } from "@/components/shared"
import { AccountingHeader } from "./AccountingHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const generateMetadata = createAutoMetadata("accounting")

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="accounting.view_dashboard_accounting">
            <PageContainer className="flex flex-col">
                <AccountingHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
