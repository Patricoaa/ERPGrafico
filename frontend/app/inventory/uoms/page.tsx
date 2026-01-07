"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UoMList } from "@/components/inventory/UoMList"
import { UoMCategoryList } from "@/components/inventory/UoMCategoryList"
import { Scale, Layers } from "lucide-react"

export default function UnifiedUoMPage() {
    const [activeTab, setActiveTab] = useState("units")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Unidades de Medida</h2>
                    <p className="text-muted-foreground">Configura las unidades y categorías para el control de inventario.</p>
                </div>
            </div>

            <Tabs defaultValue="units" className="space-y-4" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-sm grid-cols-2 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="units" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Scale className="h-4 w-4" />
                            <span>Unidades</span>
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Layers className="h-4 w-4" />
                            <span>Categorías</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="pt-4">
                    <TabsContent value="units" className="mt-0 outline-none">
                        <UoMList />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <UoMCategoryList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
