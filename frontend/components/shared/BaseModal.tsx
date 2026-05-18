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

export type BaseModalVariant = "default" | "transaction" | "wizard" | "form-tabs" | "raw"

export interface BaseModalProps extends
    Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title">,
    VariantProps<typeof dialogContentVariants> {
    open: boolean
    onOpenChange: (open: boolean) => void
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode
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
    icon,
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
    const isFormTabs = variant === "form-tabs"
    const isRaw = variant === "raw"

    const headerStyles = cn(
        "px-6 py-4 flex-shrink-0",
        isTransaction && "bg-primary text-primary-foreground border-b-0",
        isWizard && "border-b pb-2",
        isFormTabs && "border-b bg-background/50 backdrop-blur-sm",
        !isRaw && "border-b",
        headerClassName
    )

    const titleStyles = cn(
        "text-lg font-bold min-w-0 truncate",
        isTransaction && "tracking-tight text-white"
    )

    const descriptionStyles = cn(
        "text-xs font-medium text-muted-foreground truncate",
        isTransaction && "text-primary-foreground/80"
    )

    const footerStyles = cn(
        "px-6 py-4 flex-shrink-0",
        !isRaw && "border-t",
        footerClassName
    )

    let IconElement: React.ReactNode = null
    if (icon) {
        if (typeof icon === "function" || (typeof icon === "object" && "render" in (icon as any))) {
            const IconComponent = icon as React.ComponentType<{ className?: string }>
            IconElement = <IconComponent className={cn("h-9 w-9 flex-shrink-0", isTransaction ? "text-white" : "text-muted-foreground/80")} />
        } else {
            IconElement = icon as React.ReactNode
        }
    }

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
                {(title || description || headerActions || icon) && (
                    <DialogHeader className={headerStyles}>
                        <div className="flex items-center justify-between gap-4 w-full">
                            <div className="flex flex-row items-center gap-4 min-w-0 flex-1">
                                {IconElement}
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <DialogTitle className={titleStyles}>
                                        {title}
                                    </DialogTitle>
                                    {description && (
                                        <DialogDescription
                                            asChild={typeof description !== "string"}
                                            className={descriptionStyles}
                                        >
                                            {description}
                                        </DialogDescription>
                                    )}
                                </div>
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
                        "flex-1 flex flex-col min-h-0",
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

