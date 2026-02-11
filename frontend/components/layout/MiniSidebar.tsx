"use client"

import { Home, Calculator, Users, ShoppingCart, Package, Printer, Banknote, ShoppingBag, PieChart, User, Settings, LogOut, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/PermissionGuard"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface MiniSidebarProps {
    activeCategory: string | null
    onCategoryChange: (category: string) => void
    onHoverCategory?: (category: string | null) => void
}

const mainItems = [
    { id: "dashboard", icon: Home, label: "Inicio", permission: null },
    { id: "accounting", icon: Calculator, label: "Contabilidad", permission: "accounting.view_dashboard_accounting" },
    { id: "contacts", icon: Users, label: "Contactos", permission: "contacts.view_dashboard_contacts" },
    { id: "sales", icon: ShoppingCart, label: "Ventas", permission: "sales.view_dashboard_sales" },
    { id: "inventory", icon: Package, label: "Inventario", permission: "inventory.view_dashboard_inventory" },
    { id: "production", icon: Printer, label: "Producción", permission: "production.view_dashboard_production" },
    { id: "treasury", icon: Banknote, label: "Tesorería", permission: "treasury.view_dashboard_treasury" },
    { id: "purchasing", icon: ShoppingBag, label: "Compras", permission: "purchasing.view_dashboard_purchasing" },
    { id: "finances", icon: PieChart, label: "Finanzas", permission: "finances.view_dashboard_finances" },
    { id: "tax", icon: FileText, label: "Impuestos", permission: "tax.view_f29declaration" },
]
// Note: original list ended at finances. Did I miss billing in original file?
// Original: 
// { id: "finances", icon: PieChart, label: "Finanzas" },
// ]
// But wait, the user's file had:
// { id: "finances", icon: PieChart, label: "Finanzas" },
// ]
// There was no "billing" item in the sidebar previously. 
// If it wasn't there, maybe I shouldn't add it unless requested.
// But the app "billing" exists. 
// Let's stick to modifying the EXISTING items.
// I see I added permission fields to existing items.


export function MiniSidebar({ activeCategory, onCategoryChange, onHoverCategory }: MiniSidebarProps) {
    const router = useRouter()
    const { logout, user } = useAuth()

    const handleLogout = () => {
        logout()
    }

    return (
        <aside
            className="w-[70px] flex flex-col items-center py-6 gap-3 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-50"
            onMouseLeave={() => onHoverCategory?.(null)}
        >
            {/* Logo */}
            <div className="mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20">
                    ES
                </div>
            </div>

            {/* Main Navigation Items */}
            <TooltipProvider delayDuration={0}>
                <div className="flex-1 flex flex-col gap-3">
                    {mainItems.map((item) => (
                        <PermissionGuard permission={item.permission || undefined} key={item.id}>
                            <Tooltip>
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
                        </PermissionGuard>
                    ))}
                </div>

                {/* User Menu at Bottom */}
                <div className="mt-auto pt-4 border-t border-sidebar-border/50">
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="p-0 rounded-xl hover:scale-105 transition-transform">
                                        <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-lg">
                                            <AvatarImage src="" alt="User" />
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-semibold bg-sidebar text-sidebar-foreground border-sidebar-border">
                                {user?.username || 'Usuario'}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent className="w-56" align="end" side="right">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user?.username || 'Usuario'}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user?.groups?.[0] || 'Sin Rol'}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push("/profile")}>
                                <User className="mr-2 h-4 w-4" />
                                <span>Mi Perfil</span>
                            </DropdownMenuItem>
                            <PermissionGuard permission="core.change_companysettings">
                                <DropdownMenuItem onClick={() => router.push("/settings")}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Configuración</span>
                                </DropdownMenuItem>
                            </PermissionGuard>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Cerrar Sesión</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TooltipProvider>
        </aside>
    )
}
