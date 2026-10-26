"use client"

import React, { useCallback, useRef, type ReactNode } from "react"
import Link from "next/link"
import { X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DynamicIcon } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { cn } from "@/lib/utils"

export interface WorkspacePage {
    title: string
    description?: string
    icon?: LucideIcon
    iconName?: string
    isLoading?: boolean
}

interface WorkspaceTabBarProps {
    /** Vista elegida en el riel; `null` mientras ninguna ha publicado su header. */
    page: WorkspacePage | null
    /** Migas profundas de la vista (tras el título). */
    breadcrumbs?: { label: string; href?: string }[]
    /** Estado, acciones y controles propios de la vista (a la derecha). */
    actions?: ReactNode
    /** Extremo izquierdo (botón de navegación en móvil). */
    leading?: ReactNode
    /** Extremo derecho (acciones del usuario). */
    trailing?: ReactNode
}

const TAB_BASE = "group/tab relative -mb-px flex h-9 min-w-0 shrink-0 items-center rounded-t-md border border-b-0 text-xs transition-colors"
const TAB_ACTIVE = "border-border/60 bg-background text-foreground"
const TAB_IDLE = "border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
const TAB_TRIGGER = "h-full min-w-0 flex-1 justify-start gap-1.5 rounded-t-md rounded-b-none py-0 pl-2.5 pr-2 text-xs font-normal text-inherit hover:bg-transparent hover:text-inherit focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset focus-visible:border-transparent"

/**
 * Barra de trabajo: primer panel del viewport (ADR-0101, sustituye a la topbar).
 * Una sola fila de pestañas con el mismo estilo: la de la página elegida en el riel (la lista), las de
 * los documentos abiertos desde ella y, si se eligió en el riel, la de la Calculadora de Costos.
 * Las pestañas de documento y herramienta se cierran al cambiar de página; la de la página no se cierra.
 * El contenido de la pestaña activa se abre en el panel derecho, con la lista visible al lado.
 */
export function WorkspaceTabBar({ page, breadcrumbs, actions, leading, trailing }: WorkspaceTabBarProps) {
    const { tabs, activateTab, closeTab, showPage } = useGlobalModals()
    const listRef = useRef<HTMLDivElement>(null)
    const pageActive = !tabs.some((tab) => tab.active)

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

    const PageIcon = page?.icon

    return (
        <div className="flex-none h-12 flex items-end gap-2 border-b border-border/40 bg-muted/30 pl-2 pr-2 md:pl-4 md:pr-3 z-30">
            {leading}

            {/* Título de la vista = único <h1> de la página (ADR-0079); la pestaña lo muestra. */}
            <h1 className="sr-only">{page?.title}</h1>

            <div
                ref={listRef}
                role="tablist"
                aria-label="Pestañas abiertas"
                onKeyDown={onKeyDown}
                className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto scrollbar-hide"
            >
                <div className={cn(TAB_BASE, "max-w-64", pageActive ? TAB_ACTIVE : TAB_IDLE)}>
                    <Button
                        type="button"
                        variant="ghost"
                        role="tab"
                        aria-selected={pageActive}
                        tabIndex={pageActive ? 0 : -1}
                        title={page?.description || page?.title}
                        onClick={showPage}
                        className={cn(TAB_TRIGGER, "font-medium")}
                    >
                        {page ? (
                            <>
                                {!page.isLoading && (PageIcon
                                    ? <PageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    : page.iconName ? <DynamicIcon name={page.iconName} className="h-3.5 w-3.5 shrink-0" /> : null)}
                                <span className="truncate">{page.title}</span>
                            </>
                        ) : (
                            <Skeleton className="h-3.5 w-24" aria-hidden />
                        )}
                    </Button>
                </div>

                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <div
                            key={tab.key}
                            onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); closeTab(tab.key) } }}
                            className={cn(TAB_BASE, "max-w-48", tab.active ? TAB_ACTIVE : TAB_IDLE)}
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
                                className={cn(TAB_TRIGGER, "pr-1")}
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

            <div className="flex shrink-0 items-center gap-2 self-center">
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav aria-label="Ruta de la vista" className="hidden md:flex items-center gap-1.5 text-xs font-medium">
                        {breadcrumbs.map((crumb, index) => (
                            <span key={index} className="flex items-center gap-1.5">
                                {index > 0 && <span className="text-border select-none" aria-hidden>/</span>}
                                {crumb.href ? (
                                    <Link href={crumb.href} className="text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</Link>
                                ) : (
                                    <span className="text-foreground/90">{crumb.label}</span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}
                {actions}
                {trailing}
            </div>
        </div>
    )
}
