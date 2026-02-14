"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"

export default function ProductionSettingsPage() {
    const [loading] = useState(false)

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto">
            <PageHeader
                title="Configuración de Producción"
                description="Configuración del módulo de producción."
                icon={Settings}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Configuración de Producción</CardTitle>
                    <CardDescription>Las configuraciones de producción estarán disponibles próximamente</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Esta página estará disponible cuando se implementen configuraciones específicas para el módulo de producción.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
