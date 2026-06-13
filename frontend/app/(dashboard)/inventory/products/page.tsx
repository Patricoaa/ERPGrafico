import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductClientView, CategoryClientView, PricingRuleClientView, SubscriptionsView } from "@/features/inventory"
import { ToolbarCreateButton, FadeIn } from "@/components/shared"

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
        <Tabs value={activeTab} className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <TabsContent value="products" className="h-full mt-0 outline-none">
                    <FadeIn className="h-full">
                        <ProductClientView
                            externalOpen={activeTab === 'products' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'products' ? createAction : null}
                        />
                    </FadeIn>
                </TabsContent>
                <TabsContent value="categories" className="h-full mt-0 outline-none">
                    <FadeIn className="h-full">
                        <CategoryClientView
                            externalOpen={activeTab === 'categories' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'categories' ? createAction : null}
                        />
                    </FadeIn>
                </TabsContent>
                <TabsContent value="pricing-rules" className="h-full mt-0 outline-none">
                    <FadeIn className="h-full">
                        <PricingRuleClientView
                            externalOpen={activeTab === 'pricing-rules' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'pricing-rules' ? createAction : null}
                        />
                    </FadeIn>
                </TabsContent>
                <TabsContent value="subscriptions" className="h-full mt-0 outline-none">
                    <FadeIn className="h-full">
                        <SubscriptionsView
                            hideHeader
                            externalOpen={activeTab === 'subscriptions' && resolvedParams.modal === 'new'}
                            createAction={activeTab === 'subscriptions' ? createAction : null}
                        />
                    </FadeIn>
                </TabsContent>
            </div>
        </Tabs>
    )
}
