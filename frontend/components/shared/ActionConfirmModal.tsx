"use client"

import React, { useState } from "react"
import { BaseModal } from "./BaseModal"
import { Button } from "@/components/ui/button"
import { AlertTriangle, AlertCircle, Info, Loader2, LucideIcon, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ActionVariant = "default" | "destructive" | "warning" | "info" | "success"

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
                    iconClassName: "text-warning bg-warning/10",
                    buttonVariant: "default" as const,
                    titleClassName: "text-warning"
                }
            case "info":
                return {
                    icon: CustomIcon || Info,
                    iconClassName: "text-info bg-info/10",
                    buttonVariant: "default" as const,
                    titleClassName: "text-info"
                }
            case "success":
                return {
                    icon: CustomIcon || CheckCircle2,
                    iconClassName: "text-success bg-success/10",
                    buttonVariant: "default" as const,
                    titleClassName: "text-success"
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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xs"
            title={
                <div className="flex items-center gap-4 py-1">
                    <div className={cn("p-2 rounded-full", config.iconClassName)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("text-lg font-bold", config.titleClassName)}>
                        {title}
                    </span>
                </div>
            }
            footer={
                <div className="flex gap-2 w-full justify-end">
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
                            variant === "warning" && "bg-warning hover:bg-warning/90 text-warning-foreground border-none",
                            variant === "success" && "bg-success hover:bg-success/90 text-success-foreground border-none"
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
                </div>
            }
        >
            <div className="px-1 py-4 text-muted-foreground text-sm leading-relaxed">
                {typeof description === "string" ? (
                    <p>{description}</p>
                ) : (
                    description
                )}
            </div>
        </BaseModal>
    )
}
