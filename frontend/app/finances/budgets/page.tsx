"use client"

import React from "react"
import { BudgetManager } from "@/components/finances/BudgetManager"

export default function BudgetsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Presupuestos</h2>
            </div>
            <BudgetManager />
        </div>
    )
}
