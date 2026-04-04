"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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

    return (
        <Tabs defaultValue="stock" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stock" className="gap-2">
                    <Package className="h-4 w-4" />
                    Materiales de Stock
                    {stockCount > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                            {stockCount}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="outsourced" className="gap-2">
                    <Briefcase className="h-4 w-4" />
                    Servicios Tercerizados
                    {outsourcedCount > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                            {outsourcedCount}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="space-y-4 pt-4 animate-in fade-in-50 duration-300">
                {stockContent}
            </TabsContent>

            <TabsContent value="outsourced" className="space-y-4 pt-4 animate-in fade-in-50 duration-300">
                {outsourcedContent}
            </TabsContent>
        </Tabs>
    )
}
