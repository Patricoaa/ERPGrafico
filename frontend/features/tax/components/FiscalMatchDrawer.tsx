"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { Scale } from "lucide-react"
import { Can } from "@/components/auth"
import { Banner, Drawer, DrawerLayout, EmptyState, MoneyDisplay, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { formatDate, formatTimeOfDay } from "@/components/entity-view"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { getDteLabel } from "@/lib/entity-registry"
import { fiscalMatchStatusValue, partStateValue, type PartState } from "@/lib/fiscal-match"
import { formDrawerWidth } from "@/lib/form-widths"
import { dteShortLabel } from "../entity-view/fiscalMatch.entity"
import {
    useFiscalMatch,
    useFiscalMatchCandidates,
    useLinkFiscalMatch,
    useReleaseFiscalMatch,
    useRetryFiscalIssue,
    useUnlinkFiscalMatch,
} from "../hooks/useFiscalMatches"
import type { CandidateMovement, FiscalMatchDetail } from "../types/fiscalMatch"
import { FiscalMatchRegisterSection } from "./FiscalMatchRegisterSection"

export interface FiscalMatchDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** El grupo no se edita como formulario: el modo efectivo siempre es `view`; las uniones son acciones. */
    mode?: DrawerMode
    /** La ficha pasó a otro grupo tras una acción (el abierto se unió a otro): p. ej. para actualizar la URL. */
    onGroupChange?: (id: number) => void
}

/** Toda acción del cuadre (unir, quitar, devolver, reintentar, alimentar) exige este permiso. */
const CHANGE_PERMISSION = "tax.change_taxperiod"

/** Partes RCV en que el SII no individualiza o no aplica: no hay registro que vincular. */
const RCV_NOT_LINKABLE: readonly PartState[] = ["NOT_APPLICABLE", "SUMMARY_ONLY"]

const DIRECTION_LABELS: Record<FiscalMatchDetail["direction"], string> = { sale: "Venta", purchase: "Compra" }

/**
 * Las acciones responden con el grupo resultante. Unir un huérfano lo borra y devuelve el grupo del
 * documento: la ficha pasa a mostrar ese grupo en vez de quedarse en un id que ya no existe.
 */
const FollowGroupContext = createContext<(result: FiscalMatchDetail) => void>(() => undefined)

/** Ejecuta la acción y sigue al grupo resultante; si falla, el hook ya mostró el error. */
function useRunAction() {
    const follow = useContext(FollowGroupContext)
    return useCallback(
        (action: () => Promise<FiscalMatchDetail>) => void action().then(follow).catch(() => undefined),
        [follow],
    )
}

/**
 * Ficha de un grupo de cuadre (`tax.fiscalmatch`): documento ERP, pagos TUU y registro RCV del SII,
 * con la unión manual de los tres registros (spec §5.5) y la alimentación de compras desde el RCV.
 */
export function FiscalMatchDrawer({ id, open, onOpenChange, mode: modeProp, onGroupChange }: FiscalMatchDrawerProps) {
    const { mode } = useDrawerMode({ mode: modeProp, initialData: id ? { id } : undefined, defaultMode: "view" })
    // Grupo al que se movió la ficha tras una unión; vale solo mientras el `id` abierto sea el mismo.
    const [moved, setMoved] = useState<{ from: number | null; to: number } | null>(null)
    const groupId = moved && moved.from === id ? moved.to : id
    const { group, isLoading, isError, notFound, refetch } = useFiscalMatch(groupId)
    const follow = useCallback(
        (result: FiscalMatchDetail) => {
            if (result.id === groupId) return
            setMoved({ from: id, to: result.id })
            onGroupChange?.(result.id)
        },
        [id, groupId, onGroupChange],
    )
    const identity = useDrawerIdentity("tax.fiscalmatch", mode, group, {
        overrideTitle: group ? groupTitle(group) : "Cuadre",
        overrideSubtitle: group ? `${DIRECTION_LABELS[group.direction]} · ${group.status_display}` : undefined,
    })

    const detail = notFound ? (
        <EmptyState context="generic" title="Este cuadre ya no existe" description="Sus registros pasaron a otro grupo." variant="compact" />
    ) : isError ? (
        <EmptyState
            context="generic"
            title="No se pudo cargar el cuadre"
            description="Revisa tu conexión e intenta nuevamente."
            variant="compact"
            action={<Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>}
        />
    ) : (
        <SkeletonShell isLoading={isLoading || !group} ariaLabel="Cargando cuadre">
            {group && (
                <FollowGroupContext.Provider value={follow}>
                    <FiscalMatchBody group={group} />
                </FollowGroupContext.Provider>
            )}
        </SkeletonShell>
    )

    return (
        <Drawer
            fillContent
            contentClassName="p-0"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("complex", false)}
            mode="view"
            icon={identity.icon}
            title={identity.title}
            subtitle={identity.subtitle}
        >
            <DrawerLayout
                className="min-w-0 h-full overflow-hidden"
                tabs={[{ value: "detail", label: "Cuadre", icon: Scale, content: detail }]}
            />
        </Drawer>
    )
}

