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
    hideScrollArea?: boolean
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
    hideScrollArea = false,
}: BaseModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size={size} className={cn("p-0 overflow-hidden flex flex-col max-h-[95vh]", className)}>
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                {title}
                            </DialogTitle>
                            {description && (
                                <DialogDescription asChild={typeof description !== "string"}>
                                    {description}
                                </DialogDescription>
                            )}
                        </div>
                        {headerActions && (
                            <div className="flex items-center gap-2 pr-6">
                                {headerActions}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {hideScrollArea ? (
                    <div className={cn("flex-1 overflow-hidden", contentClassName)}>
                        {children}
                    </div>
                ) : (
                    <ScrollArea className={cn("flex-1 p-6", contentClassName)}>
                        {children}
                    </ScrollArea>
                )}

                {footer && (
                    <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
