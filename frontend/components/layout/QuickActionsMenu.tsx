"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShoppingBag, ShoppingCart, Printer, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const actions = [
    {
        title: "Inicio",
        icon: Home,
        url: "/",
        color: "text-blue-500",
    },
    {
        title: "POS",
        icon: ShoppingCart, // Matches 'sales' category in sidebar
        url: "/sales/pos",
        color: "text-emerald-500",
    },
    {
        title: "Órdenes de Compra",
        icon: ShoppingBag, // Matches 'purchasing' category in sidebar
        url: "/purchasing/orders",
        color: "text-amber-500",
    },
    {
        title: "Órdenes de Trabajo",
        icon: Printer, // Matches 'production' category in sidebar
        url: "/production/orders",
        color: "text-purple-500",
    },
]

export function QuickActionsMenu() {
    const pathname = usePathname()

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 p-2 bg-sidebar/80 backdrop-blur-xl border border-sidebar-border/50 rounded-2xl shadow-2xl pointer-events-auto ring-1 ring-black/5">
                <TooltipProvider delayDuration={0}>
                    {actions.map((action) => {
                        const isActive = pathname === action.url
                        const Icon = action.icon

                        return (
                            <Tooltip key={action.url}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={action.url}
                                        className={cn(
                                            "relative flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className={cn("h-5 w-5 transition-colors", !isActive && "group-hover:" + action.color)} />
                                        {isActive && (
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full" />
                                        )}
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-foreground text-background font-medium">
                                    {action.title}
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </TooltipProvider>
            </div>
        </div>
    )
}
