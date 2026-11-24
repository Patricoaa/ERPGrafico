import * as React from "react"
import { TabBar, TabBarContent, type TabItem, fadeInClass } from "@/components/shared"
import { Package, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

interface MaterialAssignmentTabsProps {
    stockContent: React.ReactNode
    outsourcedContent: React.ReactNode
    stockCount: number
    outsourcedCount: number
    showOutsourcedTab?: boolean
}

export function MaterialAssignmentTabs({
    stockContent,
    outsourcedContent,
    stockCount,
    outsourcedCount,
    showOutsourcedTab = true
}: MaterialAssignmentTabsProps) {
    const [activeTab, setActiveTab] = React.useState("stock")

    // If outsourced tab is hidden, just render stock content without tabs
    if (!showOutsourcedTab) {
        return (
            <div className="space-y-4">
                {stockContent}
            </div>
        )
    }

    const tabItems: TabItem[] = [
        {
            value: "stock",
            label: "Materiales de Stock",
            icon: Package,
            badge: stockCount > 0 ? stockCount : undefined
        },
        {
            value: "outsourced",
            label: "Servicios Tercerizados",
            icon: Briefcase,
            badge: outsourcedCount > 0 ? outsourcedCount : undefined
        }
    ]

    return (
        <div className="w-full">
            <TabBar 
                items={tabItems} 
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="horizontal"
            >
                <TabBarContent value="stock" className={cn("space-y-4 pt-6", fadeInClass({ duration: 300 }))}>
                    {stockContent}
                </TabBarContent>

                <TabBarContent value="outsourced" className={cn("space-y-4 pt-6", fadeInClass({ duration: 300 }))}>
                    {outsourcedContent}
                </TabBarContent>
            </TabBar>
        </div>
    )
}
