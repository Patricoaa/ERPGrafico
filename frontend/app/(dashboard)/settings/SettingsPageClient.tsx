"use client"

import { Building2, ShieldCheck, History, GitBranch, Terminal, Info, BookOpen, ServerCog } from "lucide-react"
import { ModuleGrid, type ModuleGridItem } from "@/components/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getFrontendVersion, getGitHash, getBuildDate } from "@/lib/version"
import { useSystemStatus } from "@/features/settings"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const settingsModules: ModuleGridItem[] = [
    { 
        id: "company", 
        icon: Building2, 
        label: "Empresa", 
        description: "Datos fiscales y logotipos",
        url: "/settings/company"
    },
    { 
        id: "users", 
        icon: ShieldCheck, 
        label: "Usuarios y Permisos", 
        description: "Gestión de accesos y roles",
        url: "/settings/users"
    },
    { 
        id: "audit", 
        icon: History, 
        label: "Auditoría", 
        description: "Logs y actividad del sistema",
        url: "/settings/audit"
    },
    { 
        id: "workflow", 
        icon: GitBranch, 
        label: "Workflow", 
        description: "Tareas y automatizaciones",
        url: "/settings/workflow"
    },
    {
        id: "accounts",
        icon: BookOpen,
        label: "Cuentas Contables",
        description: "Cuentas por defecto de cada módulo",
        url: "/settings/accounts"
    },
    {
        id: "jobs",
        icon: ServerCog,
        label: "Procesos",
        description: "Importaciones y reportes",
        url: "/settings/jobs"
    },
]

export default function SettingsPageClient() {
    const { status, isLoading } = useSystemStatus()
    
    const feVersion = getFrontendVersion()
    const feHash = getGitHash()
    const buildDate = getBuildDate()

    return (
        <div className="flex flex-col space-y-8">
            <ModuleGrid items={settingsModules} />

            <Card className="rounded-md border-border/10 bg-muted/30 shadow-none overflow-hidden border-dashed">
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
                            <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Frontend</span>
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
                            <Building2 className="w-3.5 h-3.5 text-success" />
                            <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Backend / API</span>
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
                            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Despliegue</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Entorno</span>
                                <span className="font-bold capitalize">{status?.environment || "development"}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-3xs">
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
