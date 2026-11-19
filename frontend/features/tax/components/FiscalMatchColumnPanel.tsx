"use client"

import { useId, useState, type ReactNode, type UIEvent } from "react"
import { toast } from "sonner"
import { CardSkeleton, EmptyState, MoneyDisplay, Section, StatusBadge } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/useDebounce"
import { getDteLabel } from "@/lib/entity-registry"
import { partStateValue, type PartState } from "@/lib/fiscal-match"
import { dteShortLabel } from "../entity-view/fiscalMatch.entity"
import { isOrphan, maxSelection } from "../hooks/fiscalMatchDraft"
import type { FiscalMatchDraft } from "../hooks/useFiscalMatchDraft"
import { useFiscalMatchSearch } from "../hooks/useFiscalMatches"
import type { FiscalMatchDetail, FiscalMatchPart, FiscalMatchSearchItem, FiscalMatchSearchOrdering } from "../types/fiscalMatch"
import { FiscalMatchCandidateCard, type FiscalMatchCardData } from "./FiscalMatchCandidateCard"
import { FiscalMatchSearchToolbar } from "./FiscalMatchSearchToolbar"

export interface FiscalMatchColumnPanelProps {
    /** Posición en la ficha: «01», «02», «03». */
    index: number
    part: FiscalMatchPart
    title: string
    subtitle: string
    group: FiscalMatchDetail
    draft: FiscalMatchDraft
    /** Sin `tax.change_taxperiod`: sin selección ni «Quitar». */
    readOnly: boolean
    /** Guardado en curso: tarjetas y pagos deshabilitados. */
    disabled?: boolean
    /** Contenido bajo la columna (alimentación de compras en la columna RCV). */
    children?: ReactNode
}

const ENTITY_LABELS: Record<FiscalMatchPart, string> = {
    erp: "billing.invoice",
    tuu: "treasury.terminalsale",
    rcv: "accounting.rcvdocument",
}

const SEARCH_PLACEHOLDERS: Record<FiscalMatchPart, string> = {
    erp: "Buscar por número, RUT o monto",
    tuu: "Buscar por venta, dispositivo o monto",
    rcv: "Buscar por folio, RUT o monto",
}

const SEARCH_DEBOUNCE_MS = 300
/** Distancia al final de la lista a la que se pide la página siguiente. */
const SCROLL_THRESHOLD_PX = 80

function stateOf(group: FiscalMatchDetail, part: FiscalMatchPart): PartState {
    return part === "erp" ? group.erp_state : part === "tuu" ? group.tuu_state : group.rcv_state
}

/** Mensaje en vez de la lista cuando la parte no espera registros. */
function notApplicableText(part: FiscalMatchPart, state: PartState): string | null {
    if (state === "SUMMARY_ONLY") return "El SII solo informa el resumen mensual de los 48"
    if (state !== "NOT_APPLICABLE") return null
    if (part === "tuu") return "Este documento no espera pagos TUU"
    if (part === "rcv") return "Este documento no se informa al SII"
    return "Esta parte no aplica a este cuadre"
}

/** Registros del grupo en la parte, con la forma de una tarjeta. */
function linkedCards(group: FiscalMatchDetail, part: FiscalMatchPart): FiscalMatchCardData[] {
    if (part === "erp") {
        const inv = group.invoice
        if (!inv) return []
        const detail = [getDteLabel(inv.dte_type), group.counterparty_rut].filter(Boolean).join(" · ")
        return [{ id: inv.id, label: inv.display_id, counterparty: detail, date: inv.date, amount: group.erp_amount ?? inv.total }]
    }
    if (part === "tuu") {
        return group.terminal_sales.map((s) => ({
            id: s.id,
            label: `Venta TUU #${s.id}`,
            counterparty: [
                s.matched_movement ? `Pago #${s.matched_movement.id} · ${formatDate(s.matched_movement.created_at, true)}` : "Sin pago asociado",
                s.document_type !== null && `TUU informó DTE ${s.document_type}`,
                s.linked_manually && "Unión manual",
            ].filter(Boolean).join(" · "),
            date: null,
            datetime: s.transaction_at,
            amount: s.sale_amount,
        }))
    }
    return group.rcv_documents.map((d) => ({
        id: d.id,
        label: `Folio ${d.folio}`,
        counterparty: [dteShortLabel(d.dte_type) ?? `DTE ${d.dte_type}`, group.rcv_linked_manually && "Unión manual"].filter(Boolean).join(" · "),
        date: d.issue_date,
        amount: d.total_amount,
    }))
}

