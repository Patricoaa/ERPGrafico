"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IndustryMark } from "@/components/shared/IndustryMark"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

interface Props {
    children?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | any | null
}

/**
 * Industrial Error Boundary
 * 
 * Protects the main layout from runtime crashes.
 * Uses getErrorMessage to safely handle diverse error shapes from the API.
 */
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
        window.location.reload()
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[400px] h-screen w-full flex-col items-center justify-center bg-background p-8 text-center animate-in fade-in duration-500">
                    <div className="relative flex h-24 w-24 items-center justify-center border border-destructive/20 bg-destructive/5 mb-8">
                        <IndustryMark 
                            positions={['top-left', 'bottom-right']} 
                            active 
                            className="text-destructive/40" 
                        />
                        <AlertTriangle className="h-10 w-10 text-destructive/60" />
                    </div>

                    <div className="max-w-md space-y-4">
                        <h2 className="text-2xl font-heading font-black uppercase tracking-tighter text-foreground">
                            Error de Sistema
                        </h2>
                        
                        <div className="p-4 border border-border/40 bg-muted/30 rounded-none">
                            <p className="text-muted-foreground text-xs font-mono break-all leading-relaxed lowercase">
                                {getErrorMessage(this.state.error) || "Error no especificado en el módulo de tesorería."}
                            </p>
                        </div>

                        <p className="text-muted-foreground/60 text-[10px] uppercase font-bold tracking-widest pt-2">
                            La operación no pudo completarse. Los logs han sido registrados.
                        </p>

                        <div className="pt-6">
                            <Button
                                variant="outline"
                                onClick={this.handleReset}
                                className="h-10 px-6 rounded-none border-foreground group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2 uppercase font-heading font-black tracking-widest text-[11px]">
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
