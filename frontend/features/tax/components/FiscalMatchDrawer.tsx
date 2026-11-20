"use client"

import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight, Scale } from "lucide-react"
import { toast } from "sonner"
import { Can } from "@/components/auth"
import {
    Banner,
    CancelButton,
    Drawer,
    DrawerLayout,
    EmptyState,
    FormFooter,
    Section,
    SkeletonShell,
    StatusBadge,
    SubmitButton,
} from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useOptionalGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { useAuth } from "@/contexts/AuthContext"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { fiscalMatchStatusValue } from "@/lib/fiscal-match"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDraftDirtyGuard } from "@/hooks/useDirtyGuard"
import { cn } from "@/lib/utils"
import { applyErrorOf } from "../api/fiscalMatchApi"
import { dteShortLabel } from "../entity-view/fiscalMatch.entity"
import { useFiscalMatchDraft, type FiscalMatchDraft } from "../hooks/useFiscalMatchDraft"
import {
    useApplyFiscalMatch,
    useFiscalMatch,
    useInvalidateFiscalMatch,
    useReleaseFiscalMatch,
    useRetryFiscalIssue,
} from "../hooks/useFiscalMatches"
import type { FiscalMatchDetail, FiscalMatchPart } from "../types/fiscalMatch"
import { FiscalMatchColumnPanel } from "./FiscalMatchColumnPanel"
import { FiscalMatchRegisterSection } from "./FiscalMatchRegisterSection"
import { FiscalMatchRegisterSaleSection } from "./FiscalMatchRegisterSaleSection"

export interface FiscalMatchDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Modo de identidad del drawer (título/subtítulo); la superficie es `edit` con permiso de cambio y `view` sin él. */
    mode?: DrawerMode
    /** La ficha pasó a otro grupo tras una acción (el abierto se unió a otro): p. ej. para actualizar la URL. */
    onGroupChange?: (id: number) => void
}

/** Toda acción del cuadre (guardar cambios, devolver, reintentar, alimentar) exige este permiso. */
const CHANGE_PERMISSION = "tax.change_taxperiod"

interface ColumnDef {
    part: FiscalMatchPart
    title: string
    subtitle: string
}

const DIRECTION_LABELS: Record<FiscalMatchDetail["direction"], string> = { sale: "Venta", purchase: "Compra" }

/** Ventas: ERP → TUU → RCV. Compras: ERP → RCV. */
const SALE_COLUMNS: ColumnDef[] = [
    { part: "erp", title: "Documento ERP", subtitle: "Documento de origen" },
    { part: "tuu", title: "Pagos TUU", subtitle: "Pagos del terminal" },
    { part: "rcv", title: "RCV (SII)", subtitle: "Registro del SII" },
]
const PURCHASE_COLUMNS: ColumnDef[] = [
    { part: "erp", title: "Documento ERP", subtitle: "Documento de origen" },
    { part: "rcv", title: "RCV (SII)", subtitle: "Registro del SII" },
]

/** Devolver y reintentar cambian el grupo de inmediato: con cambios en espera se bloquean. */
const LOCKED_HINT = "Guarda o descarta los cambios"

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

const pendingText = (n: number) => (n === 1 ? "1 cambio sin guardar" : `${n} cambios sin guardar`)

/**
 * Ficha de un grupo de cuadre (`tax.fiscalmatch`) en columnas (spec §5.1): documento ERP, pagos TUU
 * y RCV del SII, con candidatas por coincidencia. Las uniones y salidas quedan en un borrador y se
 * guardan juntas con «Guardar cambios» (`apply`); devolver y reintentar siguen siendo inmediatas.
 */
