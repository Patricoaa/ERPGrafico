"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { VariantProps } from "class-variance-authority"
import { dialogContentVariants } from "@/components/ui/dialog"

export type BaseModalVariant = "default" | "transaction" | "wizard" | "raw"

interface BaseModalProps extends VariantProps<typeof dialogContentVariants> {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string | React.ReactNode
    description?: string | React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    headerActions?: React.ReactNode
    className?: string
    contentClassName?: string
    headerClassName?: string
    footerClassName?: string
    hideScrollArea?: boolean
    variant?: BaseModalVariant
}

export function BaseModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    headerActions,
    size = "md",
    className,
    contentClassName,
    headerClassName,
    footerClassName,
    hideScrollArea = false,
    variant = "default",
}: BaseModalProps) {
    const isTransaction = variant === "transaction"
    const isWizard = variant === "wizard"
    const isRaw = variant === "raw"

    // Dynamic styles based on variant
    const headerStyles = cn(
        "px-6 py-4 flex-shrink-0",
        isTransaction && "bg-primary text-primary-foreground border-b-0",
        isWizard && "border-b pb-2",
        !isRaw && "border-b",
        headerClassName
    )

    const titleStyles = cn(
        "text-xl font-bold flex items-center gap-2",
        isTransaction && "tracking-tight text-white",
        isWizard && "text-center w-full justify-center"
    )

    const footerStyles = cn(
        "px-6 py-4 flex-shrink-0",
        !isRaw && "border-t bg-muted/20",
        footerClassName
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                size={size}
                className={cn(
                    "p-0 overflow-hidden flex flex-col max-h-[95vh]",
                    isTransaction && "border-none shadow-2xl",
                    className
                )}
            >
                <DialogHeader className={headerStyles}>
                    <div className="flex items-center justify-between gap-4 w-full">
                        <div className={cn("flex flex-col gap-1 w-full", isWizard && "items-center")}>
                            <DialogTitle className={titleStyles}>
                                {title}
                            </DialogTitle>
                            {description && (
                                <DialogDescription
                                    asChild={typeof description !== "string"}
                                    className={cn(isTransaction && "text-primary-foreground/80")}
                                >
                                    {description}
                                </DialogDescription>
                            )}
                        </div>
                        {headerActions && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {headerActions}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {/* Content Area */}
                {hideScrollArea || isRaw ? (
                    <div className={cn("flex-1 overflow-hidden", contentClassName)}>
                        {children}
                    </div>
                ) : (
                    <ScrollArea className={cn("flex-1 p-6", contentClassName)}>
                        {children}
                    </ScrollArea>
                )}

                {/* Footer Area */}
                {footer && (
                    <DialogFooter className={footerStyles}>
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
