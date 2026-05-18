"use client"

import React, { useState, useRef, useEffect, useCallback, useId } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { cn } from "@/lib/utils"

export interface DrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: React.ReactNode | string
    subtitle?: React.ReactNode | string
    icon?: React.ElementType
    headerActions?: React.ReactNode
    children: React.ReactNode
    
    /**
     * Desde qué borde aparece el Drawer
     */
    side?: "top" | "right" | "bottom" | "left"
    
    /**
     * Si 'screen', se ancla a toda la pantalla (document.body).
     * Si 'embedded', se ancla al contenedor del portal principal (ideal para layouts dentro de shells).
     */
    boundary?: "screen" | "embedded"
    
    /**
     * Si se permite redimensionar arrastrando el borde exterior.
     */
    resizable?: boolean
    
    /**
     * Si se debe mostrar un fondo oscuro difuminado detrás del Drawer.
     */
    showOverlay?: boolean

    /**
     * Tamaño inicial (ancho si es horizontal, alto si es vertical).
     */
    defaultSize?: number | string
    minSize?: number | string
    maxSize?: number | string
    
    className?: string
    contentClassName?: string
}

export function Drawer({
    open,
    onOpenChange,
    title,
    subtitle,
    icon: Icon,
    headerActions,
    children,
    side = "bottom",
    boundary = "embedded",
    resizable = false,
    showOverlay = false,
    defaultSize,
    minSize,
    maxSize,
    className,
    contentClassName
}: DrawerProps) {
    const isHorizontal = side === "left" || side === "right"
    const [size, setSize] = useState<number | string>(
        defaultSize ?? (isHorizontal ? "400px" : "75vh")
    )

    // Synchronize default size if it changes dynamically
    useEffect(() => {
        if (defaultSize !== undefined) {
            setSize(defaultSize)
        }
    }, [defaultSize])

    const containerRef = useRef<HTMLElement | null>(null)
    const uniqueId = useId()
    const contentId = `drawer-content-${uniqueId.replace(/:/g, '')}`
    
    useEffect(() => {
        if (boundary === "screen") {
            containerRef.current = document.body
        } else {
            containerRef.current = document.getElementById("main-content") || document.getElementById("module-sheets-portal-container") || document.body
        }
    }, [boundary])

    // Resizing logic
    const isResizing = useRef(false)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!resizable) return
        e.preventDefault()
        isResizing.current = true
        document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize"
        // Prevenir selección de texto mientras se arrastra
        document.body.style.userSelect = "none"
    }, [resizable, isHorizontal])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return
            
            const element = document.getElementById(contentId)
            if (!element) return
            
            const rect = element.getBoundingClientRect()
            
            if (isHorizontal) {
                const currentWidth = rect.width
                // Si movemos a la izquierda (negative movementX) y estamos en right side, aumenta el ancho.
                // Si estamos en el left side, mover a la derecha (positive movementX) aumenta el ancho.
                const newWidth = side === "right" ? currentWidth - e.movementX : currentWidth + e.movementX
                setSize(newWidth)
            } else {
                const currentHeight = rect.height
                // Si movemos hacia arriba (negative movementY) y estamos en bottom side, aumenta el alto.
                // Si estamos en top side, mover hacia abajo (positive movementY) aumenta el alto.
                const newHeight = side === "bottom" ? currentHeight - e.movementY : currentHeight + e.movementY
                setSize(newHeight)
            }
        }

        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false
                document.body.style.cursor = ""
                document.body.style.userSelect = ""
            }
        }

        if (resizable) {
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
        }
    }, [resizable, isHorizontal, side, contentId])

    // Render classes for side specific logic
    const sideStyles = {
        bottom: "rounded-t-xl border-t-0 !bottom-0 !top-auto !w-full !left-0 !right-0",
        top: "rounded-b-xl border-b-0 !top-0 !bottom-auto !w-full !left-0 !right-0",
        right: "rounded-l-xl border-l-0 !h-full !right-0 !left-auto !top-0 !bottom-0 sm:max-w-none",
        left: "rounded-r-xl border-r-0 !h-full !left-0 !right-auto !top-0 !bottom-0 sm:max-w-none",
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                id={contentId}
                side={side}
                hideOverlay={!showOverlay}
                overlayClassName={cn(boundary === "embedded" ? "absolute inset-0 rounded-xl" : "fixed inset-0")}
                hideCloseButton={true}
                container={containerRef.current || undefined}
                style={{
                    [isHorizontal ? 'width' : 'height']: size,
                    minWidth: isHorizontal ? minSize : undefined,
                    maxWidth: isHorizontal ? (maxSize ?? '100vw') : undefined,
                    minHeight: !isHorizontal ? minSize : undefined,
                    maxHeight: !isHorizontal ? (maxSize ?? '100vh') : undefined,
                    ...(side === "right" ? { right: 0, top: 0, bottom: 0, height: '100%' } : {}),
                    ...(side === "left" ? { left: 0, top: 0, bottom: 0, height: '100%' } : {}),
                    ...(side === "bottom" ? { left: 0, right: 0, bottom: 0, width: '100%' } : {}),
                    ...(side === "top" ? { left: 0, right: 0, top: 0, width: '100%' } : {})
                }}
                className={cn(
                    "p-0 bg-background flex flex-col",
                    boundary === "embedded" ? "!absolute" : "!fixed",
                    sideStyles[side],
                    className
                )}
            >
                {/* Resize handle */}
                {resizable && (
                    <div
                        onMouseDown={handleMouseDown}
                        className={cn(
                            "absolute z-[70] transition-colors hover:bg-primary/50",
                            side === "bottom" && "top-0 left-0 right-0 h-1.5 cursor-row-resize -translate-y-1/2 hover:h-2",
                            side === "top" && "bottom-0 left-0 right-0 h-1.5 cursor-row-resize translate-y-1/2 hover:h-2",
                            side === "right" && "left-0 top-0 bottom-0 w-1.5 cursor-col-resize -translate-x-1/2 hover:w-2",
                            side === "left" && "right-0 top-0 bottom-0 w-1.5 cursor-col-resize translate-x-1/2 hover:w-2"
                        )}
                    />
                )}

                {/* Visual Handle for "Drawer" feel */}
                {resizable && side === "bottom" && (
                    <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner" />
                )}
                {resizable && side === "top" && (
                    <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner order-last mt-auto" />
                )}
                {resizable && (side === "left" || side === "right") && (
                    <div className={cn(
                        "w-1.5 h-12 bg-muted-foreground/20 rounded-full my-auto mx-4 shrink-0 shadow-inner absolute top-1/2 -translate-y-1/2",
                        side === "right" ? "left-0" : "right-0"
                    )} />
                )}

                <SheetCloseButton
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 z-[60]"
                />

                {(title || subtitle) && (
                    <SheetHeader className={cn("px-8 pb-2 space-y-0 shrink-0", side === "top" ? "pt-8" : "pt-8")}>
                        <SheetTitle>
                            <div className="flex items-center gap-4">
                                {Icon && <Icon className="h-6 w-6 text-primary" />}
                                <div className="flex flex-col text-left">
                                    <span className="text-xl font-black tracking-tight text-foreground leading-none pr-8">
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
                                <div className="ml-auto mt-4">
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
