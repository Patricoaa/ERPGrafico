"use client"

import { AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Banner, type BannerBleed } from "./Banner"

interface StaleDataBannerProps {
    onRetry?: () => void
    className?: string
    /** Padding horizontal del host que la banda cancela para ir de borde a borde. */
    bleed?: BannerBleed
}

/** Aviso persistente de datos cacheados: el estado se lee en el icono y el fondo, nunca interrumpe. */
export function StaleDataBanner({ onRetry, className, bleed = "none" }: StaleDataBannerProps) {
    return (
        <Banner
            tone="warning"
            icon={AlertCircle}
            bleed={bleed}
            className={className}
            actions={onRetry && (
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
        >
            Mostrando datos guardados. Reconectando…
        </Banner>
    )
}
