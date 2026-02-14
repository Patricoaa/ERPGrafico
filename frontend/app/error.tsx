"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCcw } from "lucide-react"

export default function Error({
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
        <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
            <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-10 w-10" />
                <h2 className="text-2xl font-bold">Algo salió mal</h2>
            </div>
            <p className="text-muted-foreground text-center max-w-md">
                Ha ocurrido un error inesperado en la aplicación. Por favor, intenta recargar la página.
            </p>
            <Button
                variant="outline"
                onClick={() => reset()}
                className="gap-2"
            >
                <RotateCcw className="h-4 w-4" />
                Reintentar
            </Button>
        </div>
    )
}