export function FiscalMatchDrawer({ id, open, onOpenChange, mode: modeProp, onGroupChange }: FiscalMatchDrawerProps) {
    const { mode } = useDrawerMode({ mode: modeProp, initialData: id ? { id } : undefined, defaultMode: "view" })
    const { can } = useAuth()
    const readOnly = !can(CHANGE_PERMISSION)
    // Grupo mostrado: sigue al `id` abierto salvo que haya cambios en espera (entonces se pregunta antes).
    const [shownId, setShownId] = useState(id)
    // Grupo al que se movió la ficha tras una unión; vale solo mientras el grupo mostrado sea el mismo.
    const [moved, setMoved] = useState<{ from: number | null; to: number } | null>(null)
    const groupId = moved && moved.from === shownId ? moved.to : shownId
    const { group, isLoading, isError, notFound, refetch } = useFiscalMatch(groupId)
    const follow = useCallback(
        (result: FiscalMatchDetail) => {
            if (result.id === groupId) return
            setMoved({ from: shownId, to: result.id })
            onGroupChange?.(result.id)
        },
        [shownId, groupId, onGroupChange],
    )
    const identity = useDrawerIdentity("tax.fiscalmatch", mode, group, {
        overrideTitle: group ? groupTitle(group) : "Cuadre",
        overrideSubtitle: group ? `${DIRECTION_LABELS[group.direction]} · ${group.status_display}` : undefined,
    })

    const draft = useFiscalMatchDraft(group)
    const { discard, reconcile } = draft
    // El borrador es de un grupo: abrir otro (o seguir al resultante) lo descarta.
    const [draftGroup, setDraftGroup] = useState(groupId)
    if (draftGroup !== groupId) {
        setDraftGroup(groupId)
        discard()
    }

    // Tras cada refresco del grupo, lo que ya no aplica sale del borrador con un aviso.
    useEffect(() => {
        if (group) reconcile(group, {}).forEach((notice) => toast.info(notice))
    }, [group, reconcile])

    const apply = useApplyFiscalMatch()
    const invalidate = useInvalidateFiscalMatch()
    /** Guarda el borrador; `true` si quedó guardado (lo usa también «Guardar y continuar» de la guarda). */
    const save = async (): Promise<boolean> => {
        if (!group) return false
        draft.clearErrors()
        try {
            const result = await apply.mutateAsync({ id: group.id, changes: draft.pending })
            discard()
            follow(result)
            return true
        } catch (e) {
            // 400 con `change_index`: el motivo va en la tarjeta del cambio y en un solo aviso. El resto
            // (409 motor ocupado, red) ya lo avisó la mutación. El borrador se conserva siempre.
            const err = applyErrorOf(e)
            if (err?.code === "MOVED") {
                // Su registro se movió mientras se editaba: el cambio sale del borrador con el aviso de §7b
                // y las listas se refrescan para no volver a ofrecerlo.
                const notice = draft.drop(err.changeIndex)
                if (notice) toast.info(notice)
                void invalidate()
            } else if (err) {
                draft.markError(err.changeIndex, err.message)
                toast.error("No se pudo guardar el cuadre", { description: err.message })
            }
            return false
        }
    }

    // Guarda de toda la app (cerrar la ficha o su pestaña, salir de la página, abrir otro documento):
    // Guardar y continuar / Descartar y continuar / Seguir editando.
    useDraftDirtyGuard({
        open,
        name: group ? groupTitle(group) : undefined,
        isDirty: draft.isDirty,
        isSubmitting: apply.isPending,
        discard,
        save,
    })

    // Abrir otro grupo (cambia `id`) con cambios en espera pasa por la misma guarda; «Seguir editando»
    // devuelve la URL al grupo que sigue abierto.
    const runGuarded = useOptionalGlobalModalActions()?.runGuarded
    const handledId = useRef(id)
    useEffect(() => {
        if (handledId.current === id) return
        handledId.current = id
        if (id === shownId) return
        const go = () => setShownId(id)
        if (!runGuarded) return go()
        runGuarded(go, () => {
            if (groupId !== null) onGroupChange?.(groupId)
        })
    }, [id, shownId, groupId, runGuarded, onGroupChange])

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
                    <FiscalMatchBody group={group} draft={draft} readOnly={readOnly} saving={apply.isPending} />
                </FollowGroupContext.Provider>
            )}
        </SkeletonShell>
    )

    const footer = readOnly || !group ? undefined : (
        <FormFooter
            leftActions={<DraftSummary draft={draft} />}
            actions={
                <>
                    <CancelButton onClick={discard} disabled={!draft.isDirty || apply.isPending}>Descartar</CancelButton>
                    <SubmitButton
                        type="button"
                        onClick={() => void save()}
                        loading={apply.isPending}
                        disabled={!draft.isDirty || draft.needsPayment}
                    >
                        Guardar cambios
                    </SubmitButton>
                </>
            }
        />
    )

    return (
        <Drawer
                fillContent
                contentClassName="p-0"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("master", false)}
                mode={readOnly ? "view" : "edit"}
                icon={identity.icon}
                title={identity.title}
                subtitle={identity.subtitle}
                footer={footer}
            >
                <DrawerLayout
                    className="min-w-0 h-full overflow-hidden"
                    tabs={[{ value: "detail", label: "Cuadre", icon: Scale, content: detail }]}
                />
            </Drawer>
    )
}

