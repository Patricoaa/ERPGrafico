"use client"

import { createElement, useMemo, useState } from "react"
import { Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    EmptyState,
    RelatedDocumentRow,
    SkeletonShell,
    type DocumentActionItem,
} from "@/components/shared"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { useDocumentRelations } from "../hooks/useDocumentRelations"
import { useOpenRelatedDocument } from "../hooks/useOpenRelatedDocument"
import { DOCUMENT_DOMAIN_META, DOMAIN_ORDER } from "../utils/domains"
import type { DocumentDomain, DocumentLink } from "../types"

export interface DocumentRelationsTabProps {
    label: string
    id: number | null | undefined
    /**
     * Acciones por área ("+ Registrar pago" en Tesorería). Un área con acciones se muestra
     * aunque no tenga documentos, con su acción como estado vacío.
     */
    sectionActions?: Partial<Record<DocumentDomain, DocumentActionItem[]>>
    /** Acciones sobre cada documento relacionado (anular, cancelar…). */
    rowActions?: (link: DocumentLink) => DocumentActionItem[]
    /** Filtro por área (p. ej. al pulsar un paso del ciclo). */
    domain?: DocumentDomain | null
    onDomainChange?: (domain: DocumentDomain | null) => void
    className?: string
}

interface DomainGroup {
    domain: DocumentDomain
    links: DocumentLink[]
    total: number | null
    actions: DocumentActionItem[]
}

// Chips de navegación por área: siempre visibles cuando hay 2+ secciones.
// Reemplaza el banner reactivo "Mostrando solo X".
function DomainFilterBar({
    groups,
    activeDomain,
    onDomainChange,
}: {
    groups: DomainGroup[]
    activeDomain: DocumentDomain | null
    onDomainChange: (domain: DocumentDomain | null) => void
}) {
    if (groups.length < 2) return null

    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onDomainChange(null)}
                className={cn(
                    "h-7 shrink-0 rounded-sm px-2.5 text-xs font-medium",
                    !activeDomain
                        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                )}
            >
                Todas
            </Button>
            {groups.map((group) => {
                const meta = DOCUMENT_DOMAIN_META[group.domain]
                const isActive = activeDomain === group.domain
                const hasPending = group.links.length === 0 && group.actions.length > 0
                return (
                    <Button
                        key={group.domain}
                        size="sm"
                        variant="ghost"
                        onClick={() => onDomainChange(isActive ? null : group.domain)}
                        className={cn(
                            "h-7 shrink-0 gap-1.5 rounded px-2.5 text-xs font-medium",
                            isActive
                                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                        )}
                    >
                        {createElement(meta.icon, { "aria-hidden": true, className: "h-3 w-3" })}
                        {meta.label}
                        {group.links.length > 0 && (
                            <span className={cn(
                                "rounded-full px-1 text-3xs leading-4 font-semibold tabular-nums",
                                isActive ? "bg-white/20 text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground",
                            )}>
                                {group.links.length}
                            </span>
                        )}
                        {hasPending && (
                            <span className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                isActive ? "bg-primary-foreground/60" : "bg-warning",
                            )} />
                        )}
                    </Button>
                )
            })}
        </div>
    )
}

// Header del card de sección: icono + título + contador pill + acciones (siempre visibles).
function RelationsSectionHead({
    domain,
    count,
    actions,
}: {
    domain: DocumentDomain
    count: number
    actions: DocumentActionItem[]
}) {
    const meta = DOCUMENT_DOMAIN_META[domain]
    return (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
                {createElement(meta.icon, { "aria-hidden": true, className: "h-4 w-4 shrink-0 text-muted-foreground" })}
                <span className="text-sm font-semibold">{meta.label}</span>
                {count > 0 && (
                    <span className="rounded-full bg-muted-foreground/15 px-1.5 text-3xs leading-5 font-semibold tabular-nums text-muted-foreground">
                        {count}
                    </span>
                )}
            </div>
            {actions.length > 0 && (
                <div className="flex gap-1 shrink-0">
                    {actions.map((action) => <SectionActionButton key={action.id} action={action} />)}
                </div>
            )}
        </div>
    )
}

function SectionActionButton({ action }: { action: DocumentActionItem }) {
    const Icon = action.icon
    return (
        <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs font-normal border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
        >
            {Icon && <Icon />}
            {action.label}
        </Button>
    )
}

/**
 * Tab "Relaciones" de la ficha documental (ADR-0083, component-document-sheet.md §5).
 * Todas las relaciones del documento agrupadas por área operativa, en el orden del ciclo,
 * con acciones por área y por documento. Reemplaza las fases del Order Hub.
 */
