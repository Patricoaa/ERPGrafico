"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Factory } from "lucide-react"

export function ProductionSettingsView() {
    return (
        <div className="space-y-6">
            <Card className="border-primary/10 shadow-sm rounded-md">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Factory className="h-4 w-4" />
                        Configuración de Producción
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold">Las configuraciones de producción estarán disponibles próximamente</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-[11px] text-muted-foreground uppercase font-medium">
                        Esta sección permitirá configurar parámetros específicos para las órdenes de trabajo y listas de materiales en futuras actualizaciones.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
