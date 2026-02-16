import React from "react"
import { Metadata } from "next"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductList } from "@/components/inventory/ProductList"
import { CategoryList } from "@/components/inventory/CategoryList"
import { PricingRuleList } from "@/components/inventory/PricingRuleList"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export const metadata: Metadata = {
    title: "Productos | ERPGrafico",
    description: "Gestión de catálogo, categorías y reglas de precios.",
}

interface PageProps {
    searchParams: Promise<{ tab?: string; modal?: string }>
}

export default async function UnifiedProductsPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams
    const activeTab = resolvedParams.tab || "products"

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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} className="space-y-4">
                <ServerPageTabs tabs={tabs} activeValue={activeTab} maxWidth="max-w-2xl" />

                <PageHeader
                    title={title}
                    description={description}
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

                <div className="pt-4">
                    <TabsContent value="products" className="mt-0 outline-none">
                        <ProductList
                            externalOpen={activeTab === 'products' && resolvedParams.modal === 'new'}
                        />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <CategoryList
                            externalOpen={activeTab === 'categories' && resolvedParams.modal === 'new'}
                        />
                    </TabsContent>
                    <TabsContent value="pricing-rules" className="mt-0 outline-none">
                        <PricingRuleList
                            externalOpen={activeTab === 'pricing-rules' && resolvedParams.modal === 'new'}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
