import { PageContainer } from "@/components/shared"
import { HRHeader } from "./HRHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const generateMetadata = createAutoMetadata("hr")

export default function HRLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="hr.view_dashboard_hr">
            <PageContainer className="flex flex-col">
                <HRHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
