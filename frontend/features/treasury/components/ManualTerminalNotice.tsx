"use client"

import { AlertTriangle, CreditCard, Banknote, FileWarning, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { formatCurrency } from "@/lib/utils"

export type ManualTerminalReason = "FACTURA_CARD" | "BOLETA_MANUAL" | "TERMINAL_BYPASS"

interface ManualTerminalNoticeProps {
    reason: ManualTerminalReason
    amount: number
    paymentMethodName?: string
    onConfirm: () => void
    onCancel: () => void
    /** Volver al paso de pago para elegir otro método — solo tiene sentido si TUU rechazó la tarjeta (MR-*). */
    onSwitchPaymentMethod?: () => void
    /** Código de TUU (MR-*, RP-*, TIMEOUT, NETWORK, 401, RATE-LIMIT) — ramifica el copy de TERMINAL_BYPASS. */
    failureReason?: string
    isLoading?: boolean
    requiresInvoiceReminder?: boolean
}

type BypassVariant = "card_declined" | "timeout" | "terminal_error" | "no_connection" | "generic"

function classifyBypass(failureReason?: string): BypassVariant {
    if (!failureReason) return "generic"
    if (failureReason.startsWith("MR-")) return "card_declined"
    if (failureReason === "TIMEOUT") return "timeout"
    if (failureReason.startsWith("RP-")) return "terminal_error"
    if (failureReason === "NETWORK" || failureReason === "401" || failureReason === "RATE-LIMIT") {
        return "no_connection"
    }
    return "generic"
}

interface BypassCopy {
    title: string
    lines: string[]
    confirmLabel: string
    showSwitchMethod: boolean
}

const BYPASS_COPY: Record<BypassVariant, BypassCopy> = {
    card_declined: {
        title: "Tarjeta rechazada por el emisor",
        lines: [
            "El terminal rechazó la transacción de {amount}. No reintentes con la misma tarjeta.",
            "Ofrece al cliente otro medio de pago (efectivo, otra tarjeta, transferencia).",
        ],
        confirmLabel: "Registrar igual (cobré manualmente)",
        showSwitchMethod: true,
    },
    timeout: {
        title: "Terminal no respondió a tiempo",
        lines: [
            "El terminal TUU no respondió en 3 minutos. Cobra {amount} directamente en el dispositivo físico.",
            "Registrará el pago como tarjeta manual sin integración automática.",
        ],
        confirmLabel: "Cobré manualmente — Registrar",
        showSwitchMethod: false,
    },
    terminal_error: {
        title: "Error en el terminal físico",
        lines: [
            "El terminal reportó un error. Verifica conectividad o procesa el cobro de {amount} manualmente en el dispositivo.",
        ],
        confirmLabel: "Cobré manualmente — Registrar",
        showSwitchMethod: false,
    },
    no_connection: {
        title: "Sin conexión con TUU",
        lines: [
            "No se pudo contactar al gateway TUU. Cobra {amount} directamente en el terminal físico y registra el pago.",
        ],
        confirmLabel: "Cobré manualmente — Registrar",
        showSwitchMethod: false,
    },
    generic: {
        title: "Terminal no disponible — registro manual",
        lines: [
            "El terminal TUU no respondió. Cobra {amount} directamente en el dispositivo físico.",
            "El sistema registrará el pago como tarjeta manual sin integración automática.",
        ],
        confirmLabel: "Cobré manualmente — Registrar",
        showSwitchMethod: false,
    },
}

interface NoticeConfig {
    icon: React.ReactNode
    title: string
    lines: string[]
    confirmLabel: string
    showSwitchMethod?: boolean
}

const STATIC_NOTICE: Record<Exclude<ManualTerminalReason, "TERMINAL_BYPASS">, NoticeConfig> = {
    FACTURA_CARD: {
        icon: <CreditCard className="h-8 w-8 " />,
        title: "Opera el terminal manualmente",
        lines: ["El cliente pagará con tarjeta por un monto de {amount}."],
        confirmLabel: "Ya cobré — Registrar Venta",
    },
    BOLETA_MANUAL: {
        icon: <Banknote className="h-8 w-8 text-warning" />,
        title: "Confirma el pago recibido",
        lines: ["Procesa el pago de {amount} en caja."],
        confirmLabel: "Confirmar Pago",
    },
}

function resolveConfig(reason: ManualTerminalReason, failureReason?: string): NoticeConfig {
    if (reason === "TERMINAL_BYPASS") {
        const variant = classifyBypass(failureReason)
        const copy = BYPASS_COPY[variant]
        return {
            icon: <CreditCard className="h-8 w-8 text-warning" />,
            title: copy.title,
            lines: copy.lines,
            confirmLabel: copy.confirmLabel,
            showSwitchMethod: copy.showSwitchMethod,
        }
    }
    return STATIC_NOTICE[reason]
}

export function ManualTerminalNotice({
    reason,
    amount,
    paymentMethodName,
    onConfirm,
    onCancel,
    onSwitchPaymentMethod,
    failureReason,
    isLoading = false,
    requiresInvoiceReminder = false
}: ManualTerminalNoticeProps) {
    const config = resolveConfig(reason, failureReason)
    const formattedAmount = formatCurrency(amount)
    const canSwitchMethod = reason === "TERMINAL_BYPASS"
        && config.showSwitchMethod
        && !!onSwitchPaymentMethod

    return (
        <div className="flex flex-col items-center gap-8 py-2">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-warning/30 bg-warning/5 shadow-inner">
                    {config.icon}
                </div>
                <div className="space-y-1">
                    <h4 className="font-heading text-xl font-black uppercase tracking-tighter text-foreground leading-none">
                        {config.title}
                    </h4>
                    {paymentMethodName && (
                        <div className="flex justify-center">
                            <span className="rounded-md border border-warning/20 bg-warning/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-warning-foreground">
                                {paymentMethodName}
                            </span>
                        </div>
                    )}
                    {reason === "TERMINAL_BYPASS" && failureReason && (
                        <div className="flex justify-center pt-1">
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 border border-border px-2 py-0.5 rounded-md">
                                REF: {failureReason}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full space-y-4">
                {config.lines.map((line, i) => (
                    <div key={i} className="flex gap-3 items-start group">
                        <div className="h-1 w-1 rounded-full bg-warning/40 mt-2 shrink-0 group-hover:bg-warning transition-colors" />
                        <p
                            className="text-sm text-muted-foreground leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: line.replace(
                                    "{amount}",
                                    `<span class="font-mono font-bold text-foreground bg-muted/50 px-1.5 py-0.5 rounded-md border-b-2 border-warning/30">${formattedAmount}</span>`
                                ),
                            }}
                        />
                    </div>
                ))}

                {requiresInvoiceReminder && (
                    <div className="flex gap-3 items-start border border-destructive/30 bg-destructive/5 p-3">
                        <FileWarning className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-destructive uppercase tracking-widest">Atención: Factura Pendiente</p>
                            <p className="text-sm text-destructive/80 mt-1">Este pago está asociado a una Factura que has marcado para emitir luego. Emitela externamente y registra los folios una vez concluido.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex w-full flex-col gap-3 pt-4">
                <div className="flex w-full gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 rounded-md h-12 border-muted-foreground/20 hover:bg-muted/5 font-bold uppercase tracking-widest text-xs"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <ActionSlideButton
                        variant="primary"
                        className="flex-[1.5] h-12 shadow-lg shadow-primary/10 active:translate-y-1 transition-all"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        {config.confirmLabel}
                    </ActionSlideButton>
                </div>
                {canSwitchMethod && (
                    <Button
                        variant="ghost"
                        className="w-full h-10 text-xs uppercase font-bold tracking-widest text-primary hover:bg-primary/5"
                        onClick={onSwitchPaymentMethod}
                        disabled={isLoading}
                    >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Volver al paso de pago
                    </Button>
                )}
            </div>

            <p className="text-[9px] text-center text-muted-foreground uppercase tracking-[0.2em] font-medium opacity-50">
                Operación requiere verificación física del cajero
            </p>
        </div>
    )
}
