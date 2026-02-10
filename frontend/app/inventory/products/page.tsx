"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductList } from "@/components/inventory/ProductList"
import { CategoryList } from "@/components/inventory/CategoryList"
import { PricingRuleList } from "@/components/inventory/PricingRuleList"
import { Package, Tags, DollarSign } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function UnifiedProductsPage() {
    const [activeTab, setActiveTab] = useState("products")
    const [isProductModalOpen, setIsProductModalOpen] = useState(false)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)

    const tabs = [
        { value: "products", label: "Productos", icon: Package },
        { value: "categories", label: "Categorías", icon: Tags },
        { value: "pricing-rules", label: "Reglas de Precio", icon: DollarSign },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "products":
                return {
                    title: "Catálogo de Productos",
                    description: "Gestión integral de productos y sus variantes.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsProductModalOpen(true)} title="Nuevo Producto">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "categories":
                return {
                    title: "Categorías de Productos",
                    description: "Organice su catálogo mediante grupos jerárquicos.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsCategoryModalOpen(true)} title="Nueva Categoría">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "pricing-rules":
                return {
                    title: "Reglas de Precios",
                    description: "Configure descuentos y recargos dinámicos.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsPricingModalOpen(true)} title="Nueva Regla">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            default:
                return { title: "Productos", description: "", actions: null }
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
                    <TabsContent value="products" className="mt-0 outline-none">
                        <ProductList externalOpen={isProductModalOpen} onExternalOpenChange={setIsProductModalOpen} />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <CategoryList externalOpen={isCategoryModalOpen} onExternalOpenChange={setIsCategoryModalOpen} />
                    </TabsContent>
                    <TabsContent value="pricing-rules" className="mt-0 outline-none">
                        <PricingRuleList externalOpen={isPricingModalOpen} onExternalOpenChange={setIsPricingModalOpen} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
