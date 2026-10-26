"use client"

import { Store, Calculator } from "lucide-react"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { SidebarNavItem } from "./SidebarNavItem"

/**
 * Herramientas globales fijas en el pie del panel de módulo: POS y Calculadora de Costos (esta abre como pestaña, ADR-0101).
 * Independientes del módulo activo (ADR-0079).
 */
export function SidebarQuickActions() {
    const { openTool, tabs } = useGlobalModals()
    const isCalculatorOpen = tabs.some(tab => tab.key === "tool:cost-calculator" && tab.active)

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
                    onClick={() => openTool("cost-calculator")}
                />
            </div>
        </>
    )
}
