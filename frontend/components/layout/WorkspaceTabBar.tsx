"use client"

import React, { useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calculator, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"
import { cn } from "@/lib/utils"
import { resolvePageTabs } from "./workspacePageTabs"

/**
 * Barra de trabajo permanente bajo la topbar (ADR-0101).
 * Izquierda: las páginas hermanas de la vista actual (navegación). Derecha: las pestañas efímeras de la
 * página (documentos abiertos y herramientas); se cierran al cambiar de página. El contenido de la
 * pestaña activa se muestra en el panel lateral derecho, con la lista de origen visible al lado.
 */
export function WorkspaceTabBar({ navigation }: { navigation?: NavigationConfig }) {
    const pathname = usePathname()
    const { hasPermission } = useAuth()
    const { tabs, activateTab, closeTab, openTool } = useGlobalModals()
    const listRef = useRef<HTMLDivElement>(null)

    const pageTabs = resolvePageTabs(navigation, pathname, hasPermission)
    const calculatorActive = tabs.some((tab) => tab.key === "tool:cost-calculator" && tab.active)

    // Flechas mueven el foco entre pestañas; Enter/Espacio activan (activar descarta el formulario actual).
    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        const triggers = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
        const index = triggers.findIndex((el) => el === document.activeElement)
        if (index === -1) return
        const move = (target: number) => { event.preventDefault(); triggers[(target + triggers.length) % triggers.length]?.focus() }
        if (event.key === "ArrowRight") move(index + 1)
        else if (event.key === "ArrowLeft") move(index - 1)
        else if (event.key === "Home") move(0)
        else if (event.key === "End") move(triggers.length - 1)
        else if (event.key === "Delete") {
            event.preventDefault()
            const key = triggers[index].dataset.tabKey
            if (key) closeTab(key)
        }
    }, [closeTab])

    return (
        <div className="flex-none h-9 flex items-stretch gap-2 border-b border-border/40 bg-muted/30 pl-2 pr-2 md:pl-4">
            {pageTabs.length > 0 && (
                <nav aria-label="Páginas del módulo" className="hidden md:flex min-w-0 shrink items-stretch gap-0.5 overflow-x-auto scrollbar-hide">
                    {pageTabs.map((page) => (
                        <Link
                            key={page.key}
                            href={page.href}
                            aria-current={page.active ? "page" : undefined}
                            className={cn(
                                "relative flex shrink-0 items-center px-2.5 text-xs outline-none transition-colors",
                                "focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset",
                                page.active ? "font-medium text-foreground" : "text-foreground/70 hover:text-foreground",
                            )}
                        >
                            {page.label}
                            {page.active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden />}
                        </Link>
                    ))}
                </nav>
            )}

            {pageTabs.length > 0 && tabs.length > 0 && <div className="hidden md:block w-px my-2 shrink-0 bg-border" aria-hidden />}

            <div
                ref={listRef}
                role="tablist"
                aria-label="Pestañas abiertas"
                onKeyDown={onKeyDown}
                className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto scrollbar-hide pt-1"
            >
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <div
                            key={tab.key}
                            onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); closeTab(tab.key) } }}
                            className={cn(
                                "group/tab relative -mb-px flex h-8 min-w-0 max-w-48 shrink-0 items-center rounded-t-md border border-b-0 text-xs transition-colors",
                                tab.active
                                    ? "border-border/60 bg-background text-foreground"
                                    : "border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                            )}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                role="tab"
                                id={`workspace-tab-${tab.key}`}
                                data-tab-key={tab.key}
                                aria-selected={tab.active}
                                tabIndex={tab.active ? 0 : -1}
                                title={tab.description}
                                onClick={() => activateTab(tab.key)}
                                className="h-full min-w-0 flex-1 justify-start gap-1.5 rounded-t-md rounded-b-none py-0 pl-2 pr-1 text-xs font-normal text-inherit hover:bg-transparent hover:text-inherit focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset focus-visible:border-transparent"
                            >
                                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                                <span className="truncate">{tab.title}</span>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                tabIndex={-1}
                                aria-label={`Cerrar ${tab.title}`}
                                title="Cerrar pestaña"
                                onClick={() => closeTab(tab.key)}
                                className={cn(
                                    "mr-1 size-5 shrink-0 p-0 transition-opacity hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/30",
                                    tab.active ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/tab:opacity-100 sm:focus-visible:opacity-100",
                                )}
                            >
                                <X className="h-3 w-3" aria-hidden />
                            </Button>
                        </div>
                    )
                })}
            </div>

            <div className="flex shrink-0 items-center">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openTool("cost-calculator")}
                    aria-label="Abrir Calculadora de Costos"
                    aria-pressed={calculatorActive}
                    title="Calculadora de Costos"
                    className={cn("h-7 w-7", calculatorActive ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}
                >
                    <Calculator className="h-4 w-4" aria-hidden />
                </Button>
            </div>
        </div>
    )
}
