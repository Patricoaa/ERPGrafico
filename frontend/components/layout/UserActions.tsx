"use client"

import { Store, Calculator } from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Lazy load cost calculator
const CostCalculatorDrawer = dynamic(
    () => import("@/components/tools/CostCalculatorDrawer").then(m => ({ default: m.CostCalculatorDrawer })),
    { ssr: false }
)

/**
 * Herramientas rápidas de la topbar (POS + Calculadora).
 * Buscar / Notificaciones / Bandeja viven en el panel del sidebar (SidebarUtilityNav, ADR-0079).
 */
export function UserActions() {
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)

    return (
        <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={0}>
                {/* POS Action */}
                <PermissionGuard permission="sales.view_dashboard_sales">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                href="/pos"
                                target="_blank"
                                aria-label="Punto de Venta (POS)"
                                className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors duration-200"
                            >
                                <Store className="size-5" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Punto de Venta (POS)
                        </TooltipContent>
                    </Tooltip>
                </PermissionGuard>

                {/* Calculator Action */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isCalculatorOpen ? "default" : "ghost"}
                            size="icon"
                            onClick={() => setIsCalculatorOpen(true)}
                            aria-label="Calculadora de Costos"
                            className={cn(
                                "h-10 w-10 rounded-lg transition-colors duration-200",
                                isCalculatorOpen
                                    ? ""
                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            )}
                        >
                            <Calculator className="size-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Calculadora de Costos
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <CostCalculatorDrawer open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
        </div>
    )
}
