import { PageContainer } from "@/components/shared"
import { InventoryHeader } from "./InventoryHeader"
import { createAutoMetadata } from "@/lib/auto-metadata"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const generateMetadata = createAutoMetadata("inventory")

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="inventory.view_dashboard_inventory">
            <PageContainer className="flex flex-col">
                <InventoryHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
