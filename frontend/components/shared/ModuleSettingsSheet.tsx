"use client"

import React from "react"
import { LucideIcon, CloudUpload, CloudCheck, Settings2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SheetCloseButton } from "./SheetCloseButton"

export type SavingStatus = "idle" | "saving" | "synced" | "error"

interface ModuleSettingsSheetProps {
    sheetId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    icon?: LucideIcon
    tabLabel?: string
    savingStatus?: SavingStatus
    children: React.ReactNode
    fullWidth?: number
    size?: "sm" | "md" | "lg" | "xl" | "full"
}

export function ModuleSettingsSheet({
    sheetId,
    open,
    onOpenChange,
    title,
    description,
    icon: Icon = Settings2,
    tabLabel = "Config",
    savingStatus = "idle",
    children,
    fullWidth,
    size = "md"
}: ModuleSettingsSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                hideOverlay={true}
                hideCloseButton={true}
                className="h-[85vh] sm:h-[90vh] p-0 border-t-0 bg-background rounded-t-xl shadow-[var(--shadow-overlay)] flex flex-col"
            >
                {/* Visual Handle for "Drawer" feel */}
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner" />

                <SheetCloseButton 
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-8 z-[60]"
                />

                <SheetHeader className="px-8 pb-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0 flex flex-row items-center justify-between space-y-0">
                    <SheetTitle>
                        <div className="flex items-center gap-4">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col text-left">
                                <span className="text-xl font-black tracking-tight text-foreground leading-none">{title}</span>
                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">
                                    {description || "Configuración"}
                                </span>
                            </div>
                        </div>
                    </SheetTitle>

                    {savingStatus !== "idle" && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 mr-12 relative z-[50]">
                            {savingStatus === "saving" && (
                                <>
                                    <CloudUpload className="h-3 w-3 animate-pulse text-primary" />
                                    <span className="text-primary">Guardando...</span>
                                </>
                            )}
                            {savingStatus === "synced" && (
                                <>
                                    <CloudCheck className="h-3 w-3 text-success" />
                                    <span className="text-success">Sincronizado</span>
                                </>
                            )}
                            {savingStatus === "error" && (
                                <>
                                    <div className="h-2 w-2 rounded-full bg-destructive" />
                                    <span className="text-destructive">Error</span>
                                </>
                            )}
                        </div>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar bg-card/30">
                    <div className="w-full h-full mx-auto max-w-7xl pt-6">
                        {children}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
