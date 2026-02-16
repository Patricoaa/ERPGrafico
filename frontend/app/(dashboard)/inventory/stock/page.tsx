import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WarehouseList } from "@/components/inventory/WarehouseList"
import { MovementList } from "@/components/inventory/MovementList"
import { StockReport } from "@/components/inventory/StockReport"
import { ReplenishmentDashboard } from "@/components/inventory/ReplenishmentDashboard"
import { Warehouse, History, FileBarChart, RefreshCw, PlayCircle, Plus } from "lucide-react"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Stock e Inventario | ERPGrafico",
    description: "Gestión de existencias, almacenes y reabastecimiento.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function UnifiedStockPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const activeTab = resolvedParams.tab || "report"
    const modal = resolvedParams.modal

    const tabs = [
        { value: "report", label: "Stock", iconName: "file-bar-chart", href: "/inventory/stock?tab=report" },
        { value: "movements", label: "Movimientos", iconName: "history", href: "/inventory/stock?tab=movements" },
        { value: "replenishment", label: "Reabastecimiento", iconName: "refresh-cw", href: "/inventory/stock?tab=replenishment" },
        { value: "warehouses", label: "Almacenes", iconName: "warehouse", href: "/inventory/stock?tab=warehouses" },
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
                    actions: (
                        <Link href="/inventory/stock?tab=movements&modal=adjustment">
                            <PageHeaderButton
                                icon={Plus}
                                circular
                                title="Nuevo Ajuste"
                            />
                        </Link>
                    )
                }
            case "replenishment":
                return {
                    title: "Gestión de Reabastecimiento",
                    description: "Análisis de stock crítico y sugerencias de compra.",
                    actions: (
                        <div className="flex items-center gap-2">
                            <Link href="/inventory/stock?tab=replenishment&modal=planifier">
                                <Button variant="outline" size="sm" className="h-8 rounded-full">
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Planificar
                                </Button>
                            </Link>
                            <Link href="/inventory/stock?tab=replenishment&modal=rule">
                                <PageHeaderButton
                                    icon={Plus}
                                    circular
                                    title="Nueva Regla"
                                />
                            </Link>
                        </div>
                    )
                }
            case "warehouses":
                return {
                    title: "Gestión de Almacenes",
                    description: "Configure y administre sus bodegas y puntos de almacenamiento.",
                    actions: (
                        <Link href="/inventory/stock?tab=warehouses&modal=new">
                            <PageHeaderButton
                                icon={Plus}
                                circular
                                title="Nuevo Almacén"
                            />
                        </Link>
                    )
                }
            default:
                return { title: "Stock", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

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
                        <MovementList
                            externalOpen={activeTab === 'movements' && modal === 'adjustment'}
                        />
                    </TabsContent>
                    <TabsContent value="replenishment" className="mt-0 outline-none">
                        <ReplenishmentDashboard
                            externalRunPlanifier={activeTab === 'replenishment' && modal === 'planifier'}
                            externalOpenRule={activeTab === 'replenishment' && modal === 'rule'}
                        />
                    </TabsContent>
                    <TabsContent value="warehouses" className="mt-0 outline-none">
                        <WarehouseList
                            externalOpen={activeTab === 'warehouses' && modal === 'new'}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
