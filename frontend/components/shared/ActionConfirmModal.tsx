"use client"

import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, AlertCircle, Info, Loader2, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ActionVariant = "default" | "destructive" | "warning" | "info"

interface ActionConfirmModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void> | void
    title: string
    description: React.ReactNode
    confirmText?: string
    cancelText?: string
    variant?: ActionVariant
    icon?: LucideIcon
}

export function ActionConfirmModal({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "default",
    icon: CustomIcon
}: ActionConfirmModalProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleConfirm = async () => {
        setIsLoading(true)
        try {
            await onConfirm()
            onOpenChange(false)
        } catch (error) {
            console.error("Action confirmation failed:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Determine styles and icons based on variant
    const getVariantConfig = () => {
        switch (variant) {
            case "destructive":
                return {
                    icon: CustomIcon || AlertCircle,
                    iconClassName: "text-destructive bg-destructive/10",
                    buttonVariant: "destructive" as const,
                    titleClassName: "text-destructive"
                }
            case "warning":
                return {
                    icon: CustomIcon || AlertTriangle,
                    iconClassName: "text-amber-600 bg-amber-50",
                    buttonVariant: "default" as const, // We'll use default button but maybe amber styling if needed
                    titleClassName: "text-amber-700"
                }
            case "info":
                return {
                    icon: CustomIcon || Info,
                    iconClassName: "text-blue-600 bg-blue-50",
                    buttonVariant: "default" as const,
                    titleClassName: "text-blue-700"
                }
            default:
                return {
                    icon: CustomIcon || AlertCircle,
                    iconClassName: "text-primary bg-primary/10",
                    buttonVariant: "default" as const,
                    titleClassName: "text-foreground"
                }
        }
    }

    const config = getVariantConfig()
    const Icon = config.icon

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="xs">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className={cn("p-2 rounded-full", config.iconClassName)}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <DialogHeader className="text-left">
                            <DialogTitle className={cn("text-xl", config.titleClassName)}>
                                {title}
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="px-1 text-muted-foreground text-sm leading-relaxed">
                        {typeof description === "string" ? (
                            <p>{description}</p>
                        ) : (
                            description
                        )}
                    </div>

                    <DialogFooter className="mt-4 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="flex-1 sm:flex-none"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant={config.buttonVariant}
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={cn(
                                "flex-1 sm:flex-none min-w-[100px]",
                                variant === "warning" && "bg-amber-600 hover:bg-amber-700 text-white border-none"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                confirmText
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
