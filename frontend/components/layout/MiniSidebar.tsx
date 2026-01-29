"use client"

import { Home, Calculator, Users, ShoppingCart, FileText, Package, Printer, Banknote, ShoppingBag, Calendar, PieChart, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface MiniSidebarProps {
    activeCategory: string | null
    onCategoryChange: (category: string) => void
    onHoverCategory?: (category: string | null) => void
}

const mainItems = [
    { id: "dashboard", icon: Home, label: "Inicio" },
    { id: "accounting", icon: Calculator, label: "Contabilidad" },
    { id: "contacts", icon: Users, label: "Contactos" },
    { id: "sales", icon: ShoppingCart, label: "Ventas" },

    { id: "inventory", icon: Package, label: "Inventario" },
    { id: "production", icon: Printer, label: "Producción" },
    { id: "treasury", icon: Banknote, label: "Tesorería" },
    { id: "purchasing", icon: ShoppingBag, label: "Compras" },
    { id: "finances", icon: PieChart, label: "Finanzas" },
    { id: "tasks", icon: CheckCircle2, label: "Tareas" },
]

export function MiniSidebar({ activeCategory, onCategoryChange, onHoverCategory }: MiniSidebarProps) {
    return (
        <aside
            className="w-[70px] flex flex-col items-center py-6 gap-3 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-50"
            onMouseLeave={() => onHoverCategory?.(null)}
        >
            <div className="mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20">
                    ES
                </div>
            </div>

            <TooltipProvider delayDuration={0}>
                {mainItems.map((item) => (
                    <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => onCategoryChange(item.id)}
                                onMouseEnter={() => onHoverCategory?.(item.id)}
                                className={cn(
                                    "p-3 rounded-xl transition-all duration-200 group relative",
                                    activeCategory === item.id
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-105"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {activeCategory === item.id && (
                                    <span className="absolute left-[-15px] top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-semibold bg-sidebar text-sidebar-foreground border-sidebar-border">
                            {item.label}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </TooltipProvider>
        </aside>
    )
}
