"use client"

import { Store } from "lucide-react"
import { Can } from "@/components/auth"
import { SidebarNavItem } from "./SidebarNavItem"

/**
 * Acceso central del bloque de utilidades del panel (ADR-0162): el Punto de Venta.
 * Las herramientas de apoyo (Buscar, Calculadora, Bandeja) viven en el riel derecho (spec 2026-11-27).
 */
export function SidebarQuickActions() {
    return (
        <Can permission="sales.view_dashboard_sales">
            <SidebarNavItem
                label="Punto de Venta"
                icon={Store}
                onClick={() => window.open("/pos", "_blank")}
            />
        </Can>
    )
}
