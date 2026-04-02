"use client"

import React from "react"
import { LucideIcon, CloudUpload, CloudCheck, Settings2, X } from "lucide-react"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { Button } from "@/components/ui/button"
import { SheetTitle, SheetDescription } from "@/components/ui/sheet"

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
    fullWidth = 600
}: ModuleSettingsSheetProps) {
    return (
        <CollapsibleSheet
            sheetId={sheetId}
            open={open}
            onOpenChange={onOpenChange}
            tabLabel={tabLabel}
            tabIcon={Icon}
            fullWidth={fullWidth}
            className="flex flex-col"
        >
            {/* Header */}
            <div className="flex items-start justify-between shrink-0 p-6 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10">
                            <Icon className="h-5 w-5" />
                        </div>
                        <SheetTitle className="text-xl font-heading font-black tracking-tight text-foreground uppercase">
                            {title}
                        </SheetTitle>
                    </div>
                    {description ? (
                        <SheetDescription className="text-sm font-medium tracking-tight text-muted-foreground max-w-sm">
                            {description}
                        </SheetDescription>
                    ) : (
                        <SheetDescription className="sr-only">
                            Configuración de {title}
                        </SheetDescription>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {savingStatus !== "idle" && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-[10px] font-bold uppercase tracking-wider transition-all duration-300">
                            {savingStatus === "saving" && (
                                <>
                                    <CloudUpload className="h-3 w-3 animate-pulse text-primary" />
                                    <span className="text-primary">Guardando...</span>
                                </>
                            )}
                            {savingStatus === "synced" && (
                                <>
                                    <CloudCheck className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-600">Sincronizado</span>
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
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Cerrar</span>
                    </Button>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto w-full p-6">
                {children}
            </div>
        </CollapsibleSheet>
    )
}
