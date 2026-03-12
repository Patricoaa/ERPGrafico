import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Building2, Shield, History, FileText, Database } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function SettingsPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader title="Configuración del Sistema" iconName="settings" />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/settings/company">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-primary">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Building2 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Empresa</CardTitle>
                                <CardDescription>Datos fiscales y logotipos.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>

                <Link href="/settings/accounting">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-blue-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Database className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Contabilidad</CardTitle>
                                <CardDescription>Cuentas predeterminadas y flujos base.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>

                <Link href="/settings/tax">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-amber-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <FileText className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Impuestos</CardTitle>
                                <CardDescription>Tasas IVA, PPM y cuentas de cumplimiento.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>

                <Link href="/settings/users">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-emerald-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Shield className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Usuarios y Permisos</CardTitle>
                                <CardDescription>Gestión de accesos y roles.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>


                <Link href="/settings/audit">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-slate-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <History className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Auditoría</CardTitle>
                                <CardDescription>Historial de actividades y logs del sistema.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>

                <Link href="/settings/workflow">
                    <IndustrialCard variant="industrial" className="cursor-pointer hover:border-primary border-t-purple-500">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Settings className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Workflow</CardTitle>
                                <CardDescription>Configuración de tareas y asignaciones automáticas.</CardDescription>
                            </div>
                        </CardHeader>
                    </IndustrialCard>
                </Link>


            </div>

            <IndustrialCard variant="industrial" className="border-t-slate-200">
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
                        <span className="text-green-500 font-bold">Conectado</span>
                    </div>
                </CardContent>
            </IndustrialCard>
        </div>
    )
}
