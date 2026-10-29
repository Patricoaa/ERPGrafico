"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type ErrorPageVariant = "default" | "inline"

export interface ErrorPageProps {
    /** Título principal del error */
    title: string
    /** Descripción opcional */
    description?: string
    /** Error object (opcional, para mostrar mensaje técnico) */
    error?: Error & { digest?: string }
    /** Callback para reintentar */
    onReset?: () => void
    /** Texto del botón de reintentar */
    resetLabel?: string
    /** Variante visual */
    variant?: ErrorPageVariant
    /** Clases adicionales */
    className?: string
    /** Mostrar botón de reintentar */
    showReset?: boolean
}

const DEFAULT_RESET_LABEL = "Reintentar"

export function ErrorPage({
    title,
    description,
    error,
    onReset,
    resetLabel = DEFAULT_RESET_LABEL,
    variant = "default",
    className,
    showReset = true,
}: ErrorPageProps) {
    const isInline = variant === "inline"

    const containerClass = cn(
        "flex flex-col items-center justify-center",
        isInline ? "p-4" : "flex h-full w-full p-6",
        className
    )

    const cardClass = cn(
        "w-full max-w-md border-destructive/20 bg-destructive/5",
        isInline && "max-w-none"
    )

    const iconContainerClass = cn(
        "mx-auto rounded-md bg-destructive/10 p-3 w-fit mb-2 border border-destructive/20",
        isInline && "mb-1 p-2"
    )

    const titleClass = cn(
        "text-destructive",
        isInline ? "text-base" : "text-lg"
    )

    const descriptionClass = cn(
        "text-sm text-muted-foreground text-center",
        isInline ? "text-xs" : ""
    )

    const codeClass = cn(
        "text-xs font-mono text-destructive bg-destructive/5 p-2 rounded border border-destructive/10 break-words w-full text-center",
        isInline ? "text-3xs p-1.5" : ""
    )

    return (
        <div className={containerClass} role="alert">
            <Card className={cardClass}>
                <CardHeader className="text-center pb-2">
                    <div className={iconContainerClass}>
                        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                    </div>
                    <CardTitle className={titleClass}>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                    {description && (
                        <p className={descriptionClass}>
                            {description}
                        </p>
                    )}
                    {error && (
                        <div className={codeClass}>
                            {error.message || "Error desconocido"}
                        </div>
                    )}
                </CardContent>
                {showReset && onReset && (
                    <CardFooter className="justify-center">
                        <Button
                            onClick={onReset}
                            variant="outline"
                            className="border-destructive/20 hover:bg-destructive/5 hover:text-destructive gap-2"
                            disabled={!onReset}
                        >
                            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                            {resetLabel}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    )
}