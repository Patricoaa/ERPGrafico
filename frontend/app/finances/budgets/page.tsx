"use client"

import React from "react"
import { BudgetManager } from "@/components/finances/BudgetManager"
import { PageHeader } from "@/components/shared/PageHeader"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BudgetsPage() {
    const [isBudgetModalOpen, setIsBudgetModalOpen] = React.useState(false)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Presupuestos"
                description="Gestión y seguimiento de presupuestos financieros."
                titleActions={
                    <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setIsBudgetModalOpen(true)} title="Nuevo Presupuesto">
                        <Plus className="h-4 w-4" />
                    </Button>
                }
            />
            <BudgetManager externalOpen={isBudgetModalOpen} onExternalOpenChange={setIsBudgetModalOpen} />
        </div>
    )
}
