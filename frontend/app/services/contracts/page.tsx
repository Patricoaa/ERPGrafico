"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContractList } from "@/components/services/ContractList"
import { ServiceCategoryList } from "@/components/services/ServiceCategoryList"
import { FileText, Tags } from "lucide-react"

export default function UnifiedContractsPage() {
    const [activeTab, setActiveTab] = useState("contracts")

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Servicios y Contratos</h2>
                    <p className="text-muted-foreground">Administra tus contratos de servicios recurrentes y sus categorías.</p>
                </div>
            </div>

            <Tabs defaultValue="contracts" className="space-y-4" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-sm grid-cols-2 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="contracts" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="max-sm:hidden">Contratos</span>
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Tags className="h-4 w-4" />
                            <span className="max-sm:hidden">Categorías</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="pt-4">
                    <TabsContent value="contracts" className="mt-0 outline-none">
                        <ContractList />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <ServiceCategoryList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