function groupTitle(group: FiscalMatchDetail): string {
    if (group.invoice) return `Cuadre ${group.invoice.display_id}`
    return `Cuadre ${dteShortLabel(group.dte_type) ?? ""} (sin documento)`.replace(/\s+/g, " ")
}

function FiscalMatchBody({ group }: { group: FiscalMatchDetail }) {
    const follow = useContext(FollowGroupContext)
    const status = fiscalMatchStatusValue(group.status, group.status_display)
    const isOrphan = group.invoice === null
    const records = group.terminal_sales.length + group.rcv_documents.length
    // Quitar de un huérfano con un solo registro solo lo movería a otro huérfano igual.
    const canUnlink = !isOrphan || records > 1
    const manualMark = group.rcv_linked_manually || group.terminal_sales.some((s) => s.linked_manually)
    const feedingDoc = group.direction === "purchase" && isOrphan && group.rcv_documents.length === 1 ? group.rcv_documents[0] : null

    return (
        <div className="space-y-6">
            <FiscalMatchBanners group={group} />

            <Section
                title="Grupo"
                actions={isOrphan && manualMark ? <ReleaseAction groupId={group.id} /> : undefined}
            >
                <Stat title="Estado" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
                <Stat title="Tipo" value={dteShortLabel(group.dte_type) ?? (group.dte_type === null ? null : `DTE ${group.dte_type}`)} plain />
                <Stat title="Fecha" value={group.issue_date ? formatDate(group.issue_date) : null} plain />
                <Stat title={group.direction === "purchase" ? "RUT proveedor" : "RUT cliente"} value={group.counterparty_rut} />
                <Stat title="Última revisión" value={group.evaluated_at ? formatDate(group.evaluated_at, true) : null} plain />
            </Section>

            <ErpBlock group={group} />
            {group.direction === "sale" && <TuuBlock group={group} canUnlink={canUnlink} />}
            <RcvBlock group={group} canUnlink={canUnlink} />

            {feedingDoc && (
                <Can permission={CHANGE_PERMISSION}>
                    <FiscalMatchRegisterSection groupId={group.id} doc={feedingDoc} onGroupChange={follow} />
                </Can>
            )}
        </div>
    )
}

function FiscalMatchBanners({ group }: { group: FiscalMatchDetail }) {
    const retry = useRetryFiscalIssue()
    const run = useRunAction()
    return (
        <>
            {group.issue_error && (
                <Banner
                    tone="destructive"
                    title="Error al emitir"
                    actions={
                        <Can permission={CHANGE_PERMISSION}>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={retry.isPending}
                                onClick={() => run(() => retry.mutateAsync({ id: group.id }))}
                            >
                                Reintentar emisión
                            </Button>
                        </Can>
                    }
                >
                    {[group.issue_error, group.issue_attempted_at && `Intento: ${formatDate(group.issue_attempted_at, true)}`]
                        .filter(Boolean)
                        .join(" · ")}
                </Banner>
            )}
            {group.closed_period_alert && (
                <Banner tone="warning" title="Cambió en un período cerrado">
                    Este cuadre cambió después de cerrarse su período o de emitirse su documento; revíselo.
                </Banner>
            )}
            {group.notice && <Banner tone="info" live="none">{group.notice}</Banner>}
        </>
    )
}

