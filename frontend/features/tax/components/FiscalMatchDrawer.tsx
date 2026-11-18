"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { Scale } from "lucide-react"
import { Can } from "@/components/auth"
import { Banner, Drawer, DrawerLayout, EmptyState, MoneyDisplay, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { getDteLabel } from "@/lib/entity-registry"
import { fiscalMatchStatusValue, partStateValue, type PartState } from "@/lib/fiscal-match"
import { formDrawerWidth } from "@/lib/form-widths"
import { dteShortLabel } from "../entity-view/fiscalMatch.entity"
import {
    useFiscalMatch,
    useReleaseFiscalMatch,
    useRetryFiscalIssue,
} from "../hooks/useFiscalMatches"
import type { FiscalMatchDetail } from "../types/fiscalMatch"
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
            {group.direction === "sale" && <TuuBlock group={group} />}
            <RcvBlock group={group} />

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
function PartStateRow({ state }: { state: PartState }) {
    const value = partStateValue(state)
    return <Stat title="Estado" value={<StatusBadge status={value.status} label={value.label} intent={value.intent} size="sm" />} />
}

function ErpBlock({ group }: { group: FiscalMatchDetail }) {
    const { openEntity } = useGlobalModalActions()
    const invoice = group.invoice

    return (
        <Section title="Documento ERP">
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
        </Section>
    )
}

function TuuBlock({ group }: { group: FiscalMatchDetail }) {
    const { openEntity } = useGlobalModalActions()

    return (
        <Section title="Pagos TUU">
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
                />
            ))}
        </Section>
    )
}

function RcvBlock({ group }: { group: FiscalMatchDetail }) {
    const { openEntity } = useGlobalModalActions()

    return (
        <Section title="RCV (SII)">
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
                />
            ))}
        </Section>
    )
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