/**
 * Una columna de la ficha de cuadre (spec §5.1): cabecera numerada con el estado de su parte,
 * «En este cuadre» (registros unidos, con «Quitar») y «Sin cuadrar» (buscador, orden y candidatas
 * por coincidencia, con scroll infinito). Las selecciones van al borrador; nada se guarda aquí.
 */
export function FiscalMatchColumnPanel({ index, part, title, subtitle, group, draft, readOnly, disabled = false, children }: FiscalMatchColumnPanelProps) {
    const titleId = useId()
    const { openEntity } = useGlobalModalActions()
    const state = stateOf(group, part)
    const status = partStateValue(state)
    const linked = linkedCards(group, part)
    // Lo elegido para unir se ve aquí aunque ya no esté en la página o la búsqueda de «Sin cuadrar».
    const pending = draft.pendingLinks(part)
    const paymentFor = (saleId: number) => {
        // Una venta que se quita no lleva pago.
        if (part !== "tuu" || draft.stateOf(part, saleId) === "toRemove") return undefined
        const options = draft.paymentOptionsOf(saleId)
        const missing = draft.isMissingPayment(saleId)
        return options.length > 0 || missing ? {
            options,
            missing,
            value: draft.paymentOf(saleId),
            onChange: (movementId: number) => draft.setPayment(saleId, movementId),
        } : undefined
    }
    const single = maxSelection(group, part) === 1
    const number = String(index).padStart(2, "0")

    const notApplicable = notApplicableText(part, state)
    const orphan = isOrphan(group)
    // ERP con documento: el grupo *es* el documento y no se cambia. TUU/RCV de un huérfano: sin
    // documento no hay contra qué cuadrar (el servidor solo devolvería sus registros propios).
    const offersCandidates = notApplicable === null && (part === "erp" ? orphan : !orphan)

    return (
        <section aria-labelledby={titleId} className="surface-panel flex min-w-0 flex-col gap-4 bg-muted/20 p-3">
            <header className="flex items-start justify-between gap-2">
                <h2 id={titleId} className="min-w-0">
                    <span className="mr-2 font-mono text-2xs text-primary">{number}</span>
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="block text-2xs font-normal text-muted-foreground">{subtitle}</span>
                </h2>
                <StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />
            </header>

            <div className="flex flex-col gap-2">
                <Section.Header title="En este cuadre" count={linked.length + pending.length} />
                {part === "tuu" && group.tuu_amount !== null && (
                    <p className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Total TUU</span>
                        <MoneyDisplay amount={group.tuu_amount} currency="CLP" />
                    </p>
                )}
                {linked.length === 0 && pending.length === 0 && <EmptyState variant="minimal" title="Sin registros unidos" />}
                {linked.map((card) => (
                    <FiscalMatchCandidateCard
                        key={card.id}
                        part={part}
                        card={card}
                        state={draft.stateOf(part, card.id)}
                        error={draft.errorOf(part, card.id)}
                        readOnly={readOnly}
                        disabled={disabled}
                        onOpen={() => openEntity(ENTITY_LABELS[part], card.id)}
                        onRemove={part === "erp" ? undefined : () => draft.remove(part, card.id)}
                        onUndo={() => draft.unselect(part, card.id)}
                        payment={paymentFor(card.id)}
                    />
                ))}
                {pending.map((item) => (
                    <FiscalMatchCandidateCard
                        key={`pending-${item.id}`}
                        part={part}
                        card={{ ...item, warnings: draft.warningsOf(part, item) }}
                        state={draft.stateOf(part, item.id)}
                        error={draft.errorOf(part, item.id)}
                        readOnly={readOnly}
                        disabled={disabled}
                        onUndo={() => draft.unselect(part, item.id)}
                        payment={paymentFor(item.id)}
                    />
                ))}
            </div>

            {notApplicable !== null ? (
                <EmptyState variant="minimal" title={notApplicable} />
            ) : offersCandidates ? (
                // Por grupo: al cambiar de grupo no se ven (ni eligen) candidatas del anterior.
                <CandidateList key={group.id} part={part} group={group} draft={draft} readOnly={readOnly} disabled={disabled} single={single} />
            ) : part !== "erp" && draft.pendingLinks("erp").length === 0 ? (
                <EmptyState
                    variant="minimal"
                    title="Primero elige el documento ERP"
                    description="Los candidatos aparecen al guardar el cuadre con su documento."
                />
            ) : null}

            {children}
        </section>
    )
}

