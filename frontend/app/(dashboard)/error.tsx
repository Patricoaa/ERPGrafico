'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <Card className="w-full max-w-md border-red-200 bg-red-50/30">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto rounded-full bg-red-100 p-3 w-fit mb-2">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-red-700">Error en el Módulo</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                        No se pudo cargar el contenido de esta sección.
                    </p>
                    <div className="text-xs font-mono text-destructive bg-red-50 p-2 rounded border border-red-100 break-words">
                        {error.message || "Error desconocido"}
                    </div>
                </CardContent>
                <CardFooter className="justify-center">
                    <Button onClick={() => reset()} variant="outline" className="border-red-200 hover:bg-red-50 hover:text-red-700">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reintentar
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
