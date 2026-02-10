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
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function UnifiedStockPage() {
    const [activeTab, setActiveTab] = useState("report")
    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false)

    const tabs = [
        { value: "report", label: "Stock", icon: FileBarChart },
        { value: "movements", label: "Movimientos", icon: History },
        { value: "replenishment", label: "Reabastecimiento", icon: RefreshCw },
        { value: "warehouses", label: "Almacenes", icon: Warehouse },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "report":
                return {
                    title: "Reporte de Existencias",
                    description: "Estado actual del inventario, valorización y alertas de stock.",
                    actions: null
                }
            case "movements":
                return {
                    title: "Historial de Movimientos",
                    description: "Registro cronológico de entradas, salidas y transferencias.",
                    actions: null
                }
            case "replenishment":
                return {
                    title: "Gestión de Reabastecimiento",
                    description: "Análisis de stock crítico y sugerencias de compra.",
                    actions: null
                }
            case "warehouses":
                return {
                    title: "Gestión de Almacenes",
                    description: "Configure y administre sus bodegas y puntos de almacenamiento.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsWarehouseModalOpen(true)} title="Nuevo Almacén">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            default:
                return { title: "Stock", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-2xl" />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                />

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
                        <WarehouseList externalOpen={isWarehouseModalOpen} onExternalOpenChange={setIsWarehouseModalOpen} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
