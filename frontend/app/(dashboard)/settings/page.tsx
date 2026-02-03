
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, User, Building2, Bell, Shield, Database, ShoppingCart, History } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/settings/company">
                    <Card className="cursor-pointer hover:border-primary">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Building2 className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Empresa</CardTitle>
                                <CardDescription>Datos fiscales y logotipos.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/accounting">
                    <Card className="cursor-pointer hover:border-primary">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Database className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Contabilidad</CardTitle>
                                <CardDescription>Cuentas predeterminadas e impuestos.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/users">
                    <Card className="cursor-pointer hover:border-primary">
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
                    <Card className="cursor-pointer hover:border-primary">
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
                    <Card className="cursor-pointer hover:border-primary">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Settings className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Workflow</CardTitle>
                                <CardDescription>Configuración de tareas y asignaciones automáticas.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/settings/terminals">
                    <Card className="cursor-pointer hover:border-primary">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <ShoppingCart className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle>Terminales POS</CardTitle>
                                <CardDescription>Configuración de cajas y puntos de venta físicos.</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            </div>

            <Card>
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
            </Card>
        </div>
    )
}
