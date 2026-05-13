import { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductList, CategoryList, PricingRuleList, SubscriptionsView } from "@/features/inventory"
import { TableSkeleton, ToolbarCreateButton } from "@/components/shared"

export const metadata: Metadata = {
    title: "Productos | ERPGrafico",
    description: "Gestión de catálogo, categorías y reglas de precios.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function UnifiedProductsPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    let activeTab = resolvedParams.tab || "products"

    // Fallback for legacy notification links
    if (activeTab === "general") {
        activeTab = "products"
    }

    if (!resolvedParams.tab) {
        redirect('/inventory/products?tab=products')
    }

    const getCreateAction = (tab: string) => {
        const actionMap: Record<string, { label: string; href: string }> = {
            products: { label: "Nuevo Producto", href: "/inventory/products?tab=products&modal=new" },
            categories: { label: "Nueva Categoría", href: "/inventory/products?tab=categories&modal=new" },
            "pricing-rules": { label: "Nueva Regla", href: "/inventory/products?tab=pricing-rules&modal=new" },
            subscriptions: { label: "Nueva Suscripción", href: "/inventory/products?tab=subscriptions&modal=new" },
        }
        const action = actionMap[tab]
        return action ? <ToolbarCreateButton label={action.label} href={action.href} /> : null
    }

    const createAction = getCreateAction(activeTab)

    return (
        <Tabs value={activeTab} className="space-y-4 pt-2">
            <div className="min-h-[400px]">
                <TabsContent value="products" className="mt-0 outline-none">
                    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <ProductList
                            externalOpen={activeTab === 'products' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'products' ? createAction : null}
                        />
                    </Suspense>
                </TabsContent>
                <TabsContent value="categories" className="mt-0 outline-none">
                    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <CategoryList
                            externalOpen={activeTab === 'categories' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'categories' ? createAction : null}
                        />
                    </Suspense>
                </TabsContent>
                <TabsContent value="pricing-rules" className="mt-0 outline-none">
                    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <PricingRuleList
                            externalOpen={activeTab === 'pricing-rules' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'pricing-rules' ? createAction : null}
                        />
                    </Suspense>
                </TabsContent>
                <TabsContent value="subscriptions" className="mt-0 outline-none">
                    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <SubscriptionsView
                            hideHeader
                            externalOpen={activeTab === 'subscriptions' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'subscriptions' ? createAction : null}
                        />
                    </Suspense>
                </TabsContent>
            </div>
        </Tabs>
    )
}
