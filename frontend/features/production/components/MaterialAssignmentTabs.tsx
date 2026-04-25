import * as React from "react"
import { FormTabs, FormTabsContent, type FormTabItem } from "@/components/shared"
import { Package, Briefcase } from "lucide-react"

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
    // If outsourced tab is hidden, just render stock content without tabs
    if (!showOutsourcedTab) {
        return (
            <div className="space-y-4">
                {stockContent}
            </div>
        )
    }

    const tabItems: FormTabItem[] = [
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

    const [activeTab, setActiveTab] = React.useState("stock")

    return (
        <div className="w-full">
            <FormTabs 
                items={tabItems} 
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="horizontal"
            >
                <FormTabsContent value="stock" className="space-y-4 pt-4 animate-in fade-in-50 duration-300">
                    {stockContent}
                </FormTabsContent>

                <FormTabsContent value="outsourced" className="space-y-4 pt-4 animate-in fade-in-50 duration-300">
                    {outsourcedContent}
                </FormTabsContent>
            </FormTabs>
        </div>
    )
}
