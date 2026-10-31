import { PageContainer } from "@/components/shared"
import { SalesHeader } from "./SalesHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const generateMetadata = createAutoMetadata("sales")

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="sales.view_dashboard_sales">
            <PageContainer className="flex flex-col">
                <SalesHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