function CandidateList({ part, group, draft, readOnly, disabled, single }: {
    part: FiscalMatchPart; group: FiscalMatchDetail; draft: FiscalMatchDraft; readOnly: boolean; disabled: boolean; single: boolean
}) {
    const [text, setText] = useState("")
    const [ordering, setOrdering] = useState<FiscalMatchSearchOrdering>("score")
    const q = useDebounce(text.trim(), SEARCH_DEBOUNCE_MS)
    const search = useFiscalMatchSearch(group.id, part, { q: q || undefined, ordering })

    const loadMore = () => {
        if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage()
    }
    const onScroll = (e: UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        if (el.scrollHeight - el.scrollTop <= el.clientHeight + SCROLL_THRESHOLD_PX) loadMore()
    }
    const toggle = (item: FiscalMatchSearchItem) => {
        const current = draft.stateOf(part, item.id)
        if (current === "selected" || current === "error") return draft.unselect(part, item.id)
        const result = draft.select(part, item)
        if (!result.ok) toast.error(result.reason)
    }

    return (
        <div className="flex min-h-0 flex-col gap-2">
            <Section.Header
                title="Sin cuadrar"
                count={`${search.totalCount} ${search.totalCount === 1 ? "resultado" : "resultados"}`}
            />
            <FiscalMatchSearchToolbar
                search={text}
                onSearchChange={setText}
                ordering={ordering}
                onOrderingChange={setOrdering}
                placeholder={SEARCH_PLACEHOLDERS[part]}
                ariaLabel={SEARCH_PLACEHOLDERS[part]}
            />
            {search.isLoading ? (
                <CardSkeleton variant="compact" count={3} ariaLabel="Cargando candidatos" />
            ) : search.isError ? (
                <EmptyState
                    variant="minimal"
                    title="No se pudieron cargar los candidatos"
                    action={<Button type="button" size="sm" variant="outline" onClick={() => void search.refetch()}>Reintentar</Button>}
                />
            ) : search.items.length === 0 ? (
                <EmptyState variant="minimal" context="search" title={q ? "Sin resultados" : "Sin registros por cuadrar"} />
            ) : (
                <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1" onScroll={onScroll}>
                    {/* El error y el pago de lo elegido se muestran en «En este cuadre», una sola vez. */}
                    {search.items.map((item) => (
                        <FiscalMatchCandidateCard
                            key={item.id}
                            part={part}
                            card={{ ...item, warnings: draft.warningsOf(part, item) }}
                            state={draft.stateOf(part, item.id)}
                            readOnly={readOnly}
                            disabled={disabled}
                            single={single}
                            onToggle={() => toggle(item)}
                        />
                    ))}
                    {search.hasNextPage && (
                        <Button type="button" size="sm" variant="ghost" disabled={search.isFetchingNextPage} onClick={loadMore}>
                            {search.isFetchingNextPage ? "Cargando…" : "Ver más"}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