export function DocumentRelationsTab({
    label, id, sectionActions, rowActions, domain, onDomainChange, className,
}: DocumentRelationsTabProps) {
    const { data, isLoading, error } = useDocumentRelations(label, id ?? null)
    const open = useOpenRelatedDocument()

    // Cuando onDomainChange está provisto, el padre controla el filtro (lifecycle step clicks).
    // Sin él, el tab gestiona su propia selección de chips.
    const isControlled = onDomainChange !== undefined
    const [localDomain, setLocalDomain] = useState<DocumentDomain | null>(domain ?? null)
    const activeDomain = isControlled ? (domain ?? null) : localDomain

    const handleDomainChange = (d: DocumentDomain | null) => {
        if (!isControlled) setLocalDomain(d)
        onDomainChange?.(d)
    }

    const groups = useMemo(
        () => groupByDomain(data?.relations ?? [], sectionActions),
        [data?.relations, sectionActions],
    )
    // Self-link: el propio documento aparece primero en su sección, sin opción de abrirse.
    const selfLink = data ? ({
        semantic: "association",
        direction: "outgoing",
        role: "self",
        target: data.document,
        amount: null,
        quantity: null,
        is_dependency: false,
    } as const) : null

    const baseShown = activeDomain ? groups.filter((g) => g.domain === activeDomain) : groups
    // Garantizar que la sección del propio documento siempre aparece (aunque no tenga relaciones)
    const shown = useMemo(() => {
        if (!selfLink) return baseShown
        const selfDomain = selfLink.target.domain
        if (activeDomain && activeDomain !== selfDomain) return baseShown
        if (baseShown.some((g) => g.domain === selfDomain)) return baseShown
        const selfGroup: DomainGroup = { domain: selfDomain, links: [], total: null, actions: [] }
        return [...baseShown, selfGroup].sort((a, b) =>
            (DOCUMENT_DOMAIN_META[a.domain]?.order ?? 99) - (DOCUMENT_DOMAIN_META[b.domain]?.order ?? 99),
        )
    }, [baseShown, selfLink, activeDomain])

    if (isLoading) {
        return (
            <SkeletonShell isLoading ariaLabel="Cargando documentos relacionados" className="space-y-4">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border overflow-hidden">
                        <div className="flex items-center gap-2 border-b px-3 py-2.5">
                            <div className="h-4 w-4 rounded-sm bg-muted" />
                            <div className="h-4 w-24 rounded bg-muted" />
                        </div>
                        <div className="h-16 bg-muted/30" />
                    </div>
                ))}
            </SkeletonShell>
        )
    }
    if (error) {
        return (
            <p role="alert" className={cn("text-sm text-destructive", className)}>
                No se pudieron cargar los documentos relacionados: {getErrorMessage(error)}
            </p>
        )
    }
    if (groups.length === 0) {
        return (
            <EmptyState
                variant="minimal"
                icon={Link2Off}
                title="Sin documentos relacionados"
                description="Los despachos, facturas, pagos y asientos de este documento aparecerán aquí."
                className={className}
            />
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            <DomainFilterBar groups={groups} activeDomain={activeDomain} onDomainChange={handleDomainChange} />

            {shown.map((group) => (
                <section key={group.domain} aria-label={DOCUMENT_DOMAIN_META[group.domain].label}>
                    <div className="rounded-sm border overflow-hidden">
                        <RelationsSectionHead
                            domain={group.domain}
                            count={group.links.length}
                            actions={group.actions}
                        />
                        {group.links.length > 0 || selfLink?.target.domain === group.domain ? (
                            <ul className="divide-y divide-border">
                                {selfLink?.target.domain === group.domain && (
                                    <RelatedDocumentRow
                                        key="self"
                                        item={selfLink}
                                        onOpen={() => {}}
                                        isSelf
                                    />
                                )}
                                {group.links.map((link) => (
                                    <RelatedDocumentRow
                                        key={`${link.role}-${link.target.label}-${link.target.id}`}
                                        item={link}
                                        onOpen={() => open(link.target)}
                                        actions={rowActions?.(link)}
                                        hidePartner={data?.document.partner_name}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <div className="px-3 py-3">
                                <span className="text-sm text-muted-foreground">
                                    Sin documentos de {DOCUMENT_DOMAIN_META[group.domain].label.toLowerCase()} aún
                                </span>
                            </div>
                        )}
                    </div>
                </section>
            ))}

            {(data?.unresolved.length ?? 0) > 0 && (
                <p className="text-xs text-warning">
                    {data?.unresolved.length} referencia(s) a documentos que ya no existen.
                </p>
            )}
        </div>
    )
}

export function groupByDomain(
    links: DocumentLink[],
    sectionActions?: Partial<Record<DocumentDomain, DocumentActionItem[]>>,
): DomainGroup[] {
    return DOMAIN_ORDER.flatMap((domain) => {
        const domainLinks = links.filter((link) => link.target.domain === domain)
        const actions = sectionActions?.[domain] ?? []
        if (domainLinks.length === 0 && actions.length === 0) return []
        // Importe de la relación (p. ej. lo imputado) o, si no hay, el del documento
        const amounts = domainLinks
            .map((link) => (link.target.status === "CANCELLED" ? null : (link.amount ?? link.target.amount)))
            .filter((amount): amount is string | number => amount != null)
            .map(Number)
        const total = amounts.length > 0 ? amounts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0) : null
        return [{ domain, links: domainLinks, total: domain === "contacts" ? null : total, actions }]
    })
}
