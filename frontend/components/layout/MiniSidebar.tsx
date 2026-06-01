"use client"

import { cn } from "@/lib/utils"

import { PermissionGuard } from "@/components/auth/PermissionGuard"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion } from "framer-motion"
import { useBranding } from "@/contexts/BrandingProvider"
import { MODULE_REGISTRY } from "@/lib/module-registry"

interface MiniSidebarProps {
    activeCategory: string | null
    onCategoryChange: (category: string) => void
    collapsed?: boolean
}

const MODULE_ORDER = ["dashboard", "accounting", "billing", "sales", "contacts", "inventory", "production", "treasury", "purchasing", "finances", "hr"] as const

const mainItems = MODULE_ORDER.map((id) => MODULE_REGISTRY[id]).filter(Boolean)

export function MiniSidebar({ activeCategory, onCategoryChange, collapsed = false }: MiniSidebarProps) {
    const { logo, company } = useBranding()

    const handleCategoryClick = (id: string) => {
        onCategoryChange(id)
    }

    const getInitials = () => {
        const companyName = company?.trade_name || company?.name
        if (companyName) {
            return companyName.substring(0, 2).toUpperCase()
        }
        return "ERP"
    }

    return (
        <aside className={cn("fixed top-0 left-0 bottom-0 w-14 flex flex-col items-center py-4 gap-6 z-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", collapsed && "-translate-x-full")}>
            {/* 1. Logo */}
            <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-primary font-black text-sm overflow-hidden shrink-0">
                {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                    getInitials()
                )}
            </div>

            {/* 2. Navigation Rail */}
            <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto overflow-x-hidden scrollbar-hide">
                <TooltipProvider delayDuration={0}>
                    {mainItems.map((item) => (
                        <PermissionGuard permission={item.permission || undefined} key={item.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => handleCategoryClick(item.id)}
                                        className={cn(
                                            "relative h-10 w-10 mx-auto flex items-center justify-center rounded-lg transition-all duration-200",
                                            activeCategory === item.id
                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                                : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {activeCategory === item.id && (
                                            <motion.div
                                                layoutId="sidebar-active-indicator"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
                                            />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="">
                                    {item.label}
                                </TooltipContent>
                            </Tooltip>
                        </PermissionGuard>
                    ))}
                </TooltipProvider>
            </div>
        </aside>
    )
}
