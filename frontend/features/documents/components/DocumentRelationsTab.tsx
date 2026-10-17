"use client"

import { useMemo } from "react"
import { Link2Off, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    EmptyState,
    RelatedDocumentRow,
    SectionHeader,
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

    const groups = useMemo(
        () => groupByDomain(data?.relations ?? [], sectionActions),
        [data?.relations, sectionActions],
    )
    const shown = domain ? groups.filter((g) => g.domain === domain) : groups

    if (isLoading) {
        return (
            <SkeletonShell isLoading ariaLabel="Cargando documentos relacionados" className="space-y-6">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 w-40 rounded bg-muted" />
                        <div className="h-20 rounded-md bg-muted" />
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
        <div className={cn("space-y-6", className)}>
            {domain && onDomainChange && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Mostrando solo {DOCUMENT_DOMAIN_META[domain].label}</span>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => onDomainChange(null)}>
                        <X />
                        Ver todas las áreas
                    </Button>
                </div>
            )}

            {shown.map((group) => {
                const meta = DOCUMENT_DOMAIN_META[group.domain]
                return (
                    <section key={group.domain} aria-label={meta.label}>
                        <div className="flex items-start justify-between gap-2">
                            <SectionHeader
                                variant="list"
                                icon={meta.icon}
                                title={meta.label}
                                count={group.links.length}
                                totalAmount={group.total ?? undefined}
                            />
                            {group.actions.length > 0 && group.links.length > 0 && (
                                <div className="-mt-1 flex flex-wrap justify-end gap-1">
                                    {group.actions.map((action) => <SectionActionButton key={action.id} action={action} />)}
                                </div>
                            )}
                        </div>
                        {group.links.length > 0 ? (
                            <ul className="divide-y divide-border rounded-md border">
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
                            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2.5">
                                <span className="text-xs text-muted-foreground">Sin documentos de {meta.label.toLowerCase()}</span>
                                <div className="flex flex-wrap justify-end gap-1">
                                    {group.actions.map((action) => <SectionActionButton key={action.id} action={action} />)}
                                </div>
                            </div>
                        )}
                    </section>
                )
            })}

            {(data?.unresolved.length ?? 0) > 0 && (
                <p className="text-xs text-warning">
                    {data?.unresolved.length} referencia(s) a documentos que ya no existen.
                </p>
            )}
        </div>
    )
}

function SectionActionButton({ action }: { action: DocumentActionItem }) {
    const Icon = action.icon
    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
        >
            {Icon && <Icon />}
            {action.label}
        </Button>
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