function ReleaseAction({ groupId }: { groupId: number }) {
    const release = useReleaseFiscalMatch()
    const run = useRunAction()
    return (
        <Can permission={CHANGE_PERMISSION}>
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={release.isPending}
                onClick={() => run(() => release.mutateAsync({ id: groupId }))}
            >
                Devolver al cruce automático
            </Button>
        </Can>
    )
}

/** Botón de la cabecera que abre/cierra la lista de candidatos de una parte. */
function ToggleAction({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
    return (
        <Can permission={CHANGE_PERMISSION}>
            <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={onToggle}>
                {label}
            </Button>
        </Can>
    )
}

function PartStateRow({ state }: { state: PartState }) {
    const value = partStateValue(state)
    return <Stat title="Estado" value={<StatusBadge status={value.status} label={value.label} intent={value.intent} size="sm" />} />
}

/** «14:02 · Tarjeta»: hora local del cobro y su método. */
function paymentLabel(movement: CandidateMovement): string {
    return `${formatTimeOfDay(movement.created_at)} · ${movement.method}`
}

/**
 * Botones para unir un candidato: uno solo si hay un cobro compatible (o ninguno que elegir),
 * uno por cobro cuando hay varios del mismo monto y el usuario debe decidir a cuál corresponde.
 */
function PaymentChoice({ movements, label, singleText, allowNone, disabled, onPick }: {
    movements: CandidateMovement[]
    /** Nombre accesible del candidato («venta TUU #40», «BOL-90»). */
    label: string
    singleText: string
    /** Sin cobros compatibles se une igual (el huérfano no tiene venta TUU). */
    allowNone: boolean
    disabled: boolean
    onPick: (movement: number | undefined) => void
}) {
    if (movements.length === 0) {
        if (!allowNone) return <span className="text-xs text-muted-foreground">Sin pago compatible</span>
        return (
            <Button type="button" size="sm" variant="outline" disabled={disabled} aria-label={`${singleText} ${label}`} onClick={() => onPick(undefined)}>
                {singleText}
            </Button>
        )
    }
    if (movements.length === 1) {
        const [only] = movements
        return (
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                aria-label={`${singleText} ${label} (pago ${paymentLabel(only)})`}
                onClick={() => onPick(only.id)}
            >
                {singleText}
            </Button>
        )
    }
    return (
        <span className="flex flex-wrap justify-end gap-2">
            {movements.map((m) => (
                <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    aria-label={`${singleText} ${label} al pago ${paymentLabel(m)}`}
                    onClick={() => onPick(m.id)}
                >
                    {paymentLabel(m)}
                </Button>
            ))}
        </span>
    )
}

function ErpBlock({ group }: { group: FiscalMatchDetail }) {
    const { openEntity } = useGlobalModalActions()
    const [linking, setLinking] = useState(false)
    const invoice = group.invoice

    return (
        <Section
            title="Documento ERP"
            actions={invoice === null ? <ToggleAction label="Vincular documento ERP" open={linking} onToggle={() => setLinking((v) => !v)} /> : undefined}
        >
            <PartStateRow state={group.erp_state} />
            {invoice ? (
                <Section.Row
                    title={
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("billing.invoice", invoice.id)}>
                            {invoice.display_id}
                        </Button>
                    }
                    description={[getDteLabel(invoice.dte_type), invoice.date && formatDate(invoice.date)].filter(Boolean).join(" · ")}
                    value={<Money amount={group.erp_amount ?? invoice.total} />}
                />
            ) : (
                <Stat title="Documento" value="Sin documento en el ERP" plain />
            )}
            {invoice === null && linking && <ErpCandidates groupId={group.id} />}
        </Section>
    )
}

