"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface Props {
    children?: ReactNode
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
        console.error("Uncaught error:", error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-4 text-center">
                    <div className="rounded-full bg-destructive/10 p-4 text-destructive">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Algo salió mal</h2>
                    <p className="text-muted-foreground max-w-md">
                        {this.state.error?.message || "Ha ocurrido un error inesperado."}
                    </p>
                    <Button
                        onClick={() => {
                            this.setState({ hasError: false })
                            window.location.reload()
                        }}
                    >
                        Recargar página
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}
