import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Building2, Shield, History } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function SettingsPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader 
                title="Configuración del Sistema" 
                description="Panel de administración y parámetros globales." 
                iconName="settings" 
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/settings/company">
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card cursor-pointer hover:border-primary border-t-4 border-t-primary transition-all">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Building2 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Empresa</CardTitle>
                                <CardDescription>Datos fiscales y logotipos.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/partners">
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card cursor-pointer hover:border-primary border-t-4 border-t-accent transition-all">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Building2 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Socios y Capital</CardTitle>
                                <CardDescription>Composición societaria y aportes.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/users">
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card cursor-pointer hover:border-primary border-t-4 border-t-success transition-all">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Shield className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Usuarios y Permisos</CardTitle>
                                <CardDescription>Gestión de accesos y roles.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/audit">
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card cursor-pointer hover:border-primary border-t-4 border-t-muted-foreground/30 transition-all">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <History className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Auditoría</CardTitle>
                                <CardDescription>Historial de actividades y logs del sistema.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/workflow">
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card cursor-pointer hover:border-primary border-t-4 border-t-primary transition-all">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Settings className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Workflow</CardTitle>
                                <CardDescription>Configuración de tareas y asignaciones automáticas.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            </div>

            <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-4 border-t-border">
                <CardHeader>
                    <CardTitle>Información del ERP</CardTitle>
                    <CardDescription>Versión y estado del servidor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Versión Frontend</span>
                        <span className="font-mono">v1.2.0-beta</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estado API</span>
                        <span className="text-success font-bold">Conectado</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
