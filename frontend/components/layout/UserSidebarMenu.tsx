"use client"

import { User, Settings, LogOut } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function UserSidebarMenu() {
    const router = useRouter()
    const { logout, user } = useAuth()

    const handleLogout = () => {
        logout()
    }

    return (
        <TooltipProvider delayDuration={0}>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="relative h-10 w-10 rounded-full text-foreground/50 hover:bg-accent hover:text-accent-foreground transition-all duration-200 active:scale-95 border-border/60"
                            >
                                <Avatar className="h-full w-full rounded-full bg-transparent">
                                    <AvatarFallback className="bg-transparent text-current font-black text-xs rounded-full">
                                        {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        {user?.username || 'Usuario'}
                    </TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-56 border-sidebar-border shadow-overlay" align="start" side="right" sideOffset={12}>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex items-center gap-2 rounded-lg bg-muted p-1.5">
                            <Avatar className="h-7 w-7 rounded-md">
                                <AvatarFallback className="rounded-md font-bold text-3xs">
                                    {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <p className="text-xs font-bold text-foreground leading-tight">
                                    {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Usuario'}
                                </p>
                                <p className="text-3xs uppercase text-muted-foreground leading-tight">{user?.groups?.[0] || 'Sin Rol'}</p>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                        <User className="mr-3 h-4 w-4 text-primary" />
                        <span className="text-xs">Perfil</span>
                    </DropdownMenuItem>
                    <PermissionGuard permission="core.change_companysettings">
                        <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                            <Settings className="mr-3 h-4 w-4 text-primary" />
                            <span className="text-xs">Configuración</span>
                        </DropdownMenuItem>
                    </PermissionGuard>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                        <LogOut className="mr-3 h-4 w-4" />
                        <span className="font-bold text-xs">Cerrar Sesión</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    )
}
