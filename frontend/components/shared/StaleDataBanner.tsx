"use client"

import { AlertCircle, RefreshCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface StaleDataBannerProps {
    onRetry?: () => void
    className?: string
}

export function StaleDataBanner({ onRetry, className }: StaleDataBannerProps) {
    return (
        <Alert variant="warning" icon={AlertCircle} className={className}>
            <AlertDescription className="flex items-center justify-between w-full">
                <span>Mostrando datos guardados. Reconectando…</span>
                {onRetry && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetry}
                        className="h-6 px-2 text-xs"
                    >
                        <RefreshCcw className="mr-1 h-3 w-3" />
                        Reintentar
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    )
}
