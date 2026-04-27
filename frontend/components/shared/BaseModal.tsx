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
import { type VariantProps } from "class-variance-authority"
import { dialogContentVariants } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { SheetCloseButton } from "./SheetCloseButton"

export type BaseModalVariant = "default" | "transaction" | "wizard" | "raw"

export interface BaseModalProps extends 
    Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title">,
    VariantProps<typeof dialogContentVariants> {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string | React.ReactNode
    description?: string | React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    headerActions?: React.ReactNode
    contentClassName?: string
    headerClassName?: string
    footerClassName?: string
    hideScrollArea?: boolean
    allowOverflow?: boolean
    variant?: BaseModalVariant
    showCloseButton?: boolean
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
    allowOverflow = false,
    variant = "default",
    showCloseButton = true,
    ...props
}: BaseModalProps) {
    const isTransaction = variant === "transaction"
    const isWizard = variant === "wizard"
    const isRaw = variant === "raw"

    const headerStyles = cn(
        "px-6 py-4 flex-shrink-0",
        isTransaction && "bg-primary text-primary-foreground border-b-0",
        isWizard && "border-b pb-2",
        !isRaw && "border-b",
        headerClassName
    )

    const titleStyles = cn(
        "text-xl font-bold flex items-center gap-2",
        isTransaction && "tracking-tight text-white"
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
                showCloseButton={false}
                className={cn(
                    "p-0 flex flex-col max-h-[95vh]",
                    allowOverflow ? "overflow-visible" : "overflow-hidden",
                    isTransaction && "border-none shadow-2xl",
                    className
                )}
                {...props}
            >
                {showCloseButton && (
                    <SheetCloseButton 
                        onClick={() => onOpenChange(false)}
                        className="absolute top-4 right-4 z-[60]"
                    />
                )}
                {!title && (
                    <DialogTitle className="sr-only">
                        Modal Window
                    </DialogTitle>
                )}
                {(title || description || headerActions) && (
                    <DialogHeader className={headerStyles}>
                        <div className="flex items-center justify-between gap-4 w-full">
                            <div className={cn("flex flex-col gap-1 w-full")}>
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
                )}

                {/* Content Area */}
                {hideScrollArea || isRaw ? (
                    <div className={cn(
                        "flex-1 flex flex-col",
                        allowOverflow ? "overflow-visible" : "overflow-hidden",
                        contentClassName
                    )}>
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

