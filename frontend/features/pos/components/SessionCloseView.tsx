"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { isAxiosError } from "axios"
import { AlertTriangle, ArrowRightLeft, CheckCircle2, HandCoins, Lock, Receipt, UserMinus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ChoiceCard, ChoiceGroup, Numpad } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { showApiError } from "@/lib/errors"
import { useTouchMode } from "@/hooks/useTouchMode"
import type { POSSession, POSSessionAudit } from "@/types/pos"
import { posApi } from "../api/posApi"
import { usePOSJustifyOptions, usePOSSessionSummary } from "../hooks/usePOSSessions"
import { usePOSSessionRealtime } from "../hooks/usePOSSessionRealtime"
import { CLOSE_DEFICIT_OPTIONS, CLOSE_SURPLUS_OPTIONS, CLOSE_WITHDRAWAL_OPTIONS, availableReasons } from "../utils/reasons"
import { CashDifferenceBanner, CashDifferenceReasonChoice, TransferAccountChoice } from "./CashDifferenceJustification"
import type { POSReportData } from "./POSReport"
import { SessionCashSummary } from "./SessionCashSummary"
import { POSFlowLayout, type POSFlowPrimaryAction } from "./flow/POSFlowLayout"
import { cashModeLabel, summaryRow } from "./flow/flowParts"

type StepId = "count" | "reason" | "transfer" | "cash-out" | "out-reason" | "out-amount" | "out-destination" | "confirm"
/** Qué pasa con el efectivo al cerrar (ADR-0129). */
type CashOut = "keep" | "transfer" | "withdraw"

const STEP_LABELS: Record<StepId, string> = {
    count: "Conteo",
    reason: "Motivo",
    transfer: "Cuenta",
    "cash-out": "Efectivo",
    "out-reason": "Motivo del retiro",
    "out-amount": "Monto",
    "out-destination": "Destino",
    confirm: "Confirmar",
}

const WITHDRAW_ICONS: Record<string, typeof UserMinus> = { PARTNER_WITHDRAWAL: UserMinus, OTHER_OUT: Receipt }

/** 409 `pos_expected_cash_changed` del cierre (el esperado cambió desde que el operador lo vio). */
function isExpectedCashChangedError(error: unknown): boolean {
    if (!isAxiosError(error) || error.response?.status !== 409) return false
    const data: unknown = error.response.data
    const wrapped = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : null
    const details = typeof wrapped === "object" && wrapped !== null ? (wrapped as { details?: unknown }).details : null
    return typeof details === "object" && details !== null && (details as { code?: unknown }).code === "pos_expected_cash_changed"
}

const accountIdOf = (session: POSSession): number | undefined =>
    session.treasury_account !== null && typeof session.treasury_account === "object"
        ? session.treasury_account.id
        : (session.treasury_account ?? undefined)

interface SessionCloseViewProps {
    session: POSSession
    onSuccess?: (audit: POSSessionAudit) => void
    /** Abandona el cierre sin cerrar la sesión. */
    onCancel: () => void
}

/**
 * Cierre de sesión del POS con el mismo flujo táctil de la apertura: conteo → motivo y cuenta
 * (si no cuadra) → qué hacer con el efectivo (dejar, traspasar o retirar con motivo) → confirmación.
 * Cada elección es una tarjeta grande. El traspaso o retiro se registra dentro de la sesión, después
 * del arqueo y antes de cerrarla (ADR-0129).
 */
