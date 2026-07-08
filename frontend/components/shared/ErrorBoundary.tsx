"use client"

import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw, AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getErrorMessage } from "@/lib/errors"

interface Props {
    children?: ReactNode
    variant?: "fullscreen" | "inline"
    fallbackRender?: (error: Error, reset: () => void) => ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught industrial error:", error, errorInfo)
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    private handleFullReset = () => {
        this.setState({ hasError: false, error: null })
        window.location.reload()
    }

    public render() {
        if (this.state.hasError) {
            const { variant = "fullscreen", fallbackRender } = this.props
            const error = this.state.error ?? new Error("Error desconocido")

            if (fallbackRender) {
                return fallbackRender(error, this.handleReset)
            }

            if (variant === "inline") {
                return (
                    <div className="flex h-full w-full items-center justify-center p-6">
                        <Card className="w-full max-w-md border-destructive/20 bg-destructive/5">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto rounded-md bg-destructive/10 p-3 w-fit mb-2 border border-destructive/20">
                                    <AlertCircle className="h-6 w-6 text-destructive" />
                                </div>
                                <CardTitle className="text-destructive">Error en el Módulo</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    No se pudo cargar el contenido de esta sección.
                                </p>
                                <div className="text-xs font-mono text-destructive bg-destructive/5 p-2 rounded border border-destructive/10 break-words">
                                    {error.message || "Error desconocido"}
                                </div>
                            </CardContent>
                            <CardFooter className="justify-center">
                                <Button onClick={this.handleReset} variant="outline" className="border-destructive/20 hover:bg-destructive/5 hover:text-destructive">
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Reintentar
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )
            }

            return (
                <div className="flex min-h-[400px] h-screen w-full flex-col items-center justify-center bg-background p-8 text-center animate-in fade-in duration-500">
                    <div className="relative flex h-24 w-24 items-center justify-center border border-destructive/20 bg-destructive/5 mb-8">
                        <AlertTriangle className="h-10 w-10 text-destructive/60" />
                    </div>

                    <div className="max-w-md space-y-4">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground">
                            Error de Sistema
                        </h2>

                        <div className="p-4 border border-border/40 bg-muted/30 rounded-none">
                            <p className="text-muted-foreground text-xs font-mono break-all leading-relaxed lowercase">
                                {getErrorMessage(error) || "Error no especificado en el módulo de tesorería."}
                            </p>
                        </div>

                        <p className="text-muted-foreground/60 text-[10px] uppercase font-bold tracking-widest pt-2">
                            La operación no pudo completarse. Los logs han sido registrados.
                        </p>

                        <div className="pt-6">
                            <Button
                                variant="outline"
                                onClick={this.handleFullReset}
                                className="h-10 px-6 rounded-none border-foreground group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2 uppercase font-black tracking-widest text-[11px]">
                                    <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-500" />
                                    Reiniciar Interfaz
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