/** «N cambios sin guardar» (con la lista al pasar el cursor), las consecuencias y si falta un pago. */
function DraftSummary({ draft }: { draft: FiscalMatchDraft }) {
    if (!draft.isDirty) return <span className="text-xs text-muted-foreground">Sin cambios</span>
    return (
        <div className="flex min-w-0 flex-col gap-0.5 text-xs">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0} className="w-fit font-medium text-foreground underline decoration-dotted underline-offset-2">
                        {pendingText(draft.pending.length)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <ul className="space-y-0.5">
                        {draft.summary.map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                </TooltipContent>
            </Tooltip>
            {draft.consequences.map((line) => <span key={line} className="text-muted-foreground">{line}</span>)}
            {draft.needsPayment && <span className="text-warning-text">Falta elegir el pago de una venta TUU</span>}
        </div>
    )
}

function groupTitle(group: FiscalMatchDetail): string {
    if (group.invoice) return `Cuadre ${group.invoice.display_id}`
    return `Cuadre ${dteShortLabel(group.dte_type) ?? ""} (sin documento)`.replace(/\s+/g, " ")
}

function FiscalMatchBody({ group, draft, readOnly, saving }: { group: FiscalMatchDetail; draft: FiscalMatchDraft; readOnly: boolean; saving: boolean }) {
    const follow = useContext(FollowGroupContext)
    const status = fiscalMatchStatusValue(group.status, group.status_display)
    const isOrphan = group.invoice === null
    const manualMark = group.rcv_linked_manually || group.terminal_sales.some((s) => s.linked_manually)
    const feedingDoc = group.direction === "purchase" && isOrphan && group.rcv_documents.length === 1 ? group.rcv_documents[0] : null
    const feedingSaleDoc = group.direction === "sale" && isOrphan && group.rcv_documents.length === 1 && [33, 34].includes(group.rcv_documents[0].dte_type) ? group.rcv_documents[0] : null
    const columns = group.direction === "sale" ? SALE_COLUMNS : PURCHASE_COLUMNS

    return (
        <div className="space-y-6">
            <FiscalMatchBanners group={group} locked={draft.isDirty} />

            <Section
                title="Grupo"
                actions={isOrphan && manualMark ? <ReleaseAction groupId={group.id} locked={draft.isDirty} /> : undefined}
            >
                <Stat title="Estado" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
                <Stat title="Dirección" value={DIRECTION_LABELS[group.direction]} plain />
                <Stat title="Fecha" value={group.issue_date ? formatDate(group.issue_date) : null} plain />
                <Stat title="Última revisión" value={group.evaluated_at ? formatDate(group.evaluated_at, true) : null} plain />
            </Section>

            <div className="@container">
                <div className={cn("grid gap-3", columns.length === 3 ? "@4xl:grid-cols-[1fr_auto_1fr_auto_1fr]" : "@2xl:grid-cols-[1fr_auto_1fr]")}>
                    {columns.map((col, i) => (
                        <Fragment key={col.part}>
                            {i > 0 && <ColumnArrow wide={columns.length === 3} />}
                            <FiscalMatchColumnPanel index={i + 1} part={col.part} title={col.title} subtitle={col.subtitle} group={group} draft={draft} readOnly={readOnly} disabled={saving}>
                                {col.part === "rcv" && feedingDoc && !readOnly && (
                                    <FiscalMatchRegisterSection groupId={group.id} doc={feedingDoc} onGroupChange={follow} />
                                )}
                                {col.part === "erp" && feedingSaleDoc && !readOnly && (
                                    <FiscalMatchRegisterSaleSection groupId={group.id} doc={feedingSaleDoc} onGroupChange={follow} />
                                )}
                            </FiscalMatchColumnPanel>
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Flecha entre columnas (solo cuando caben en fila; apiladas sobra). */
function ColumnArrow({ wide }: { wide: boolean }) {
    return (
        <div aria-hidden className={cn("hidden items-start justify-center pt-4", wide ? "@4xl:flex" : "@2xl:flex")}>
            <span className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
            </span>
        </div>
    )
}

/** Botón de acción inmediata; con cambios en espera queda deshabilitado y lo explica al pasar el cursor. */
function ImmediateAction({ locked, pending, onClick, children }: { locked: boolean; pending: boolean; onClick: () => void; children: ReactNode }) {
    const button = (
        <Button type="button" size="sm" variant="outline" disabled={locked || pending} onClick={onClick}>
            {children}
        </Button>
    )
    if (!locked) return button
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={0}>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{LOCKED_HINT}</TooltipContent>
        </Tooltip>
    )
}

function FiscalMatchBanners({ group, locked }: { group: FiscalMatchDetail; locked: boolean }) {
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
                            <ImmediateAction locked={locked} pending={retry.isPending} onClick={() => run(() => retry.mutateAsync({ id: group.id }))}>
                                Reintentar emisión
                            </ImmediateAction>
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

function ReleaseAction({ groupId, locked }: { groupId: number; locked: boolean }) {
    const release = useReleaseFiscalMatch()
    const run = useRunAction()
    return (
        <Can permission={CHANGE_PERMISSION}>
            <ImmediateAction locked={locked} pending={release.isPending} onClick={() => run(() => release.mutateAsync({ id: groupId }))}>
                Devolver al cruce automático
            </ImmediateAction>
        </Can>
    )
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain }: { title: string; value: ReactNode; plain?: boolean }) {
    const empty = value === null || value === undefined || value === "" || value === false
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} />
}

export default FiscalMatchDrawer
