"use client"

import React, { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShoppingBag, ShoppingCart, Printer, Home, Inbox, Calculator, Users } from "lucide-react"

// Lazy load: solo se descarga y compila cuando el usuario abre la calculadora
const CostCalculatorModal = dynamic(
    () => import("@/components/tools/CostCalculatorModal").then(m => ({ default: m.CostCalculatorModal })),
    { ssr: false }
)
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { getTasks } from "@/lib/workflow/api"
import { PermissionGuard } from "@/components/auth/PermissionGuard"

const actions = [
    {
        title: "Inicio",
        icon: Home,
        url: "/",
        color: "text-primary",
        permission: null,
    },
    {
        title: "POS",
        icon: ShoppingCart,
        url: "/pos",
        color: "text-emerald-500",
        permission: "sales.view_dashboard_sales",
    },
    {
        title: "Órdenes de Compra",
        icon: ShoppingBag,
        url: "/purchasing/orders",
        color: "text-amber-500",
        permission: "purchasing.view_dashboard_purchasing",
    },
    {
        title: "Órdenes de Trabajo",
        icon: Printer,
        url: "/production/orders",
        color: "text-purple-500",
        permission: "production.view_dashboard_production",
    },
    {
        title: "Contactos",
        icon: Users,
        url: "/contacts",
        color: "text-indigo-500",
        permission: "contacts.view_dashboard_contacts",
    },
]

interface QuickActionsMenuProps {
    isInboxOpen?: boolean
    onInboxToggle?: () => void
}

export function QuickActionsMenu({ isInboxOpen, onInboxToggle }: QuickActionsMenuProps) {
    const pathname = usePathname()
    const [pendingCount, setPendingCount] = useState(0)
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)

    const fetchTaskCounts = async () => {
        try {
            // Fetch approval tasks (pending)
            const approvalsRes = await getTasks({ category: 'APPROVAL', status: 'PENDING' })
            const approvals = Array.isArray(approvalsRes) ? approvalsRes : (approvalsRes.results || [])

            // Fetch operational tasks (pending)
            const tasksRes = await getTasks({ category: 'TASK', status: 'PENDING' })
            const tasks = Array.isArray(tasksRes) ? tasksRes : (tasksRes.results || [])

            setPendingCount(approvals.length + tasks.length)
        } catch (error) {
            console.error("Error fetching task counts", error)
        }
    }

    useEffect(() => {
        fetchTaskCounts()
        // Refresh every 120s
        const interval = setInterval(fetchTaskCounts, 120000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2 p-2 bg-sidebar border border-sidebar-border rounded-2xl shadow-2xl pointer-events-auto">
                <TooltipProvider delayDuration={0}>
                    {actions.map((action) => {
                        const isActive = pathname === action.url
                        const Icon = action.icon

                        return (
                            <PermissionGuard permission={action.permission || undefined} key={action.url}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={action.url}
                                            target={action.title === "POS" ? "_blank" : undefined}
                                            className={cn(
                                                "relative flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                    : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                            </PermissionGuard>
                        )
                    })}

                    {/* Inbox Toggle Button */}
                    <div className="w-px h-8 bg-sidebar-border/50 mx-1" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={onInboxToggle}
                                className={cn(
                                    "relative flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95",
                                    isInboxOpen
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <Inbox className={cn("h-5 w-5 transition-colors", !isInboxOpen && "group-hover:text-primary")} />
                                {isInboxOpen && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full" />
                                )}
                                {pendingCount > 0 && !isInboxOpen && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-white text-[10px] font-bold rounded-full px-1 shadow-sm border border-background">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-foreground text-background font-medium">
                            Bandeja de Entrada {pendingCount > 0 && `(${pendingCount})`}
                        </TooltipContent>
                    </Tooltip>

                    {/* Calculator Toggle Button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setIsCalculatorOpen(true)}
                                className={cn(
                                    "relative flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-300 group hover:scale-110 active:scale-95",
                                    isCalculatorOpen
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <Calculator className={cn("h-5 w-5 transition-colors", !isCalculatorOpen && "group-hover:text-purple-500")} />
                                {isCalculatorOpen && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full" />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-foreground text-background font-medium">
                            Calculadora de Costos
                        </TooltipContent>
                    </Tooltip>

                    <CostCalculatorModal open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
                </TooltipProvider>
            </div>
        </div>
    )
}
