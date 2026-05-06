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

import { getFrontendVersion, getGitHash, getBuildDate } from "@/lib/version"
import { useSystemStatus } from "@/features/settings"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function SettingsPage() {
    const { data: status, isLoading } = useSystemStatus()
    
    const feVersion = getFrontendVersion()
    const feHash = getGitHash()
    const buildDate = getBuildDate()

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
                        <CardTitle className="text-sm font-semibold">Estado del Sistema</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    {/* Frontend Status */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Frontend</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Versión</span>
                                <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">v{feVersion}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Commit</span>
                                <span className="font-mono text-muted-foreground">{feHash}</span>
                            </div>
                        </div>
                    </div>

                    {/* Backend Status */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-info" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Backend / API</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Versión</span>
                                <span className="font-mono bg-info/10 text-info px-2 py-0.5 rounded">
                                    {isLoading ? "..." : `v${status?.version || "?.?.?"}`}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Estado</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${status?.database_connected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                                    <span className={`font-bold uppercase ${status?.database_connected ? 'text-success' : 'text-destructive'}`}>
                                        {status?.database_connected ? 'Conectado' : 'Error DB'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Environment Info */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5 text-warning" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Despliegue</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Entorno</span>
                                <span className="font-bold capitalize">{status?.environment || "development"}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-[10px]">
                                <span className="text-muted-foreground">Último Build</span>
                                <span className="text-muted-foreground/70">
                                    {format(new Date(buildDate), "dd MMM, HH:mm", { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
