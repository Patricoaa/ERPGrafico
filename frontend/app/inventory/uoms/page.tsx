"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { UoMList } from "@/components/inventory/UoMList"
import { UoMCategoryList } from "@/components/inventory/UoMCategoryList"
import { Scale, Layers } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"

export default function UnifiedUoMPage() {
    const [activeTab, setActiveTab] = useState("units")

    const tabs = [
        { value: "units", label: "Unidades", icon: Scale },
        { value: "categories", label: "Categorías", icon: Layers },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Unidades de Medida</h2>
                    <p className="text-muted-foreground">Configura las unidades y categorías para el control de inventario.</p>
                </div>
            </div>

            <Tabs defaultValue="units" className="space-y-4" onValueChange={setActiveTab}>
                <PageTabs tabs={tabs} maxWidth="max-w-sm" />

                <div className="pt-4">
                    <TabsContent value="units" className="mt-0 outline-none">
                        <UoMList />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <UoMCategoryList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
