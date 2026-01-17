"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WarehouseList } from "@/components/inventory/WarehouseList"
import { MovementList } from "@/components/inventory/MovementList"
import { StockReport } from "@/components/inventory/StockReport"

import { ReplenishmentRuleList } from "@/components/inventory/ReplenishmentRuleList"
import { Warehouse, History, FileBarChart, ArrowRightLeft, RefreshCw } from "lucide-react"

export default function UnifiedStockPage() {
    const [activeTab, setActiveTab] = useState("report")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gestión de Stock</h2>
                    <p className="text-muted-foreground">Controla tus almacenes, movimientos y valorización de inventario.</p>
                </div>
            </div>

            <Tabs defaultValue="report" className="space-y-4" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                    <TabsList className="grid w-full h-auto flex-wrap grid-cols-2 md:grid-cols-4 bg-muted/50 rounded-lg p-1 border">
                        <TabsTrigger value="report" className="rounded-md gap-2">
                            <FileBarChart className="h-4 w-4" />
                            <span className="max-sm:hidden">Stock</span>
                        </TabsTrigger>
                        <TabsTrigger value="movements" className="rounded-md gap-2">
                            <History className="h-4 w-4" />
                            <span className="max-sm:hidden">Movimientos</span>
                        </TabsTrigger>
                        <TabsTrigger value="replenishment" className="rounded-md gap-2">
                            <RefreshCw className="h-4 w-4" />
                            <span className="max-sm:hidden">Reabastecimiento</span>
                        </TabsTrigger>
                        <TabsTrigger value="warehouses" className="rounded-md gap-2">
                            <Warehouse className="h-4 w-4" />
                            <span className="max-sm:hidden">Almacenes</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="pt-4">
                    <TabsContent value="report" className="mt-0 outline-none">
                        <StockReport />
                    </TabsContent>
                    <TabsContent value="movements" className="mt-0 outline-none">
                        <MovementList />
                    </TabsContent>
                    <TabsContent value="replenishment" className="mt-0 outline-none">
                        <ReplenishmentRuleList />
                    </TabsContent>
                    <TabsContent value="warehouses" className="mt-0 outline-none">
                        <WarehouseList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
