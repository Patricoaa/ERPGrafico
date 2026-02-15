"use client"

import React, { useState } from "react"
import { TabsContent } from "@/components/ui/tabs"
import { UoMList } from "@/components/inventory/UoMList"
import { UoMCategoryList } from "@/components/inventory/UoMCategoryList"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface UoMsViewProps {
    activeTab: string
}

export function UoMsView({ activeTab }: UoMsViewProps) {
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

    const getHeaderConfig = () => {
        switch (activeTab) {
            case "units":
                return {
                    title: "Unidades de Medida",
                    description: "Gestión de unidades (Kg, Mts, Un, etc.) y sus equivalencias.",
                    actions: (
                        <PageHeaderButton
                            onClick={() => setIsUoMModalOpen(true)}
                            icon={Plus}
                            circular
                            title="Nueva Unidad"
                        />
                    )
                }
            case "categories":
                return {
                    title: "Categorías de Unidades",
                    description: "Agrupe unidades relacionadas para facilitar conversiones.",
                    actions: (
                        <PageHeaderButton
                            onClick={() => setIsCategoryModalOpen(true)}
                            icon={Plus}
                            circular
                            title="Nueva Categoría"
                        />
                    )
                }
            default:
                return { title: "Unidades", description: "", actions: null }
        }
    }

    const { title, description, actions } = getHeaderConfig()

    return (
        <>
            <PageHeader
                title={title}
                description={description}
                titleActions={actions}
            />

            <div className="pt-4">
                <TabsContent value="units" className="mt-0 outline-none">
                    {activeTab === "units" && (
                        <UoMList
                            externalOpen={isUoMModalOpen}
                            onExternalOpenChange={setIsUoMModalOpen}
                        />
                    )}
                </TabsContent>
                <TabsContent value="categories" className="mt-0 outline-none">
                    {activeTab === "categories" && (
                        <UoMCategoryList
                            externalOpen={isCategoryModalOpen}
                            onExternalOpenChange={setIsCategoryModalOpen}
                        />
                    )}
                </TabsContent>
            </div>
        </>
    )
}
