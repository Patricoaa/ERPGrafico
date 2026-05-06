import React from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { cn } from "@/lib/utils"

export interface BaseDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: React.ReactNode | string
    subtitle?: React.ReactNode | string
    icon?: React.ElementType
    headerActions?: React.ReactNode
    children: React.ReactNode
    /**
     * Altura del drawer.
     * Opciones: 'default' (75vh), 'full' (90vh), o clase de Tailwind custom (ej: 'h-[60vh]')
     */
    height?: 'default' | 'full' | string
    className?: string
    contentClassName?: string
}

export function BaseDrawer({
    open,
    onOpenChange,
    title,
    subtitle,
    icon: Icon,
    headerActions,
    children,
    height = 'default',
    className,
    contentClassName
}: BaseDrawerProps) {
    const heightClass =
        height === 'default' ? 'h-[75vh]' :
        height === 'full' ? 'h-[90vh]' :
        height

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                hideOverlay={true}
                hideCloseButton={true}
                className={cn(
                    "p-0 border-t-0 bg-background rounded-t-xl shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.25)] flex flex-col",
                    heightClass,
                    className
                )}
            >
                {/* Visual Handle for "Drawer" feel */}
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner" />

                <SheetCloseButton
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 z-[60]"
                />

                {(title || subtitle) && (
                    <SheetHeader className="px-8 pb-2 space-y-0 shrink-0">
                        <SheetTitle>
                            <div className="flex items-center gap-4">
                                {Icon && <Icon className="h-6 w-6 text-primary" />}
                                <div className="flex flex-col text-left">
                                    <span className="text-xl font-black tracking-tight text-foreground leading-none">
                                        {title}
                                    </span>
                                    {subtitle && (
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">
                                            {subtitle}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {headerActions && (
                                <div className="ml-auto">
                                    {headerActions}
                                </div>
                            )}
                        </SheetTitle>
                    </SheetHeader>
                )}

                <div className={cn("flex-1 overflow-y-auto px-8 pb-8 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent", contentClassName)}>
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    )
}
