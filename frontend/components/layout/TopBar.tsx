"use client"

import { Search, User, Settings, LogOut, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { useRouter } from "next/navigation"

export function TopBar() {
    const router = useRouter()

    const handleLogout = () => {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        router.push("/login")
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-sidebar-border/5">
            {/* Left: Optional breadcrumbs */}
            <div className="flex-1 md:flex-none">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest opacity-50">ERP Sistema</p>
            </div>

            {/* Center: Search Bar */}
            <div className="relative w-full max-w-lg mx-8">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                    placeholder="Buscar cualquier cosa..."
                    className="w-full pl-12 bg-muted/30 border-none h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground/30 shadow-inner"
                />
            </div>

            {/* Right: Notifications & User Profile */}
            <div className="flex items-center gap-6 flex-1 justify-end">
                <Button variant="ghost" size="icon" className="relative text-muted-foreground/60 hover:text-primary transition-colors">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-11 w-11 rounded-2xl p-0 hover:scale-105 transition-transform">
                            <Avatar className="h-11 w-11 border-2 border-primary/10 shadow-lg">
                                <AvatarImage src="" alt="User" />
                                <AvatarFallback className="bg-primary/5 text-primary font-bold">JD</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">Administrador</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    admin@erpgrafico.com
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/profile")}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Mi Perfil</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/settings")}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Configuración</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
