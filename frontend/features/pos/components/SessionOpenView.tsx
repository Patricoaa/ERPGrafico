"use client"
import { useState, useEffect, useCallback, type ReactNode } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/money"
import { showApiError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { CheckCircle2, LogOut, Monitor, RefreshCw, Store, Unlock, Users } from "lucide-react"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { usePOSJustifyOptions } from "../hooks/usePOSSessions"
import { ChoiceCard, ChoiceGroup, Chip, EmptyState, Numpad, Skeleton } from "@/components/shared"
import { useTouchMode } from "@/hooks/useTouchMode"
import { formatTimeWith } from "@/lib/utils"
import type { POSSession, POSSessionMode, POSTerminal } from "@/types/pos"
import { CashModeChoice } from "./CashModeChoice"
import { CashDifferenceBanner, CashDifferenceReasonChoice, PartnerChoice, TransferAccountChoice } from "./CashDifferenceJustification"
import { POSFlowLayout, type POSFlowPrimaryAction } from "./flow/POSFlowLayout"
import { TOUCH_ROW_GAP, cashModeLabel, summaryRow, touchRow, touchRowWidth } from "./flow/flowParts"
import { DEFICIT_OPTIONS, SURPLUS_OPTIONS, availableReasons } from "@/features/pos/utils/reasons"

type Flow = "open" | "join"
type StepId = "start" | "terminal" | "cash-mode" | "fund" | "reason" | "transfer" | "partner" | "confirm" | "join"

const STEP_LABELS: Record<StepId, string> = {
    start: "Inicio",
    terminal: "Punto de venta",
    "cash-mode": "Modo de caja",
    fund: "Fondo inicial",
    reason: "Motivo",
    transfer: "Cuenta",
    partner: "Socio",
    confirm: "Confirmar",
    join: "Sesión activa",
}

interface SessionOpenViewProps {
    /** Called after a session is opened (`mode: 'open'`) or joined (`mode: 'join'`) */
    onSuccess: (session: POSSession, mode: Flow) => void
    /** Where "Salir" leads. Default: the app home. */
    exitHref?: string
}

/**
 * Apertura de sesión del POS a pantalla completa (reemplaza al POS mientras no hay sesión).
 * Pensada para tablet y tótem táctil: cada paso es una pregunta con tarjetas grandes; tocar una
 * tarjeta la elige y avanza. La barra inferior siempre ofrece "Anterior" y la acción del paso.
 */
export function SessionOpenView({ onSuccess, exitHref = "/" }: SessionOpenViewProps) {
    const { isTouchMode } = useTouchMode()
    const justifyQuery = usePOSJustifyOptions()

    const [terminals, setTerminals] = useState<POSTerminal[]>([])
    const [availableSessions, setAvailableSessions] = useState<POSSession[]>([])
    const [dataLoading, setDataLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)

    const [flow, setFlow] = useState<Flow>("open")
    /** Whether the operator already picked open/join (marks the start card when coming back). */
    const [flowChosen, setFlowChosen] = useState(false)
    const [stepIndex, setStepIndex] = useState(0)

    const [selectedTerminalId, setSelectedTerminalId] = useState<string>("")
    const [openingBalance, setOpeningBalance] = useState<string>("0")
    const [cashMode, setCashMode] = useState<POSSessionMode>("SINGLE")
    const [justifyReason, setJustifyReason] = useState<string>("")
    const [justifyTargetId, setJustifyTargetId] = useState<string | null>(null)
    const [partnerId, setPartnerId] = useState<string | null>(null)

    const [selectedSharedSessionId, setSelectedSharedSessionId] = useState<string>("")
    const [submitting, setSubmitting] = useState(false)

    const freeTerminals = terminals.filter(t => !availableSessions.some(s => s.terminal === t.id))
    const needsTerminalSelection = freeTerminals.length > 1

    const selectedTerminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
    const expectedBalance = selectedTerminal?.default_treasury_account_balance || 0
    const actualBalance = parseFloat(openingBalance) || 0
    const openingDiff = actualBalance - expectedBalance
    const hasDiff = openingDiff !== 0
    const surplus = openingDiff > 0

    const reasons = availableReasons(surplus ? SURPLUS_OPTIONS : DEFICIT_OPTIONS, justifyQuery.data?.reasons, surplus ? "IN" : "OUT")
    const transferAccounts = (justifyQuery.data?.accounts ?? []).filter(a => a.id !== selectedTerminal?.default_treasury_account)
    const reasonLabel = reasons.find(r => r.value === justifyReason)?.label
    // Con un solo socio no hay nada que elegir: se toma ese.
    const partners = justifyQuery.data?.partners ?? []
    const soleId = partners.length === 1 ? partners[0]!.id.toString() : null
    const partner = partners.find(p => p.id.toString() === (partnerId ?? soleId))
    const targetAccount = transferAccounts.find(a => a.id.toString() === justifyTargetId)

    const stepIdsFor = useCallback((nextFlow: Flow): StepId[] => nextFlow === "join"
        ? ["start", "join"]
        : [
            "start",
            ...(needsTerminalSelection ? ["terminal" as const] : []),
            "cash-mode",
            "fund",
            ...(hasDiff ? ["reason" as const] : []),
            ...(hasDiff && justifyReason === "TRANSFER" ? ["transfer" as const] : []),
            ...(hasDiff && justifyReason === "PARTNER_WITHDRAWAL" && !soleId ? ["partner" as const] : []),
            "confirm",
        ], [needsTerminalSelection, hasDiff, justifyReason, soleId])

    const stepIds = stepIdsFor(flow)
    const safeIndex = Math.min(stepIndex, stepIds.length - 1)
    const stepId = stepIds[safeIndex]

    const canConfirm = !hasDiff || (!!justifyReason && (justifyReason !== "TRANSFER" || !!targetAccount)
        && (justifyReason !== "PARTNER_WITHDRAWAL" || !!partner))

    const goTo = (nextFlow: Flow, id: StepId) => {
        setFlow(nextFlow)
        setFlowChosen(true)
        setStepIndex(Math.max(stepIdsFor(nextFlow).indexOf(id), 0))
    }
    const next = () => setStepIndex(i => i + 1)
    const goBack = () => setStepIndex(i => Math.max(i - 1, 0))

    const loadInitialData = useCallback(() => {
        setDataLoading(true)
        setLoadFailed(false)
        const asList = <T,>(data: unknown): T[] => {
            const res = data as { results?: T[] } | T[]
            return Array.isArray(res) ? res : (res.results ?? [])
        }
        Promise.all([
            posApi.getTerminals().then(d => setTerminals(asList<POSTerminal>(d))),
            posApi.getSessions({ status: "OPEN" }).then(d => setAvailableSessions(asList<POSSession>(d))),
        ])
            .catch(error => {
                console.error("Error loading POS terminals/sessions:", error)
                setLoadFailed(true)
                toast.error("No se pudieron cargar los puntos de venta")
            })
            .finally(() => setDataLoading(false))
    }, [])

    useEffect(() => {
        requestAnimationFrame(loadInitialData)
    }, [loadInitialData])

    // Al dejar el fondo: un motivo de otro signo (sobra ↔ falta) ya no aplica
    const leaveFund = () => {
        if (justifyReason && !reasons.some(r => r.value === justifyReason)) {
            setJustifyReason("")
            setJustifyTargetId(null)
        }
        next()
    }

    const handleOpenSession = async () => {
        if (!selectedTerminalId) {
            toast.error("Debe seleccionar un punto de venta")
            return
        }
        setSubmitting(true)
        try {
            const sessionData = await posApi.openSession({
                terminal_id: parseInt(selectedTerminalId),
                opening_balance: actualBalance,
                mode: cashMode,
                justify_reason: hasDiff ? justifyReason : "",
                justify_target_id: hasDiff
                    ? (justifyReason === "TRANSFER" && justifyTargetId ? parseInt(justifyTargetId) : justifyReason === "PARTNER_WITHDRAWAL" ? partner?.id : null) ?? null
                    : null,
            }) as POSSession
            onSuccess(sessionData, "open")
        } catch (error: unknown) {
            showApiError(error, "Error al abrir la sesión de POS")
        } finally {
            setSubmitting(false)
        }
    }

    const handleJoinSession = async () => {
        const foundSession = availableSessions.find(s => s.id === parseInt(selectedSharedSessionId))
        if (!foundSession) {
            toast.error("Debe seleccionar una sesión de POS")
            return
        }
        setSubmitting(true)
        try {
            // El modo de caja lo fijó quien abrió la sesión
            const joined = await posApi.joinSession(foundSession.id, foundSession.my_mode || "SINGLE")
            onSuccess({ ...foundSession, ...joined }, "join")
        } catch (error: unknown) {
            showApiError(error, "Error al unirse a la sesión de POS")
        } finally {
            setSubmitting(false)
        }
    }

    const startOpenFlow = () => {
        if (freeTerminals.length === 1) {
            setSelectedTerminalId(freeTerminals[0].id.toString())
            goTo("open", "cash-mode")
        } else {
            goTo("open", "terminal")
        }
    }

    // Enter confirma el paso final con teclado (cajas con lector/teclado físico)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return
            if (stepId === "confirm" && canConfirm && !submitting) void handleOpenSession()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    })

    // ── Paso actual: pregunta, respuesta y acción ────────────────────────────
    let heading = ""
    let description: string | undefined
    let body: ReactNode = null
    let primary: POSFlowPrimaryAction | null = null
    let hint: string | null = null

    switch (stepId) {
        case "start":
            heading = "Bienvenido al Punto de Venta"
            description = "¿Qué desea realizar hoy?"
            hint = dataLoading || loadFailed ? null : "Toque una opción para continuar"
            body = dataLoading ? (
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2" role="status" aria-label="Cargando puntos de venta">
                    <Skeleton className="h-64 rounded-sm" />
                    <Skeleton className="h-64 rounded-sm" />
                </div>
            ) : loadFailed ? (
                <EmptyState
                    variant="full"
                    icon={RefreshCw}
                    title="No se pudieron cargar los puntos de venta"
                    description="Revise la conexión e intente de nuevo."
                    action={<Button size="lg" className="h-14 px-8 text-base" onClick={loadInitialData}>Reintentar</Button>}
                />
            ) : (
                <ChoiceGroup label="Qué desea realizar" columns={touchRow(2)} activation="focus" className={TOUCH_ROW_GAP}>
                    <ChoiceCard
                        size="touch"
                        icon={Unlock}
                        iconClassName="text-success"
                        title="Abrir Punto de Venta"
                        description={freeTerminals.length === 0
                            ? "Todos los puntos de venta tienen una sesión abierta."
                            : "Inicie una sesión nueva contando el fondo de caja."}
                        footer={<Chip size="sm" intent={freeTerminals.length ? "success" : "neutral"}>
                            {freeTerminals.length === 1 ? "1 punto de venta libre" : `${freeTerminals.length} puntos de venta libres`}
                        </Chip>}
                        selected={flowChosen && flow === "open"}
                        disabled={freeTerminals.length === 0}
                        onSelect={startOpenFlow}
                    />
                    <ChoiceCard
                        size="touch"
                        icon={Users}
                        title="Unirse a Punto de Venta"
                        description={availableSessions.length === 0
                            ? "No hay sesiones abiertas a las que unirse."
                            : "Opere en una caja que ya abrió otra persona."}
                        footer={<Chip size="sm" intent="neutral">
                            {availableSessions.length === 1 ? "1 punto de venta activo" : `${availableSessions.length} puntos de venta activos`}
                        </Chip>}
                        selected={flowChosen && flow === "join"}
                        disabled={availableSessions.length === 0}
                        onSelect={() => goTo("join", "join")}
                    />
                </ChoiceGroup>
            )
            break

        case "terminal":
            heading = "¿En qué punto de venta va a trabajar?"
            description = "Solo se muestran los que no tienen una sesión abierta."
            hint = "Toque una opción para continuar"
            primary = { label: "Siguiente", onClick: next, disabled: !selectedTerminalId }
            body = (
                <ChoiceGroup label="Punto de venta" columns={touchRow(freeTerminals.length)} activation="focus" className={TOUCH_ROW_GAP}>
                    {freeTerminals.map(t => (
                        <ChoiceCard
                            key={t.id}
                            size="touch"
                            icon={Monitor}
                            title={t.name}
                            meta={t.location || undefined}
                            footer={t.default_treasury_account_balance > 0 ? (
                                <span className="text-base text-muted-foreground">
                                    Base <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(t.default_treasury_account_balance)}</span>
                                </span>
                            ) : undefined}
                            selected={selectedTerminalId === t.id.toString()}
                            onSelect={() => {
                                setSelectedTerminalId(t.id.toString())
                                goTo("open", "cash-mode")
                            }}
                        />
                    ))}
                </ChoiceGroup>
            )
            break

        case "cash-mode":
            heading = "¿Cómo operará la caja?"
            description = "Queda fijo hasta cerrar la sesión."
            hint = "Toque una opción para continuar"
            primary = { label: "Siguiente", onClick: next }
            body = (
                <CashModeChoice
                    value={cashMode}
                    onChange={mode => { setCashMode(mode); next() }}
                    size="touch"
                />
            )
            break

        case "fund": {
            const hasBase = !!selectedTerminal && selectedTerminal.default_treasury_account_balance > 0
            heading = "¿Cuánto efectivo hay en la caja?"
            description = "Cuente el fondo inicial e ingréselo."
            primary = { label: "Siguiente", onClick: leaveFund }
            body = (
                <div className="mx-auto w-full max-w-md surface-panel p-5 shadow-card">
                    <Numpad
                        value={openingBalance}
                        onChange={setOpeningBalance}
                        title="Fondo contado"
                        displayValue={formatCurrency(actualBalance)}
                        allowDecimal={!isTouchMode}
                        touch
                        // El avance vive en la barra inferior; Enter sigue funcionando con teclado
                        hideConfirm
                        className="w-full max-w-full shadow-none border-0 p-0"
                        onConfirm={leaveFund}
                        onExactAmount={hasBase ? () => setOpeningBalance(selectedTerminal.default_treasury_account_balance.toString()) : undefined}
                        exactAmountLabel={hasBase ? `Base: ${formatCurrency(selectedTerminal.default_treasury_account_balance)}` : undefined}
                    />
                </div>
            )
            break
        }

        case "reason":
            heading = "¿Por qué no cuadra el fondo?"
            description = `En el sistema hay ${formatCurrency(expectedBalance)} y contó ${formatCurrency(actualBalance)}.`
            hint = justifyReason ? null : "Toque el motivo de la diferencia"
            primary = { label: "Siguiente", onClick: next, disabled: !justifyReason }
            body = (
                <div className="space-y-6">
                    <CashDifferenceBanner diff={openingDiff} />
                    <CashDifferenceReasonChoice
                        reasons={reasons}
                        value={justifyReason}
                        loading={justifyQuery.isLoading}
                        onChange={value => {
                            setJustifyReason(value)
                            if (value !== "TRANSFER") setJustifyTargetId(null)
                            if (value !== "PARTNER_WITHDRAWAL") setPartnerId(null)
                            next()
                        }}
                    />
                </div>
            )
            break

        case "transfer":
            heading = surplus ? "¿De dónde vino el dinero?" : "¿A dónde se fue el dinero?"
            description = `Traspaso de ${formatCurrency(Math.abs(openingDiff))}.`
            hint = targetAccount ? null : "Toque la cuenta del traspaso"
            primary = { label: "Siguiente", onClick: next, disabled: !targetAccount }
            body = (
                <TransferAccountChoice
                    label={surplus ? "Cuenta de origen" : "Cuenta de destino"}
                    accounts={transferAccounts}
                    value={justifyTargetId}
                    minBalance={surplus ? openingDiff : undefined}
                    onChange={id => { setJustifyTargetId(id); next() }}
                />
            )
            break

        case "partner":
            heading = "¿Qué socio retiró el dinero?"
            description = `Retiro de ${formatCurrency(Math.abs(openingDiff))}; queda a su nombre.`
            hint = partner ? null : "Toque al socio"
            primary = { label: "Siguiente", onClick: next, disabled: !partner }
            body = <PartnerChoice partners={partners} value={partnerId} onChange={id => { setPartnerId(id); next() }} />
            break

        case "confirm":
            heading = "Revise y abra la caja"
            description = selectedTerminal?.name
            hint = canConfirm ? null : "Falta el motivo de la diferencia"
            primary = { label: "Abrir caja", onClick: () => void handleOpenSession(), disabled: !canConfirm || submitting, final: true, loading: submitting }
            body = (
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <section aria-label="Resumen de apertura" className="surface-panel divide-y divide-border px-6 py-2 shadow-card">
                        {summaryRow("Punto de venta", selectedTerminal?.name)}
                        {summaryRow("Modo de caja", cashModeLabel(cashMode))}
                        {summaryRow("Fondo en sistema", <span className="font-mono tabular-nums">{formatCurrency(expectedBalance)}</span>)}
                        {summaryRow("Fondo contado", <span className="font-mono tabular-nums">{formatCurrency(actualBalance)}</span>, true)}
                        {hasDiff && summaryRow(
                            openingDiff < 0 ? "Falta" : "Sobra",
                            <span className="font-mono tabular-nums">{formatCurrency(Math.abs(openingDiff))}</span>
                        )}
                        {hasDiff && reasonLabel && summaryRow("Motivo", reasonLabel)}
                        {targetAccount && summaryRow(surplus ? "Vino de" : "Se fue a", targetAccount.name)}
                        {justifyReason === "PARTNER_WITHDRAWAL" && partner && summaryRow("Retiró", partner.name)}
                    </section>
                    {!hasDiff && (
                        <div className="flex items-center gap-4 rounded-lg border border-success/40 bg-success/10 p-5 text-lg">
                            <CheckCircle2 className="size-8 shrink-0 text-success" aria-hidden />
                            <span>El fondo contado coincide con el sistema.</span>
                        </div>
                    )}
                </div>
            )
            break

        case "join":
            heading = "¿A qué sesión se une?"
            description = "Operará la caja con el modo que eligió quien la abrió."
            hint = selectedSharedSessionId ? null : "Toque la sesión a la que quiere unirse"
            primary = { label: "Unirse", onClick: () => void handleJoinSession(), disabled: !selectedSharedSessionId || submitting, final: true, loading: submitting }
            body = (
                <ChoiceGroup label="Sesión de POS activa" columns={touchRow(availableSessions.length)} className={TOUCH_ROW_GAP}>
                    {availableSessions.map(session => (
                        <ChoiceCard
                            key={session.id}
                            size="touch"
                            icon={Store}
                            title={session.treasury_account_name ?? `Sesión #${session.id}`}
                            meta={`Abierta ${formatTimeWith(session.opened_at)}`}
                            description={`Titular: ${session.user_name}`}
                            footer={session.my_mode ? (
                                <Chip size="sm" intent={session.my_mode === "MULTI" ? "primary" : "neutral"}>
                                    {cashModeLabel(session.my_mode)}
                                </Chip>
                            ) : undefined}
                            selected={selectedSharedSessionId === session.id.toString()}
                            onSelect={() => setSelectedSharedSessionId(session.id.toString())}
                        />
                    ))}
                </ChoiceGroup>
            )
            break
    }

    // Ancho del paso: las filas de tarjetas se ajustan a cuántas son (sin scroll en tótem)
    const rowCount: Partial<Record<StepId, number>> = {
        start: 2, "cash-mode": 2, terminal: freeTerminals.length, join: availableSessions.length,
        reason: reasons.length, transfer: transferAccounts.length,
    }
    const width = stepId === "fund" ? "max-w-xl" : stepId === "confirm" ? "max-w-5xl" : touchRowWidth(rowCount[stepId] ?? 2)

    const progressIds = stepIds.filter(id => id !== "start")
    const subtitle = flow === "open" && stepIds.indexOf("cash-mode") < safeIndex
        ? `Apertura · ${cashModeLabel(cashMode)}`
        : flow === "join" && safeIndex > 0 ? "Unirse a una sesión" : "Apertura de caja"

    return (
        <POSFlowLayout
            title={flow === "open" && selectedTerminal ? selectedTerminal.name : "Punto de Venta"}
            subtitle={subtitle}
            steps={safeIndex > 0 ? progressIds.map(id => ({ id, label: STEP_LABELS[id] })) : undefined}
            currentStep={safeIndex - 1}
            progressLabel="Progreso de la apertura"
            exitAction={
                <Button asChild variant="ghost" className="h-12 gap-2 px-4 text-base">
                    <Link href={exitHref}>
                        <LogOut className="size-5" aria-hidden />
                        Salir
                    </Link>
                </Button>
            }
            stepKey={`${flow}-${stepId}`}
            heading={heading}
            description={description}
            width={width}
            onBack={safeIndex > 0 ? goBack : undefined}
            backDisabled={submitting}
            hint={hint}
            primary={primary}
        >
            {body}
        </POSFlowLayout>
    )
}
