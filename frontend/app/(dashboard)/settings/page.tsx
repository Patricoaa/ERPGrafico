"use client"

import Link from "next/link"
import { Building2, ShieldCheck, History, GitBranch, Terminal, UsersRound, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const settingsModules = [
    { 
        id: "company", 
        icon: Building2, 
        label: "Empresa", 
        description: "Datos fiscales y logotipos",
        url: "/settings/company", 
        status: "Configurado", 
        statusColor: "text-success bg-success/10" 
    },
    { 
        id: "users", 
        icon: ShieldCheck, 
        label: "Usuarios y Permisos", 
        description: "Gestión de accesos y roles",
        url: "/settings/users", 
        status: "Seguro", 
        statusColor: "text-success bg-success/10" 
    },
    { 
        id: "audit", 
        icon: History, 
        label: "Auditoría", 
        description: "Logs y actividad del sistema",
        url: "/settings/audit", 
        status: "Activo", 
        statusColor: "text-info bg-info/10" 
    },
    { 
        id: "workflow", 
        icon: GitBranch, 
        label: "Workflow", 
        description: "Tareas y automatizaciones",
        url: "/settings/workflow", 
        status: "Ejecutando", 
        statusColor: "text-success bg-success/10" 
    },
]

export default function SettingsPage() {
    return (
        <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {settingsModules.map((mod, index) => {
                    const Icon = mod.icon
                    return (
                        <Link 
                            key={mod.id} 
                            href={mod.url}
                            className="group relative flex flex-col justify-between p-5 h-32 bg-background border border-border/10 rounded-xl shadow-sm hover:shadow-md hover:border-border/30 transition-all duration-300"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold tracking-tight text-sm text-foreground">{mod.label}</span>
                                        <span className="text-[11px] text-muted-foreground line-clamp-1">{mod.description}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-auto">
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${mod.statusColor}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                    {mod.status}
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>

            <Card className="rounded-xl border-border/10 bg-muted/30 shadow-none overflow-hidden border-dashed">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Info className="w-4 h-4" />
                        <CardTitle className="text-sm font-semibold">Información del ERP</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-border/5">
                        <span className="text-xs text-muted-foreground">Versión Frontend</span>
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">v1.2.0-beta</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-border/5">
                        <span className="text-xs text-muted-foreground">Estado API</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            <span className="text-xs font-bold text-success uppercase">Conectado</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
