"use client"

import { usePathname } from "next/navigation"
import { Calculator, Inbox, Search, Settings, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useHeader } from "@/components/providers/HeaderProvider"
import { cn } from "@/lib/utils"

export type ToolPanel = "calculator" | "inbox"

interface ToolRailProps {
    activePanel: ToolPanel | null
    onTogglePanel: (panel: ToolPanel) => void
    onSearchOpen: () => void
    pendingTasksCount: number
    /** Antes de abrir un diálogo desde el riel (⚙): cierra el panel activo y, en móvil, el menú. */
    onDialogOpen?: () => void
    /** `rail`: columna derecha de 52 px (md+). `row`: fila en el menú de navegación móvil. */
    variant?: "rail" | "row"
}

interface RailButtonProps {
    label: string
    icon: LucideIcon
    onClick: () => void
    pressed?: boolean
    badge?: number
    tooltipSide: "left" | "bottom"
}

function RailButton({ label, icon: Icon, onClick, pressed, badge, tooltipSide }: RailButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    aria-pressed={pressed}
                    onClick={onClick}
                    className={cn(
                        "relative size-control-md text-muted-foreground hover:text-foreground",
                        pressed && "bg-accent text-accent-foreground",
                    )}
                >
                    <Icon className="size-4" aria-hidden />
                    {badge !== undefined && badge > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-4xs font-medium text-destructive-foreground">
                            {badge > 99 ? "99+" : badge}
                        </span>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="text-xs">{label}</TooltipContent>
        </Tooltip>
    )
}

/**
 * Riel derecho de herramientas de apoyo (spec 2026-11-27, enmienda ADR-0162): Buscar, Calculadora,
 * Bandeja y la configuración del módulo activo. Los paneles que abre se anclan a su izquierda.
 */
export function ToolRail({ activePanel, onTogglePanel, onSearchOpen, pendingTasksCount, onDialogOpen, variant = "rail" }: ToolRailProps) {
    const pathname = usePathname()
    const { moduleSettings } = useHeader()
    const currentModuleId = pathname.split("/").filter(Boolean)[0] || "dashboard"
    const settings = moduleSettings?.moduleId === currentModuleId ? moduleSettings.settings : null
    const isRow = variant === "row"
    const tooltipSide = isRow ? "bottom" : "left"

    return (
        <TooltipProvider delayDuration={0}>
            <div
                role="toolbar"
                aria-label="Herramientas"
                // Bajo un overlay del riel sigue clicable (globals.css); bajo otros modales, no
                data-tool-rail
                aria-orientation={isRow ? "horizontal" : "vertical"}
                className={cn(
                    "flex items-center gap-1",
                    isRow ? "flex-row px-2 py-1" : "w-[52px] shrink-0 h-full flex-col py-2 bg-muted/30",
                )}
            >
                <RailButton label="Buscar (Ctrl K)" icon={Search} onClick={onSearchOpen} tooltipSide={tooltipSide} />
                <RailButton
                    label="Calculadora de Costos"
                    icon={Calculator}
                    pressed={activePanel === "calculator"}
                    onClick={() => onTogglePanel("calculator")}
                    tooltipSide={tooltipSide}
                />
                <RailButton
                    label="Bandeja de entrada"
                    icon={Inbox}
                    pressed={activePanel === "inbox"}
                    badge={activePanel === "inbox" ? undefined : pendingTasksCount}
                    onClick={() => onTogglePanel("inbox")}
                    tooltipSide={tooltipSide}
                />
                {settings && (
                    <>
                        <div className={cn("bg-border/60", isRow ? "h-5 w-px mx-1" : "h-px w-6 my-1")} aria-hidden />
                        <RailButton label={settings.label} icon={Settings} onClick={() => { onDialogOpen?.(); settings.open() }} tooltipSide={tooltipSide} />
                    </>
                )}
            </div>
        </TooltipProvider>
    )
}
