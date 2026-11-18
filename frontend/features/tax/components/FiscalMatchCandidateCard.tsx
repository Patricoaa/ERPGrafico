"use client"

import { CreditCard, FileText, Landmark, type LucideIcon } from "lucide-react"
import { CardLead, CardSurface, Chip, LabeledSelect, MoneyDisplay, cardAnatomy } from "@/components/shared"
import { formatDate, formatTimeOfDay } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { matchScoreIntent } from "@/lib/fiscal-match"
import { cn } from "@/lib/utils"
import type { DraftCardState } from "../hooks/fiscalMatchDraft"
import type { CandidateMovement, FiscalMatchPart, FiscalMatchWarning } from "../types/fiscalMatch"

/** Lo que pinta una tarjeta: una candidata de la búsqueda o un registro ya unido al grupo. */
export interface FiscalMatchCardData {
    id: number
    label: string
    /** Contraparte, dispositivo o detalle del registro. */
    counterparty: string
    date: string | null
    /** Fecha y hora (ventas TUU). */
    datetime?: string | null
    amount: string | null
    /** Sin puntaje (registros ya unidos) no hay chip de coincidencia. */
    score?: number
    warnings?: FiscalMatchWarning[]
}

export interface FiscalMatchPaymentChoice {
    options: CandidateMovement[]
    value: number | null
    onChange: (movementId: number) => void
}

export interface FiscalMatchCandidateCardProps {
    part: FiscalMatchPart
    card: FiscalMatchCardData
    state: DraftCardState
    /** Motivo del rechazo del último guardado (400 con `change_index`). */
    error?: string
    /** Sin permiso de cambio: la tarjeta solo se muestra. */
    readOnly?: boolean
    /** Candidata: elegir o soltar. */
    onToggle?: () => void
    /** Registro unido: dejarlo en espera de quitar. */
    onRemove?: () => void
    /** Registro en espera de quitar: cancelar la salida. */
    onUndo?: () => void
    /** Abre la ficha del registro (el título pasa a ser un enlace). */
    onOpen?: () => void
    /** Venta TUU: pago del documento al que se asocia. */
    payment?: FiscalMatchPaymentChoice
}

const PART_ICONS: Record<FiscalMatchPart, LucideIcon> = { erp: FileText, tuu: CreditCard, rcv: Landmark }

const paymentLabel = (m: CandidateMovement) => `${formatTimeOfDay(m.created_at)} · ${m.method}`

/**
 * Tarjeta de la ficha de cuadre (spec §5.1) sobre `CardSurface`: etiqueta, contraparte, fecha, total,
 * chip de coincidencia y advertencias. Una advertencia bloqueante la deja deshabilitada con su motivo;
 * el estado (por unir, se quitará, error) va también en texto, nunca solo en el color.
 */
export function FiscalMatchCandidateCard({
    part, card, state, error, readOnly = false, onToggle, onRemove, onUndo, onOpen, payment,
}: FiscalMatchCandidateCardProps) {
    const Icon = PART_ICONS[part]
    const warnings = card.warnings ?? []
    const blocked = warnings.some((w) => w.blocking)
    const selectable = !readOnly && onToggle !== undefined && state !== "linked" && state !== "toRemove"
    const chosen = state === "selected" || state === "error"

    return (
        <CardSurface
            kind="item"
            role="checkbox"
            aria-label={selectable ? card.label : undefined}
            selected={selectable ? chosen : undefined}
            unavailable={selectable && blocked && !chosen}
            onClick={selectable ? onToggle : undefined}
            className={cn(state === "toRemove" && "opacity-70", state === "error" && "border-destructive")}
        >
            <div className={cardAnatomy.body}>
                <div className="flex items-start gap-3">
                    <CardLead size="sm">
                        <Icon className="h-4 w-4" aria-hidden />
                    </CardLead>
                    <div className="min-w-0 flex-1">
                        {onOpen ? (
                            <Button type="button" variant="link" className={cn(cardAnatomy.entityTitle, "h-auto max-w-full p-0")} onClick={onOpen}>
                                {card.label}
                            </Button>
                        ) : (
                            <p className={cardAnatomy.entityTitle}>{card.label}</p>
                        )}
                        {card.counterparty && <p className={cardAnatomy.entitySubtitle}>{card.counterparty}</p>}
                    </div>
                    {card.score !== undefined && (
                        <Chip size="xs" intent={matchScoreIntent(card.score)}>{`${card.score} % coincidencia`}</Chip>
                    )}
                </div>

                {(warnings.length > 0 || state === "selected" || state === "toRemove") && (
                    <div className="flex flex-wrap gap-1">
                        {state === "selected" && <Chip size="xs" intent="info">Por unir</Chip>}
                        {state === "toRemove" && <Chip size="xs" intent="warning">Se quitará</Chip>}
                        {warnings.map((w) => (
                            <Chip key={w.code} size="xs" intent={w.blocking ? "destructive" : "warning"}>{w.label}</Chip>
                        ))}
                    </div>
                )}

                <div className={cn(cardAnatomy.footer, "flex items-end justify-between gap-3")}>
                    <div>
                        <p className={cardAnatomy.eyebrow}>Fecha</p>
                        <p className={cardAnatomy.fieldValue}>{formatDate(card.datetime ?? card.date, Boolean(card.datetime))}</p>
                    </div>
                    <div className="text-right">
                        <p className={cardAnatomy.eyebrow}>Total</p>
                        <p className={cardAnatomy.fieldValue}>
                            {card.amount === null ? "—" : <MoneyDisplay amount={card.amount} currency="CLP" />}
                        </p>
                    </div>
                </div>

                {error && (
                    <p role="alert" className="text-2xs text-destructive">{error}</p>
                )}

                {!readOnly && payment && payment.options.length > 0 && (
                    // El selector vive dentro de la tarjeta: su clic no la suelta.
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <LabeledSelect
                            label="Pago"
                            placeholder="Elige el pago"
                            value={payment.value === null ? undefined : String(payment.value)}
                            onChange={(v) => payment.onChange(Number(v))}
                            options={payment.options.map((m) => ({ value: String(m.id), label: paymentLabel(m) }))}
                        />
                    </div>
                )}

                {!readOnly && state === "linked" && onRemove && (
                    <div className="flex justify-end">
                        <Button type="button" size="sm" variant="ghost" aria-label={`Quitar ${card.label}`} onClick={onRemove}>
                            Quitar
                        </Button>
                    </div>
                )}
                {!readOnly && onUndo && (state === "toRemove" || (state === "error" && !onToggle)) && (
                    <div className="flex justify-end">
                        <Button type="button" size="sm" variant="ghost" onClick={onUndo}>
                            Deshacer
                        </Button>
                    </div>
                )}
            </div>
        </CardSurface>
    )
}
