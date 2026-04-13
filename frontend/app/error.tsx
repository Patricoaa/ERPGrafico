'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

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
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-muted/30 p-4">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <h2 className="text-xl font-heading font-black uppercase tracking-tighter">Algo salió mal</h2>
                <p className="text-sm text-muted-foreground max-w-[500px]">
                    Ha ocurrido un error inesperado. Por favor intente nuevamente.
                </p>
                {error.digest && (
                    <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>
            <Button onClick={() => reset()} variant="default">
                Intentar nuevamente
            </Button>
        </div>
    )
}

