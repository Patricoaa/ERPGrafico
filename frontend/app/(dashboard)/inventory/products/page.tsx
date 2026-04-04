import { Metadata } from "next"
import { Suspense } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductList } from "@/features/inventory/components/ProductList"
import { CategoryList } from "@/features/inventory/components/CategoryList"
import { PricingRuleList } from "@/features/inventory/components/PricingRuleList"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

import { LAYOUT_TOKENS } from "@/lib/styles"

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

    const tabs = [
        { value: "products", label: "Productos", iconName: "package", href: "/inventory/products?tab=products" },
        { value: "categories", label: "Categorías", iconName: "tags", href: "/inventory/products?tab=categories" },
        { value: "pricing-rules", label: "Reglas de Precio", iconName: "dollar-sign", href: "/inventory/products?tab=pricing-rules" },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "products":
                return {
                    title: "Catálogo de Productos",
                    description: "Gestión integral de productos y sus variantes.",
                    actionTitle: "Nuevo Producto",
                    tabValue: "products"
                }
            case "categories":
                return {
                    title: "Categorías de Productos",
                    description: "Organice su catálogo mediante grupos jerárquicos.",
                    actionTitle: "Nueva Categoría",
                    tabValue: "categories"
                }
            case "pricing-rules":
                return {
                    title: "Reglas de Precios",
                    description: "Configure descuentos y recargos dinámicos.",
                    actionTitle: "Nueva Regla",
                    tabValue: "pricing-rules"
                }
            default:
                return { title: "Productos", description: "", actionTitle: "", tabValue: "products" }
        }
    }

    const { title, description, actionTitle, tabValue } = getHeaderConfig()

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title={title}
                description={description}
                variant="minimal"
                iconName="package"
                titleActions={actionTitle ? (
                    <Link href={`/inventory/products?tab=${tabValue}&modal=new`}>
                        <PageHeaderButton
                            iconName="plus"
                            circular
                            title={actionTitle}
                        />
                    </Link>
                ) : null}
            />

            <div className="pt-2">
                <PageTabs tabs={tabs} activeValue={activeTab} />
            </div>

            <Tabs value={activeTab} className="space-y-4 pt-4">
                <div className="pt-0 min-h-[400px]">
                    <TabsContent value="products" className="mt-0 outline-none">
                        <Suspense fallback={<LoadingFallback />}>
                            <ProductList
                                externalOpen={activeTab === 'products' && resolvedParams.modal === 'new'}
                            />
                        </Suspense>
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <Suspense fallback={<LoadingFallback />}>
                            <CategoryList
                                externalOpen={activeTab === 'categories' && resolvedParams.modal === 'new'}
                            />
                        </Suspense>
                    </TabsContent>
                    <TabsContent value="pricing-rules" className="mt-0 outline-none">
                        <Suspense fallback={<LoadingFallback />}>
                            <PricingRuleList
                                externalOpen={activeTab === 'pricing-rules' && resolvedParams.modal === 'new'}
                            />
                        </Suspense>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}

