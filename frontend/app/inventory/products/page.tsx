"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductList } from "@/components/inventory/ProductList"
import { CategoryList } from "@/components/inventory/CategoryList"
import { UoMList } from "@/components/inventory/UoMList"
import { Package, Tags, Scale } from "lucide-react"

export default function UnifiedProductsPage() {
    const [activeTab, setActiveTab] = useState("products")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gestión de Productos</h2>
                    <p className="text-muted-foreground">Administra tu catálogo, categorías y unidades de medida.</p>
                </div>
            </div>

            <Tabs defaultValue="products" className="space-y-4" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="products" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Package className="h-4 w-4" />
                            <span className="max-sm:hidden">Productos</span>
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Tags className="h-4 w-4" />
                            <span className="max-sm:hidden">Categorías</span>
                        </TabsTrigger>
                        <TabsTrigger value="uoms" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Scale className="h-4 w-4" />
                            <span className="max-sm:hidden">Unidades</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="pt-4">
                    <TabsContent value="products" className="mt-0 outline-none">
                        <ProductList />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <CategoryList />
                    </TabsContent>
                    <TabsContent value="uoms" className="mt-0 outline-none">
                        <UoMList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
