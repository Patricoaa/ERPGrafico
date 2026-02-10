"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WarehouseList } from "@/components/inventory/WarehouseList"
import { MovementList } from "@/components/inventory/MovementList"
import { StockReport } from "@/components/inventory/StockReport"
import { ReplenishmentDashboard } from "@/components/inventory/ReplenishmentDashboard"
import { Warehouse, History, FileBarChart, RefreshCw } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"

export default function UnifiedStockPage() {
    const [activeTab, setActiveTab] = useState("report")

    const tabs = [
        { value: "report", label: "Stock", icon: FileBarChart },
        { value: "movements", label: "Movimientos", icon: History },
        { value: "replenishment", label: "Reabastecimiento", icon: RefreshCw },
        { value: "warehouses", label: "Almacenes", icon: Warehouse },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Gestión de Stock"
                description="Controla tus almacenes, movimientos y valorización de inventario."
            />

            <Tabs defaultValue="report" className="space-y-4" onValueChange={setActiveTab}>
                <PageTabs tabs={tabs} maxWidth="max-w-2xl" />

                <div className="pt-4">
                    <TabsContent value="report" className="mt-0 outline-none">
                        <StockReport />
                    </TabsContent>
                    <TabsContent value="movements" className="mt-0 outline-none">
                        <MovementList />
                    </TabsContent>
                    <TabsContent value="replenishment" className="mt-0 outline-none">
                        <ReplenishmentDashboard />
                    </TabsContent>
                    <TabsContent value="warehouses" className="mt-0 outline-none">
                        <WarehouseList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