/** Documentos para un huérfano; si tiene venta TUU, el usuario elige el cobro cuando hay varios. */
function ErpCandidates({ groupId }: { groupId: number }) {
    const { candidates, isLoading, isError } = useFiscalMatchCandidates(groupId, "erp")
    const link = useLinkFiscalMatch()
    const run = useRunAction()
    return (
        <CandidateList isLoading={isLoading} isError={isError} isEmpty={candidates.length === 0} emptyText="Sin documentos candidatos">
            {candidates.map((c) => (
                <Section.Row
                    key={c.id}
                    title={c.display_id}
                    description={[getDteLabel(c.dte_type), c.date && formatDate(c.date)].filter(Boolean).join(" · ")}
                    value={<Money amount={c.total} />}
                    actions={
                        <PaymentChoice
                            movements={c.compatible_movements}
                            label={c.display_id}
                            singleText="Vincular"
                            allowNone
                            disabled={link.isPending}
                            onPick={(movement) =>
                                run(() => link.mutateAsync({
                                    id: groupId,
                                    body: movement === undefined ? { part: "erp", id: c.id } : { part: "erp", id: c.id, movement },
                                }))
                            }
                        />
                    }
                />
            ))}
        </CandidateList>
    )
}

function TuuBlock({ group, canUnlink }: { group: FiscalMatchDetail; canUnlink: boolean }) {
    const { openEntity } = useGlobalModalActions()
    const unlink = useUnlinkFiscalMatch()
    const run = useRunAction()
    const [linking, setLinking] = useState(false)
    // TUU «No aplica» (factura sin terminal): no hay cobro que respaldar con una venta.
    const canAdd = group.invoice !== null && group.tuu_state !== "NOT_APPLICABLE"

    return (
        <Section
            title="Pagos TUU"
            actions={canAdd ? <ToggleAction label="Agregar pago TUU" open={linking} onToggle={() => setLinking((v) => !v)} /> : undefined}
        >
            <PartStateRow state={group.tuu_state} />
            {group.tuu_amount !== null && <Stat title="Total TUU" value={<Money amount={group.tuu_amount} />} />}
            {group.terminal_sales.map((s) => (
                <Section.Row
                    key={s.id}
                    title={
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("treasury.terminalsale", s.id)}>
                            {`Venta TUU #${s.id} · ${formatDate(s.transaction_at, true)}`}
                        </Button>
                    }
                    description={[
                        s.matched_movement ? `Pago #${s.matched_movement.id} · ${formatDate(s.matched_movement.created_at, true)}` : "Sin pago asociado",
                        s.document_type !== null && `TUU informó DTE ${s.document_type}`,
                        s.linked_manually && "Unión manual",
                    ].filter(Boolean).join(" · ")}
                    value={<Money amount={s.sale_amount} />}
                    actions={canUnlink ? (
                        <Can permission={CHANGE_PERMISSION}>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={unlink.isPending}
                                onClick={() => run(() => unlink.mutateAsync({ id: group.id, body: { part: "tuu", id: s.id } }))}
                            >
                                Quitar
                            </Button>
                        </Can>
                    ) : undefined}
                />
            ))}
            {canAdd && linking && <TuuCandidates groupId={group.id} />}
        </Section>
    )
}

/** Ventas TUU huérfanas del día con el monto de algún pago; el usuario elige a qué pago corresponden. */
function TuuCandidates({ groupId }: { groupId: number }) {
    const { candidates, isLoading, isError } = useFiscalMatchCandidates(groupId, "tuu")
    const link = useLinkFiscalMatch()
    const run = useRunAction()
    return (
        <CandidateList isLoading={isLoading} isError={isError} isEmpty={candidates.length === 0} emptyText="Sin ventas TUU candidatas">
            {candidates.map((c) => (
                <Section.Row
                    key={c.id}
                    title={`Venta TUU #${c.id}`}
                    description={[formatDate(c.transaction_at, true), c.document_type !== null && `DTE ${c.document_type}`].filter(Boolean).join(" · ")}
                    value={<Money amount={c.sale_amount} />}
                    actions={
                        <PaymentChoice
                            movements={c.compatible_movements}
                            label={`venta TUU #${c.id}`}
                            singleText="Agregar"
                            allowNone={false}
                            disabled={link.isPending}
                            onPick={(movement) => {
                                if (movement !== undefined) run(() => link.mutateAsync({ id: groupId, body: { part: "tuu", id: c.id, movement } }))
                            }}
                        />
                    }
                />
            ))}
        </CandidateList>
    )
}

