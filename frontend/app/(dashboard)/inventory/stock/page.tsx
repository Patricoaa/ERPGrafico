import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WarehouseList, MovementList, StockReport } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

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

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4">
                <TabsContent value="report" className="mt-0 outline-none">
                    <StockReport />
                </TabsContent>
                <TabsContent value="movements" className="mt-0 outline-none">
                    <MovementList
                        externalOpen={activeTab === 'movements' && modal === 'adjustment'}
                        createAction={
                            <ToolbarCreateButton
                                label="Nuevo Ajuste"
                                href="/inventory/stock?tab=movements&modal=adjustment"
                            />
                        }
                    />
                </TabsContent>
                <TabsContent value="warehouses" className="mt-0 outline-none">
                    <WarehouseList
                        externalOpen={activeTab === 'warehouses' && modal === 'new'}
                        createAction={
                            <ToolbarCreateButton
                                label="Nuevo Almacén"
                                href="/inventory/stock?tab=warehouses&modal=new"
                            />
                        }
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
