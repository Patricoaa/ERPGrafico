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
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Left: Optional space or breadcrumbs if needed later */}
            <div className="flex-1 md:flex-none">
                {/* Empty on purpose if we want the search perfectly centered */}
            </div>

            {/* Center: Search Bar */}
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscador global..."
                    className="w-full pl-10 bg-muted/50 border-none h-10 focus-visible:ring-1 focus-visible:ring-primary/20"
                />
            </div>

            {/* Right: Notifications & User Profile */}
            <div className="flex items-center gap-4 flex-1 justify-end">
                <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm hover:border-primary/20 transition-all">
                                <AvatarImage src="" alt="User" />
                                <AvatarFallback className="bg-primary/10 text-primary">JD</AvatarFallback>
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
