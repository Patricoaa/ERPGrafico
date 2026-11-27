"use client"

import { Store, Calculator } from "lucide-react"
import { Can } from "@/components/auth"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { SidebarNavItem } from "./SidebarNavItem"

/**
 * Herramientas globales del bloque de utilidades del panel (ADR-0162):
 * POS y Calculadora de Costos (esta abre como pestaña, ADR-0101), independientes del módulo activo.
 */
export function SidebarQuickActions() {
    const { openTool, tabs } = useGlobalModals()
    const isCalculatorOpen = tabs.some(tab => tab.key === "tool:cost-calculator" && tab.active)

    return (
        <>
            <Can permission="sales.view_dashboard_sales">
                <SidebarNavItem
                    label="Punto de Venta"
                    icon={Store}
                    onClick={() => window.open("/pos", "_blank")}
                />
            </Can>

            <SidebarNavItem
                label="Calculadora de Costos"
                icon={Calculator}
                isActive={isCalculatorOpen}
                onClick={() => openTool("cost-calculator")}
            />
        </>
    )
}