function RcvBlock({ group, canUnlink }: { group: FiscalMatchDetail; canUnlink: boolean }) {
    const { openEntity } = useGlobalModalActions()
    const unlink = useUnlinkFiscalMatch()
    const run = useRunAction()
    const [linking, setLinking] = useState(false)
    const linkable = group.invoice !== null && group.rcv_documents.length === 0 && !RCV_NOT_LINKABLE.includes(group.rcv_state)

    return (
        <Section
            title="RCV (SII)"
            actions={linkable ? <ToggleAction label="Vincular registro RCV" open={linking} onToggle={() => setLinking((v) => !v)} /> : undefined}
        >
            <PartStateRow state={group.rcv_state} />
            {group.rcv_documents.map((d) => (
                <Section.Row
                    key={d.id}
                    title={
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("accounting.rcvdocument", d.id)}>
                            {`Folio ${d.folio}`}
                        </Button>
                    }
                    description={[`DTE ${d.dte_type}`, d.issue_date && formatDate(d.issue_date), group.rcv_linked_manually && "Unión manual"]
                        .filter(Boolean)
                        .join(" · ")}
                    value={<Money amount={d.total_amount} />}
                    actions={canUnlink ? (
                        <Can permission={CHANGE_PERMISSION}>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={unlink.isPending}
                                onClick={() => run(() => unlink.mutateAsync({ id: group.id, body: { part: "rcv", id: d.id } }))}
                            >
                                Quitar
                            </Button>
                        </Can>
                    ) : undefined}
                />
            ))}
            {linkable && linking && <RcvCandidates groupId={group.id} />}
        </Section>
    )
}

function RcvCandidates({ groupId }: { groupId: number }) {
    const { candidates, isLoading, isError } = useFiscalMatchCandidates(groupId, "rcv")
    const link = useLinkFiscalMatch()
    const run = useRunAction()
    return (
        <CandidateList isLoading={isLoading} isError={isError} isEmpty={candidates.length === 0} emptyText="Sin registros RCV candidatos">
            {candidates.map((c) => (
                <Section.Row
                    key={c.id}
                    title={`Folio ${c.folio}`}
                    description={[`DTE ${c.dte_type}`, c.counterparty_rut, c.issue_date && formatDate(c.issue_date)].filter(Boolean).join(" · ")}
                    value={<Money amount={c.total_amount} />}
                    actions={
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={link.isPending}
                            aria-label={`Vincular folio ${c.folio}`}
                            onClick={() => run(() => link.mutateAsync({ id: groupId, body: { part: "rcv", id: c.id } }))}
                        >
                            Vincular
                        </Button>
                    }
                />
            ))}
        </CandidateList>
    )
}

/** Filas de candidatos con sus estados de carga, error y vacío. */
function CandidateList({ isLoading, isError, isEmpty, emptyText, children }: {
    isLoading: boolean
    isError: boolean
    isEmpty: boolean
    emptyText: string
    children: ReactNode
}) {
    if (isError) return <Stat title="Candidatos" value="No se pudieron cargar los candidatos." plain />
    if (isLoading) return <Stat title="Candidatos" value="Buscando…" plain />
    if (isEmpty) return <Stat title="Candidatos" value={emptyText} plain />
    return <>{children}</>
}

function Money({ amount }: { amount: string | null }) {
    return amount === null ? <>—</> : <MoneyDisplay amount={amount} currency="CLP" />
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain }: { title: string; value: ReactNode; plain?: boolean }) {
    const empty = value === null || value === undefined || value === "" || value === false
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} />
}

export default FiscalMatchDrawer
