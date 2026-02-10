"use client"

import { useState } from "react"
import { AttributeManager } from "@/components/inventory/AttributeManager"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function AttributesPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Atributos de Variantes"
                description="Gestiona los atributos y valores para productos con variaciones."
                titleActions={
                    <Button
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => setIsModalOpen(true)}
                        title="Nuevo Atributo"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                }
            />
            <AttributeManager externalOpen={isModalOpen} onExternalOpenChange={setIsModalOpen} />
        </div>
    )
}
