import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { redirect } from "next/navigation"
import { WarehouseList, MovementList, StockReport } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"
import { FadeIn } from "@/components/shared"

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

    if (!resolvedParams.tab) {
        redirect('/inventory/stock?tab=report')
    }

    return (
        <div className="pt-2">
            <Tabs value={activeTab} className="space-y-4 flex flex-col h-[calc(100vh-140px)]">
                <div className="flex-1 min-h-0">
                    <TabsContent value="report" className="h-full mt-0 outline-none">
                        <FadeIn className="h-full">
                            <StockReport />
                        </FadeIn>
                    </TabsContent>
                    <TabsContent value="movements" className="h-full mt-0 outline-none">
                        <FadeIn className="h-full">
                            <MovementList
                            externalOpen={activeTab === 'movements' && modal === 'adjustment'}
                            createAction={
                                <ToolbarCreateButton
                                    label="Nuevo Ajuste"
                                    href="/inventory/stock?tab=movements&modal=adjustment"
                                />
                            }
                        />
                    </FadeIn>
                </TabsContent>
                    <TabsContent value="warehouses" className="h-full mt-0 outline-none">
                        <FadeIn className="h-full">
                            <WarehouseList
                            externalOpen={activeTab === 'warehouses' && modal === 'new'}
                            createAction={
                                <ToolbarCreateButton
                                    label="Nuevo Almacén"
                                    href="/inventory/stock?tab=warehouses&modal=new"
                                />
                            }
                        />
                    </FadeIn>
                </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