export function SessionCloseView({ session, onSuccess, onCancel }: SessionCloseViewProps) {
    const { isTouchMode } = useTouchMode()
    const justifyQuery = usePOSJustifyOptions()

    // ADR-0126: el informe se lee con Query y se refresca en vivo (Entity Bus) mientras se cuenta.
    const summaryQuery = usePOSSessionSummary<POSReportData>(session.id)
    usePOSSessionRealtime(session.id)
    const report = summaryQuery.data ?? null
    // ADR-0109: el backend es la fuente del efectivo esperado
    const expected = Number(report ? report.expected_cash : session.expected_cash)

    const [actualCash, setActualCash] = useState("0")
    const [justifyReason, setJustifyReason] = useState("")
    const [justifyTargetId, setJustifyTargetId] = useState<string | null>(null)
    const [cashOut, setCashOut] = useState<CashOut | null>(null)
    const [withdrawReason, setWithdrawReason] = useState("")
    const [withdrawalAmount, setWithdrawalAmount] = useState("0")
    const [destinationId, setDestinationId] = useState<string | null>(null)
    const [notes, setNotes] = useState("")
    const [stepIndex, setStepIndex] = useState(0)
    const [submitting, setSubmitting] = useState(false)

    // Esperado con el que se empezó a contar; si cambia (venta en vivo) se avisa sin pisar el conteo.
    const [baselineExpected, setBaselineExpected] = useState<number | null>(null)
    const prefilledRef = useRef(false)
    useEffect(() => {
        if (prefilledRef.current || summaryQuery.isFetching) return
        prefilledRef.current = true
        requestAnimationFrame(() => {
            setBaselineExpected(expected)
            setActualCash(String(expected))
        })
    }, [expected, summaryQuery.isFetching])

    const actual = parseFloat(actualCash) || 0
    const diff = actual - expected
    const hasDiff = diff !== 0
    const surplus = diff > 0
    const withdrawal = parseFloat(withdrawalAmount) || 0

    const reasons = availableReasons(diff >= 0 ? CLOSE_SURPLUS_OPTIONS : CLOSE_DEFICIT_OPTIONS, justifyQuery.data?.reasons)
    const posAccountId = accountIdOf(session)
    const cashAccounts = (justifyQuery.data?.accounts ?? []).filter(a => a.account_type === "CASH" && a.id !== posAccountId)
    const targetAccount = cashAccounts.find(a => a.id.toString() === justifyTargetId)
    // Traspaso de cierre: a otra caja o a un banco (depósito)
    const destinationAccounts = (justifyQuery.data?.accounts ?? []).filter(a => a.id !== posAccountId)
    const destination = destinationAccounts.find(a => a.id.toString() === destinationId)
    const withdrawReasons = availableReasons(CLOSE_WITHDRAWAL_OPTIONS, justifyQuery.data?.reasons)
    const withdrawReasonLabel = withdrawReasons.find(r => r.value === withdrawReason)?.label
    const movesCash = cashOut === "transfer" || cashOut === "withdraw"
    const reasonLabel = reasons.find(r => r.value === justifyReason)?.label

    const stepIds: StepId[] = [
        "count",
        ...(hasDiff ? ["reason" as const] : []),
        ...(hasDiff && justifyReason === "TRANSFER" ? ["transfer" as const] : []),
        ...(actual > 0 ? ["cash-out" as const] : []),
        ...(actual > 0 && cashOut === "withdraw" ? ["out-reason" as const] : []),
        ...(actual > 0 && movesCash ? ["out-amount" as const] : []),
        ...(actual > 0 && cashOut === "transfer" ? ["out-destination" as const] : []),
        "confirm",
    ]
    const safeIndex = Math.min(stepIndex, stepIds.length - 1)
    const stepId = stepIds[safeIndex]
    const next = () => setStepIndex(i => i + 1)
    const goBack = () => setStepIndex(i => Math.max(i - 1, 0))

    const justified = !hasDiff || (!!justifyReason && (justifyReason !== "TRANSFER" || !!targetAccount))
    const withdrawalValid = !movesCash || (
        withdrawal > 0 && withdrawal <= actual
        && (cashOut === "transfer" ? !!destination : !!withdrawReasonLabel)
    )
    const canClose = justified && withdrawalValid

    const leaveCount = () => {
        if (justifyReason && !reasons.some(r => r.value === justifyReason)) {
            setJustifyReason("")
            setJustifyTargetId(null)
        }
        if (withdrawal > actual) setWithdrawalAmount(String(actual))
        next()
    }

    const handleClose = async () => {
        setSubmitting(true)
        try {
            const closeData = await posApi.closeSession(session.id, {
                actual_cash: actual,
                expected_cash_seen: expected,
                withdrawal_amount: movesCash ? withdrawal : 0,
                withdrawal_kind: cashOut === "withdraw" ? withdrawReason : "TRANSFER",
                notes,
                cash_destination_id: cashOut === "transfer" && destination ? destination.id : null,
                justify_reason: hasDiff ? justifyReason : undefined,
                justify_target_id: hasDiff && justifyReason === "TRANSFER" && targetAccount ? targetAccount.id : null,
            }) as { audit: POSSessionAudit }
            const difference = parseFloat(String(closeData.audit.difference))
            if (difference !== 0) {
                toast.warning(`Sesión de POS cerrada con ${difference > 0 ? "sobrante" : "faltante"} de ${formatCurrency(Math.abs(difference))}`)
            } else {
                toast.success("Sesión de POS cerrada correctamente: la caja cuadra")
            }
            onSuccess?.(closeData.audit)
        } catch (error: unknown) {
            if (isExpectedCashChangedError(error)) {
                // ADR-0126: el servidor rechazó el cierre contra un esperado viejo; se relee y se vuelve a contar.
                toast.warning("El efectivo esperado cambió. Revise el nuevo monto y confirme de nuevo.")
                void summaryQuery.refetch()
                setStepIndex(0)
                return
            }
            showApiError(error, "Error al cerrar la sesión de POS")
        } finally {
            setSubmitting(false)
        }
    }

    let heading = ""
    let description: string | undefined
    let body: ReactNode = null
    let primary: POSFlowPrimaryAction | null = null
    let hint: string | null = null
    let width = "max-w-4xl"

    switch (stepId) {
        case "count": {
            heading = "¿Cuánto efectivo hay en la caja?"
            description = "Cuente el efectivo e ingréselo. El resumen muestra de dónde sale el esperado."
            primary = { label: "Siguiente", onClick: leaveCount }
            width = "max-w-6xl"
            body = (
                <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
                    <div className="space-y-4">
                        {baselineExpected !== null && expected !== baselineExpected && (
                            <div role="status" className="flex flex-wrap items-center gap-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-base">
                                <AlertTriangle className="size-6 shrink-0 text-warning" aria-hidden />
                                <span className="flex-1">
                                    El esperado pasó de {formatCurrency(baselineExpected)} a {formatCurrency(expected)} mientras contaba (hubo una venta o un movimiento).
                                </span>
                                <Button variant="outline" className="h-12 px-5" onClick={() => setBaselineExpected(expected)}>Entendido</Button>
                            </div>
                        )}
                        <SessionCashSummary data={report} expected={expected} sessionId={session.id} />
                    </div>
                    <div className="surface-panel p-5 shadow-card">
                        <Numpad
                            value={actualCash}
                            onChange={setActualCash}
                            title="Efectivo contado"
                            displayValue={formatCurrency(actual)}
                            allowDecimal={!isTouchMode}
                            touch
                            hideConfirm
                            className="w-full max-w-full shadow-none border-0 p-0"
                            onConfirm={leaveCount}
                            onExactAmount={() => setActualCash(String(expected))}
                            exactAmountLabel={`Exacto: ${formatCurrency(expected)}`}
                        />
                    </div>
                </div>
            )
            break
        }

        case "reason":
            heading = "¿Por qué no cuadra la caja?"
            description = `Se esperaban ${formatCurrency(expected)} y contó ${formatCurrency(actual)}.`
            hint = justifyReason ? null : "Toque el motivo de la diferencia"
            primary = { label: "Siguiente", onClick: next, disabled: !justifyReason }
            width = reasons.length > 4 ? "max-w-6xl" : "max-w-4xl"
            body = (
                <div className="space-y-6">
                    <CashDifferenceBanner diff={diff} />
                    <CashDifferenceReasonChoice
                        reasons={reasons}
                        value={justifyReason}
                        loading={justifyQuery.isLoading}
                        onChange={value => {
                            setJustifyReason(value)
                            if (value !== "TRANSFER") setJustifyTargetId(null)
                            next()
                        }}
                    />
                </div>
            )
            break

        case "transfer":
            heading = surplus ? "¿De dónde vino el dinero?" : "¿A dónde se llevó el dinero?"
            description = `Traspaso de ${formatCurrency(Math.abs(diff))}.`
            hint = targetAccount ? null : "Toque la cuenta del traspaso"
            primary = { label: "Siguiente", onClick: next, disabled: !targetAccount }
            width = cashAccounts.length > 4 ? "max-w-6xl" : "max-w-4xl"
            body = (
                <TransferAccountChoice
                    label={surplus ? "Cuenta de origen" : "Cuenta de destino"}
                    accounts={cashAccounts}
                    value={justifyTargetId}
                    minBalance={surplus ? diff : undefined}
                    onChange={id => { setJustifyTargetId(id); next() }}
                />
            )
            break

        case "cash-out":
            heading = "¿Qué hace con el efectivo?"
            description = `Hay ${formatCurrency(actual)} en la caja.`
            hint = cashOut === null ? "Toque una opción para continuar" : null
            primary = { label: "Siguiente", onClick: next, disabled: cashOut === null }
            width = "max-w-6xl"
            body = (
                <ChoiceGroup label="Destino del efectivo" columns="grid-cols-1 sm:grid-cols-3" activation="focus" className="gap-4">
                    <ChoiceCard
                        size="touch"
                        icon={Lock}
                        iconClassName="text-success"
                        title="Dejar en la caja"
                        description="Queda como fondo para la próxima apertura."
                        selected={cashOut === "keep"}
                        onSelect={() => { setCashOut("keep"); next() }}
                    />
                    <ChoiceCard
                        size="touch"
                        icon={ArrowRightLeft}
                        title="Traspasar"
                        description="Llevarlo a otra caja o depositarlo en un banco. Sigue siendo de la empresa."
                        selected={cashOut === "transfer"}
                        onSelect={() => {
                            setCashOut("transfer")
                            if (withdrawal === 0) setWithdrawalAmount(String(actual))
                            next()
                        }}
                    />
                    <ChoiceCard
                        size="touch"
                        icon={HandCoins}
                        title="Retirar"
                        description={withdrawReasons.length
                            ? "Sale de la tesorería con un motivo: retiro de socio u otro egreso."
                            : "No hay motivos de retiro con cuenta contable configurada."}
                        disabled={withdrawReasons.length === 0}
                        selected={cashOut === "withdraw"}
                        onSelect={() => {
                            setCashOut("withdraw")
                            if (withdrawal === 0) setWithdrawalAmount(String(actual))
                            next()
                        }}
                    />
                </ChoiceGroup>
            )
            break

        case "out-reason":
            heading = "¿Por qué se retira el efectivo?"
            description = "El retiro sale de la tesorería y se registra con este motivo."
            hint = withdrawReasonLabel ? null : "Toque el motivo del retiro"
            primary = { label: "Siguiente", onClick: next, disabled: !withdrawReasonLabel }
            body = (
                <ChoiceGroup label="Motivo del retiro" columns="grid-cols-1 sm:grid-cols-2" activation="focus" className="gap-4">
                    {withdrawReasons.map(opt => (
                        <ChoiceCard
                            key={opt.value}
                            size="touch"
                            icon={WITHDRAW_ICONS[opt.value] ?? HandCoins}
                            title={opt.label}
                            description={opt.description}
                            selected={withdrawReason === opt.value}
                            onSelect={() => { setWithdrawReason(opt.value); next() }}
                        />
                    ))}
                </ChoiceGroup>
            )
            break

        case "out-amount": {
            const verb = cashOut === "withdraw" ? "retira" : "traspasa"
            heading = `¿Cuánto ${verb}?`
            description = `Máximo ${formatCurrency(actual)}. Lo que no salga queda en la caja.`
            hint = withdrawal > actual ? "No puede sacar más de lo contado" : withdrawal <= 0 ? "Ingrese un monto mayor a cero" : null
            primary = { label: "Siguiente", onClick: next, disabled: withdrawal <= 0 || withdrawal > actual }
            width = "max-w-xl"
            body = (
                <div className="mx-auto w-full max-w-md surface-panel p-5 shadow-card">
                    <Numpad
                        value={withdrawalAmount}
                        onChange={setWithdrawalAmount}
                        title={cashOut === "withdraw" ? "Monto a retirar" : "Monto a traspasar"}
                        displayValue={formatCurrency(withdrawal)}
                        allowDecimal={!isTouchMode}
                        touch
                        hideConfirm
                        className="w-full max-w-full shadow-none border-0 p-0"
                        onConfirm={() => { if (withdrawal > 0 && withdrawal <= actual) next() }}
                        onExactAmount={() => setWithdrawalAmount(String(actual))}
                        exactAmountLabel={`Todo: ${formatCurrency(actual)}`}
                    />
                </div>
            )
            break
        }

        case "out-destination":
            heading = "¿A dónde lleva el efectivo?"
            description = `Traspaso de ${formatCurrency(withdrawal)}.`
            hint = destination ? null : "Toque la caja o el banco de destino"
            primary = { label: "Siguiente", onClick: next, disabled: !destination }
            width = destinationAccounts.length > 4 ? "max-w-6xl" : "max-w-4xl"
            body = (
                <TransferAccountChoice
                    label="Cuenta de destino"
                    accounts={destinationAccounts}
                    value={destinationId}
                    onChange={id => { setDestinationId(id); next() }}
                />
            )
            break

        case "confirm":
            heading = "Revise y cierre la caja"
            description = session.terminal_name ?? undefined
            hint = canClose ? null : "Falta completar un paso anterior"
            primary = { label: "Cerrar caja", onClick: () => void handleClose(), disabled: !canClose || submitting, final: true, loading: submitting, icon: Lock }
            width = "max-w-2xl"
            body = (
                <div className="space-y-6">
                    <section aria-label="Resumen de cierre" className="surface-panel divide-y divide-border px-6 py-2 shadow-card">
                        {summaryRow("Efectivo esperado", <span className="font-mono tabular-nums">{formatCurrency(expected)}</span>)}
                        {summaryRow("Efectivo contado", <span className="font-mono tabular-nums">{formatCurrency(actual)}</span>, true)}
                        {hasDiff && summaryRow(diff < 0 ? "Falta" : "Sobra", <span className="font-mono tabular-nums">{formatCurrency(Math.abs(diff))}</span>)}
                        {hasDiff && reasonLabel && summaryRow("Motivo", reasonLabel)}
                        {targetAccount && summaryRow(surplus ? "Vino de" : "Se llevó a", targetAccount.name)}
                        {cashOut === "transfer" && destination && summaryRow("Traspaso",
                            <span><span className="font-mono tabular-nums">{formatCurrency(withdrawal)}</span> → {destination.name}</span>)}
                        {cashOut === "withdraw" && withdrawReasonLabel && summaryRow(withdrawReasonLabel,
                            <span className="font-mono tabular-nums">{formatCurrency(withdrawal)}</span>)}
                        {summaryRow("Queda en la caja", <span className="font-mono tabular-nums">{formatCurrency(actual - (movesCash ? withdrawal : 0))}</span>)}
                    </section>
                    {!hasDiff && (
                        <div className="flex items-center gap-4 rounded-lg border border-success/40 bg-success/10 p-5 text-lg">
                            <CheckCircle2 className="size-8 shrink-0 text-success" aria-hidden />
                            <span>El efectivo contado coincide con el sistema.</span>
                        </div>
                    )}
                    <label className="block space-y-2">
                        <span className="text-base font-medium">Notas (opcional)</span>
                        <textarea
                            className="flex min-h-24 w-full resize-none rounded-sm border border-input bg-background px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus:border-ring"
                            rows={3}
                            placeholder="Comentarios sobre el cierre…"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </label>
                </div>
            )
            break
    }

    return (
        <POSFlowLayout
            title={session.terminal_name || "Punto de Venta"}
            subtitle={`Cierre · ${cashModeLabel(session.my_mode)}`}
            steps={stepIds.map(id => ({ id, label: STEP_LABELS[id] }))}
            currentStep={safeIndex}
            progressLabel="Progreso del cierre"
            exitAction={
                <Button variant="ghost" className="h-12 gap-2 px-4 text-base" onClick={onCancel} disabled={submitting}>
                    <X className="size-5" aria-hidden />
                    Cancelar
                </Button>
            }
            stepKey={stepId}
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
