"use client"

import { Home, Calculator, Users, ShoppingCart, FileText, Package, Printer, Banknote, ShoppingBag, Calendar, PieChart } from "lucide-react"
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
}

const mainItems = [
    { id: "dashboard", icon: Home, label: "Inicio" },
    { id: "accounting", icon: Calculator, label: "Contabilidad" },
    { id: "contacts", icon: Users, label: "Contactos" },
    { id: "sales", icon: ShoppingCart, label: "Ventas" },
    { id: "billing", icon: FileText, label: "Facturación" },
    { id: "inventory", icon: Package, label: "Inventario" },
    { id: "production", icon: Printer, label: "Producción" },
    { id: "treasury", icon: Banknote, label: "Tesorería" },
    { id: "purchasing", icon: ShoppingBag, label: "Compras" },
    { id: "services", icon: Calendar, label: "Servicios" },
    { id: "finances", icon: PieChart, label: "Finanzas" },
]

export function MiniSidebar({ activeCategory, onCategoryChange }: MiniSidebarProps) {
    return (
        <aside className="w-[70px] flex flex-col items-center py-6 gap-4 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
            <div className="mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                    ES
                </div>
            </div>

            <TooltipProvider delayDuration={0}>
                {mainItems.map((item) => (
                    <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => onCategoryChange(item.id)}
                                className={cn(
                                    "p-3 rounded-xl transition-all group relative",
                                    activeCategory === item.id
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {activeCategory === item.id && (
                                    <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                            {item.label}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </TooltipProvider>
        </aside>
    )
}
