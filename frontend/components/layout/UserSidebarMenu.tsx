"use client"

import { LogOut, User } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
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
import { Blobatar } from "@/components/ui/blobatar"
import { Button } from "@/components/ui/button"

interface UserSidebarMenuProps {
    onProfileOpen: () => void
    onNavigate?: () => void
    /** `row` para el pie del panel (ADR-0162); `icon` para el extinto riel de módulos. */
    variant?: "row" | "icon"
}

/**
 * Menú del avatar: perfil y sesión. En el panel se muestra como fila «Cuenta»;
 * las notificaciones viven en la Bandeja de Entrada (pestaña Avisos).
 */
export function UserSidebarMenu({ onProfileOpen, onNavigate, variant = "row" }: UserSidebarMenuProps) {
    const { logout, user } = useAuth()
    const userLabel = user?.username || "Usuario"

    const rowTrigger = (
        <Button
            type="button"
            variant="ghost"
            className="group/navitem h-control-sm w-full cursor-pointer justify-start gap-2 px-2 text-xs font-normal text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
        >
            <Blobatar name={userLabel} className="h-4 w-4 shrink-0 rounded-full" />
            <span className="flex-1 min-w-0 truncate text-left">Cuenta</span>
        </Button>
    )

    const iconTrigger = (
        <Button
            variant="outline"
            size="icon"
            aria-label={userLabel}
            className="h-control-sm w-8 cursor-pointer rounded-full text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95 border-0 bg-transparent shadow-none"
        >
            <Blobatar name={userLabel} className="h-full w-full rounded-full bg-transparent" />
        </Button>
    )

    return (
        <TooltipProvider delayDuration={0}>
            <DropdownMenu>
                {variant === "row" ? (
                    <DropdownMenuTrigger asChild>{rowTrigger}</DropdownMenuTrigger>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>{iconTrigger}</DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {userLabel}
                        </TooltipContent>
                    </Tooltip>
                )}
                <DropdownMenuContent className="w-64 border-sidebar-border shadow-overlay p-0" align="end" side="right" sideOffset={12}>
                    <DropdownMenuLabel className="font-normal p-1.5">
                        <div className="flex items-center gap-2 rounded-lg bg-muted p-1.5">
                            <Blobatar name={userLabel} className="h-7 w-7 rounded-md" />
                            <div className="flex flex-col">
                                <p className="text-xs font-bold text-foreground leading-tight">
                                    {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || userLabel}
                                </p>
                                <p className="text-3xs uppercase text-muted-foreground leading-tight">{user?.groups?.[0]?.name || 'Sin Rol'}</p>
                            </div>
                        </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />
                    <div className="p-1">
                        <DropdownMenuItem onClick={() => { onProfileOpen(); onNavigate?.() }} className="cursor-pointer">
                            <User className="mr-3 h-4 w-4 text-primary" />
                            <span className="text-xs">Perfil</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="mr-3 h-4 w-4" />
                            <span className="text-xs font-medium">Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    )
}
