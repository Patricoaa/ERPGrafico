"use client"

import React from "react"
import { ArrowLeft, ChevronRight, Pin, PinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Chip } from "./Chip"
import type { EntityNavigation } from "./EntityNavigationContext"

/** Tramos anteriores visibles; los más antiguos se resumen en «…». */
const MAX_VISIBLE_PREVIOUS = 3

/**
 * Migas del drill-down documental dentro del drawer superior de la pila (ADR-0100).
 * Escritorio: ruta completa (cada tramo anterior desapila hasta él). Móvil: un único «Volver a X».
 * Si el documento abierto vive en otro módulo que la página, muestra el módulo (el riel no se mueve).
 */
export function EntityTrail({ navigation }: { navigation: EntityNavigation }) {
    const { trail, currentLabel, backLabel, goBack, module: documentModule, pins } = navigation
    const hidden = trail.slice(0, Math.max(0, trail.length - MAX_VISIBLE_PREVIOUS))
    const visible = trail.slice(hidden.length)
    const ModuleIcon = documentModule?.icon

    return (
        <div className="mx-4 mt-1 flex shrink-0 flex-col gap-1">
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="link"
                size="sm"
                onClick={goBack}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground sm:hidden"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a {backLabel}
            </Button>

            <nav aria-label="Ruta de documentos" className="hidden min-w-0 flex-1 sm:block">
                <ol className="flex min-w-0 items-center gap-0.5 text-xs text-muted-foreground">
                    {hidden.length > 0 && (
                        <li className="flex shrink-0 items-center gap-0.5" title={hidden.map((item) => item.label).join(" › ")}>
                            <span aria-hidden="true">…</span>
                            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </li>
                    )}
                    {visible.map((item) => (
                        <li key={item.key} className="flex min-w-0 shrink items-center gap-0.5">
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={item.onSelect}
                                title={item.label}
                                className="h-6 max-w-40 justify-start truncate px-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                                {item.label}
                            </Button>
                            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </li>
                    ))}
                    <li aria-current="page" className="min-w-0 truncate px-1 font-medium text-foreground">
                        {currentLabel}
                    </li>
                </ol>
            </nav>

            {documentModule && (
                <span className="ml-auto shrink-0" title={`Este documento pertenece a ${documentModule.label}`}>
                    <Chip size="xs" intent="info" icon={ModuleIcon}>{documentModule.label}</Chip>
                </span>
            )}

            {pins?.canPin && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={pins.toggle}
                    aria-pressed={pins.isPinned}
                    aria-label={pins.isPinned ? "Quitar de fijados" : "Fijar documento"}
                    title={pins.isPinned ? "Quitar de fijados" : "Fijar documento para volver a él"}
                    className={cn("h-6 w-6 shrink-0", !documentModule && "ml-auto", pins.isPinned ? "text-primary" : "text-muted-foreground")}
                >
                    {pins.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
            )}
        </div>

        {pins && pins.items.length > 0 && (
            <ul aria-label="Documentos fijados" className="flex flex-wrap items-center gap-1">
                {pins.items.map((pin) => (
                    <li key={pin.key}>
                        <Button
                            type="button"
                            variant={pin.active ? "secondary" : "outline"}
                            size="sm"
                            onClick={pin.onOpen}
                            aria-current={pin.active ? "page" : undefined}
                            title={pin.label}
                            className="h-6 max-w-36 gap-1 rounded-full px-2 text-xs"
                        >
                            <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{pin.label}</span>
                        </Button>
                    </li>
                ))}
            </ul>
        )}
        </div>
    )
}
