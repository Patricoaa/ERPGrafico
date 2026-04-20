import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WarehouseList } from "@/features/inventory/components/WarehouseList"
import { MovementList } from "@/features/inventory/components/MovementList"
import { StockReport } from "@/features/inventory/components/StockReport"
import { Warehouse, History, FileBarChart } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { LAYOUT_TOKENS } from "@/lib/styles"

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
        { value: "warehouses", label: "Almacenes", iconName: "warehouse", href: "/inventory/stock?tab=warehouses" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "report":
                return {
                    title: "Reporte de Existencias",
                    description: "Estado actual del inventario, valorización y alertas de stock.",
                }
            case "movements":
                return {
                    title: "Historial de Movimientos",
                    description: "Registro cronológico de entradas, salidas y transferencias.",
                }
            case "warehouses":
                return {
                    title: "Gestión de Almacenes",
                    description: "Configure y administre sus bodegas y puntos de almacenamiento.",
                }
            default:
                return { title: "Stock", description: "" }
        }
    }

    const { title, description } = getHeaderConfig()

    const movementsCreateAction = (
        <ToolbarCreateButton
            label="Nuevo Ajuste"
            href="/inventory/stock?tab=movements&modal=adjustment"
        />
    )

    const warehousesCreateAction = (
        <ToolbarCreateButton
            label="Nuevo Almacén"
            href="/inventory/stock?tab=warehouses&modal=new"
        />
    )

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                iconName="warehouse"
                variant="minimal"
            />

            <PageTabs tabs={tabs} activeValue={activeTab} />

            <div className="pt-4">
                <Tabs value={activeTab} className="space-y-4">
                    <TabsContent value="report" className="mt-0 outline-none">
                        <StockReport />
                    </TabsContent>
                    <TabsContent value="movements" className="mt-0 outline-none">
                        <MovementList
                            externalOpen={activeTab === 'movements' && modal === 'adjustment'}
                            createAction={movementsCreateAction}
                        />
                    </TabsContent>
                    <TabsContent value="warehouses" className="mt-0 outline-none">
                        <WarehouseList
                            externalOpen={activeTab === 'warehouses' && modal === 'new'}
                            createAction={warehousesCreateAction}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

