"use client"

import { ReplenishmentDashboard } from "@/components/inventory/ReplenishmentDashboard"

export default function ReplenishmentPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Reabastecimiento</h2>
                    <p className="text-muted-foreground">
                        Define reglas de stock mínimo/máximo y gestiona propuestas de compra automáticas.
                    </p>
                </div>
            </div>
            <ReplenishmentDashboard />
        </div>
    )
}
