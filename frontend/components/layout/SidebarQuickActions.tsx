"use client"

import { Store, Calculator } from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import { SidebarNavItem } from "./SidebarNavItem"

const CostCalculatorDrawer = dynamic(
    () => import("@/components/tools/CostCalculatorDrawer").then(m => ({ default: m.CostCalculatorDrawer })),
    { ssr: false }
)

/**
 * Herramientas globales fijas en el pie del panel de módulo: POS y Calculadora de Costos.
 * Independientes del módulo activo (ADR-0079).
 */
export function SidebarQuickActions() {
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)

    return (
        <>
            <div className="shrink-0 bg-background/40 px-2 pb-2 flex flex-col gap-px">
                <div className="h-px bg-border/60 mx-2 mb-2" aria-hidden />
                <PermissionGuard permission="sales.view_dashboard_sales">
                    <SidebarNavItem
                        label="Punto de Venta"
                        icon={Store}
                        onClick={() => window.open("/pos", "_blank")}
                    />
                </PermissionGuard>

                <SidebarNavItem
                    label="Calculadora de Costos"
                    icon={Calculator}
                    isActive={isCalculatorOpen}
                    onClick={() => setIsCalculatorOpen(true)}
                />
            </div>

            <CostCalculatorDrawer open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
        </>
    )
}
