"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProductList } from "@/components/inventory/ProductList"
import { CategoryList } from "@/components/inventory/CategoryList"
import { PricingRuleList } from "@/components/inventory/PricingRuleList"
import { Package, Tags, DollarSign } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"

export default function UnifiedProductsPage() {
    const [activeTab, setActiveTab] = useState("products")

    const tabs = [
        { value: "products", label: "Productos", icon: Package },
        { value: "categories", label: "Categorías", icon: Tags },
        { value: "pricing-rules", label: "Reglas de Precio", icon: DollarSign },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Gestión de Productos"
                description="Administra tu catálogo, categorías y sus reglas de precios."
            />

            <Tabs defaultValue="products" className="space-y-4" onValueChange={setActiveTab}>
                <PageTabs tabs={tabs} />

                <div className="pt-4">
                    <TabsContent value="products" className="mt-0 outline-none">
                        <ProductList />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <CategoryList />
                    </TabsContent>
                    <TabsContent value="pricing-rules" className="mt-0 outline-none">
                        <PricingRuleList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
