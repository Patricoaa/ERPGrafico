"use client"

import React, { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { UoMList } from "@/components/inventory/UoMList"
import { UoMCategoryList } from "@/components/inventory/UoMCategoryList"
import { Scale, Layers } from "lucide-react"
import { PageTabs } from "@/components/shared/PageTabs"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function UnifiedUoMPage() {
    const [activeTab, setActiveTab] = useState("units")
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

    const tabs = [
        { value: "units", label: "Unidades", icon: Scale },
        { value: "categories", label: "Categorías", icon: Layers },
    ]

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "units":
                return {
                    title: "Unidades de Medida",
                    description: "Gestión de unidades (Kg, Mts, Un, etc.) y sus equivalencias.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsUoMModalOpen(true)} title="Nueva Unidad">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            case "categories":
                return {
                    title: "Categorías de Unidades",
                    description: "Agrupe unidades relacionadas para facilitar conversiones.",
                    actions: (
                        <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsCategoryModalOpen(true)} title="Nueva Categoría">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )
                }
            default:
                return { title: "Unidades", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <PageTabs tabs={tabs} maxWidth="max-w-sm" />

                <PageHeader
                    title={title}
                    description={description}
                    titleActions={actions}
                />

                <div className="pt-4">
                    <TabsContent value="units" className="mt-0 outline-none">
                        <UoMList externalOpen={isUoMModalOpen} onExternalOpenChange={setIsUoMModalOpen} />
                    </TabsContent>
                    <TabsContent value="categories" className="mt-0 outline-none">
                        <UoMCategoryList externalOpen={isCategoryModalOpen} onExternalOpenChange={setIsCategoryModalOpen} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
