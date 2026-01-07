"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WarehouseList } from "@/components/inventory/WarehouseList"
import { MovementList } from "@/components/inventory/MovementList"
import { StockReport } from "@/components/inventory/StockReport"
import { Warehouse, History, FileBarChart } from "lucide-react"

export default function UnifiedStockPage() {
    const [activeTab, setActiveTab] = useState("warehouses")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gestión de Stock</h2>
                    <p className="text-muted-foreground">Controla tus almacenes, movimientos y valorización de inventario.</p>
                </div>
            </div>

            <Tabs defaultValue="warehouses" className="space-y-4" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-lg grid-cols-3 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="warehouses" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Warehouse className="h-4 w-4" />
                            <span className="max-sm:hidden">Almacenes</span>
                        </TabsTrigger>
                        <TabsTrigger value="movements" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <History className="h-4 w-4" />
                            <span className="max-sm:hidden">Movimientos</span>
                        </TabsTrigger>
                        <TabsTrigger value="report" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <FileBarChart className="h-4 w-4" />
                            <span className="max-sm:hidden">Reporte Stock</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="pt-4">
                    <TabsContent value="warehouses" className="mt-0 outline-none">
                        <WarehouseList />
                    </TabsContent>
                    <TabsContent value="movements" className="mt-0 outline-none">
                        <MovementList />
                    </TabsContent>
                    <TabsContent value="report" className="mt-0 outline-none">
                        <StockReport />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
