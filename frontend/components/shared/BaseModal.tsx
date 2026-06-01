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
import { PanelHeader, type PanelBaseProps } from "./PanelHeader"

export type BaseModalVariant = "default" | "transaction" | "wizard" | "form-tabs" | "raw"

export interface BaseModalProps extends
    Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title">,
    VariantProps<typeof dialogContentVariants>,
    PanelBaseProps {
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
        isTransaction && "tracking-tight text-primary-foreground"
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

    const iconElement: React.ReactNode = icon
        ? (typeof icon === "function" || (typeof icon === "object" && "render" in (icon as any)))
            ? React.createElement(icon as React.ComponentType<{ className?: string }>, {
                className: cn("h-9 w-9 flex-shrink-0", isTransaction ? "text-primary-foreground" : "text-muted-foreground/80")
            })
            : icon as React.ReactNode
        : null

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
                        <PanelHeader
                            icon={iconElement}
                            title={
                                <DialogTitle className={titleStyles}>
                                    {title}
                                </DialogTitle>
                            }
                            description={description ? (
                                <DialogDescription
                                    asChild={typeof description !== "string"}
                                    className={descriptionStyles}
                                >
                                    {description}
                                </DialogDescription>
                            ) : undefined}
                            headerActions={headerActions}
                        />
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

