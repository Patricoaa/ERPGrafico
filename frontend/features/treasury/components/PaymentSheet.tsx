"use client"

import { useEffect, useState } from "react"
import { FileText, Link2, type LucideIcon } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentDrawerShell,
    DocumentActionsMenu,
    DocumentLifecycle,
    DocumentFieldGrid,
    FormSection,
    StatusBadge,
    type DocumentActionItem,
    type DocumentField,
    type DocumentSheetTab,
    type LifecycleStep,
    ActionConfirmModal,
} from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout } from "@/features/_shared"
import { useDocumentRelations } from "@/features/documents/hooks/useDocumentRelations"
import type { DocumentDomain, DocumentLink } from "@/features/documents/types"
import { DocumentRelationsTab } from "@/features/documents/components/DocumentRelationsTab"
import { formatCurrency } from "@/lib/money"
import { format } from "date-fns"
import { toDate } from "@/lib/utils"
import { financeApi } from "@/features/finance/api/financeApi"
import { usePayment } from "@/features/treasury/hooks/usePayment"
import { useInvalidateDocuments } from "@/features/documents/hooks/useInvalidateDocuments"
import { resolveRegistryActions, type ResolvedDocumentAction } from "@/features/documents/utils/actions"
import { paymentActions } from "@/features/treasury/paymentActions"
import { useCancelPayment, useCancelInvoice } from "@/features/orders"
import { AnnulPaymentModal } from "@/features/orders"
import { useAuth } from "@/contexts/AuthContext"
import type { PaymentDetail } from "../types"
import { showApiError } from "@/lib/errors"
import { Ban, Trash2, RotateCcw } from "lucide-react"

const LABEL = "finance.payment"
const AUDIT_TYPE = "payment"

/**
 * Ficha documental de Pago/Movimiento de Tesorería (ADR-0083, component-document-sheet.md).
 * Modo VISTA: usa DocumentDrawerShell con tabs Resumen · Relaciones,
 * ciclo de vida, actions menu e ActivitySidebar.
 */
export interface PaymentSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    embedded?: boolean
    onActionSuccess?: () => void
}

export function PaymentSheet({ id, open, onOpenChange, embedded = false, onActionSuccess }: PaymentSheetProps) {
    const { data: payment, isLoading: loading, isError, refetch: fetchPaymentDetails } = usePayment(id)
    const { data: relations } = useDocumentRelations(LABEL, id)
    const invalidateDocuments = useInvalidateDocuments()
    const { user } = useAuth()
    const permissions: string[] = user?.permissions ?? []

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)
    const [annulState, setAnnulState] = useState<{ id: number; amount: number; mode: 'annul' | 'return' } | null>(null)
    const [confirm, setConfirm] = useState<{ title: string; description: React.ReactNode; onConfirm: (reason?: string) => Promise<void>; variant: "destructive" | "warning"; confirmText: string; requireReason?: boolean } | null>(null)

    const handleSuccess = () => {
        void fetchPaymentDetails()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const { cancelPayment } = useCancelPayment()
    const { cancelInvoice } = useCancelInvoice()

    const can = (perm: string) => permissions.includes(perm)

    const closeConfirm = () => setConfirm(null)

    const confirmThen = (
        state: { title: string; description: React.ReactNode; variant: "destructive" | "warning"; confirmText: string; requireReason?: boolean },
        run: (reason?: string) => Promise<unknown>,
        errorLabel: string,
    ) => {
        setConfirm({
            ...state,
            onConfirm: async (reason?: string) => {
                try {
                    await run(reason)
                    closeConfirm()
                    handleSuccess()
                } catch (error: unknown) {
                    showApiError(error, errorLabel)
                    throw error
                }
            },
        })
    }

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = payment?.display_id ?? `#${id}`
    const identity = useDrawerIdentity(LABEL, "view", payment, { overrideTitle: displayId })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (payment?.id && displayId) setEntityDisplay(LABEL, payment.id, String(displayId))
    }, [payment?.id, displayId, setEntityDisplay])

    const resolved = resolveRegistryActions(paymentActions, payment, permissions)

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<PaymentDetail>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => {
            if (!payment) return
            if (action.id === "annul-payment") {
                setAnnulState({ id: payment.id, amount: Number(payment.amount), mode: 'annul' })
            } else if (action.id === "return-payment") {
                setAnnulState({ id: payment.id, amount: Number(payment.amount), mode: 'return' })
            } else if (action.id === "cancel-payment") {
                confirmThen(
                    {
                        title: "Cancelar Pago",
                        variant: "destructive",
                        confirmText: "Cancelar",
                        description: "¿Está seguro de que desea cancelar este pago? Esta acción elimina el registro sin crear un asiento de reversión.",
                    },
                    (reason) => cancelPayment({ id: payment.id, reason }),
                    "Error al cancelar el pago",
                )
            }
        },
    })

    const primary = resolved.find((r) => r.action.id === "annul-payment" && !r.disabled) ?? null
    const secondary = resolved.filter((r) => r.action.id !== "annul-payment" && r.action.id !== "cancel-payment")
    const destructive = resolved.find((r) => r.action.id === "cancel-payment") ?? null

    const lifecycleSteps = payment ? getPaymentLifecycle(payment) : null

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "treasury", "accounting"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = payment ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <PaymentSummaryTab payment={payment} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={payment.id}
                    sectionActions={getSectionActions(resolved)}
                    rowActions={getRowActions(can, confirmThen, cancelInvoice)}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <>
            {payment && (
                <PrintableLayout
                    ref={printRef}
                    title="Comprobante de Pago"
                    displayId={String(displayId)}
                    subtitle={payment.movement_type === "INBOUND" ? "Cobro" : "Pago"}
                >
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between"><span>Monto:</span><span className={`font-bold ${payment.movement_type === "INBOUND" ? "text-income" : "text-expense"}`}>{formatCurrency(Number(payment.amount))}</span></div>
                        <div className="flex justify-between"><span>Flujo:</span><span>{payment.movement_type === "INBOUND" ? "Ingreso (Cobro)" : "Egreso (Pago)"}</span></div>
                        <div className="flex justify-between"><span>Método:</span><span>{payment.payment_method_new_name || payment.payment_method_display || "-"}</span></div>
                        <div className="flex justify-between"><span>Referencia:</span><span>{payment.reference || "-"}</span></div>
                        <div className="flex justify-between"><span>Fecha:</span><span>{payment.date ? format(toDate(payment.date), "dd/MM/yyyy") : "-"}</span></div>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={payment && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={[
                            ...secondary.map(toItem),
                            ...(destructive ? [toItem(destructive)] : []),
                        ]}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!payment && !isError)}
                error={isError ? new Error("No se pudo cargar el pago") : undefined}
                loadingLabel="Cargando pago"
                lifecycle={lifecycleSteps && (
                    <DocumentLifecycle
                        steps={lifecycleSteps}
                        onStepClick={openRelationsAt}
                        activeStepId={tab === "relations" ? domain : null}
                    />
                )}
                tabs={tabs}
                tab={tab}
                onTabChange={setTab}
                sidebar={payment && !embedded ? <ActivitySidebar entityType={AUDIT_TYPE} entityId={payment.id} /> : undefined}
            />

            {annulState && (
                <AnnulPaymentModal
                    key={`${annulState.id}-${annulState.mode}`}
                    open
                    onOpenChange={(open) => { if (!open) setAnnulState(null) }}
                    paymentId={annulState.id}
                    paymentAmount={annulState.amount}
                    isSale={false}
                    mode={annulState.mode}
                    onSuccess={() => { setAnnulState(null); handleSuccess() }}
                />
            )}

            {confirm && (
                <ActionConfirmModal
                    open
                    onOpenChange={(open) => { if (!open) closeConfirm() }}
                    title={confirm.title}
                    description={confirm.description}
                    onConfirm={confirm.onConfirm}
                    variant={confirm.variant}
                    confirmText={confirm.confirmText}
                    requireReason={confirm.requireReason}
                    reasonLabel="Motivo"
                />
            )}
        </>
    )
}

function PaymentSummaryTab({ payment }: { payment: PaymentDetail }) {
    const contextFields: DocumentField[] = [
        {
            label: "Estado",
            value: <StatusBadge status={payment.status ?? ""} variant="badge" />,
        },
        {
            label: "Flujo",
            value: payment.movement_type === "INBOUND" ? "Ingreso (Cobro)" : "Egreso (Pago)",
        },
        {
            label: "Método de Pago",
            value: payment.payment_method_new_name || payment.payment_method_display || "—",
        },
        {
            label: "Referencia",
            value: payment.reference || "—",
        },
        {
            label: "Fecha",
            value: payment.date ? format(toDate(payment.date), "dd/MM/yyyy") : "—",
        },
        {
            label: "Contacto",
            value: payment.partner_name || "—",
        },
        {
            label: "Cuenta Tesorería",
            value: payment.treasury_account_name || "—",
        },
        ...(payment.notes ? [{
            label: "Notas",
            value: payment.notes,
            span: 4 as const,
        }] : []),
    ]

    return (
        <div className="space-y-8">
            <section aria-label="Contexto">
                <DocumentFieldGrid fields={contextFields} className="w-auto justify-start text-left" />
            </section>
        </div>
    )
}

function getPaymentLifecycle(payment: PaymentDetail): LifecycleStep[] {
    const steps: LifecycleStep[] = [
        { id: "origin", label: "Origen", icon: FileText, status: "success" },
    ]

    if (payment.status === "POSTED" || payment.status === "RECONCILED") {
        steps.push({ id: "posted", label: "Contabilizado", icon: FileText, status: "success" })
    } else if (payment.status === "PENDING") {
        steps.push({ id: "posted", label: "Contabilizar", icon: FileText, status: "active" })
    } else {
        steps.push({ id: "posted", label: "Contabilizar", icon: FileText, status: "neutral" })
    }

    if (payment.status === "RECONCILED") {
        steps.push({ id: "reconciled", label: "Conciliado", icon: FileText, status: "success" })
    } else if (payment.status === "POSTED") {
        steps.push({ id: "reconciled", label: "Conciliar", icon: FileText, status: "neutral" })
    }

    return steps
}

function getSectionActions(resolved: ResolvedDocumentAction<PaymentDetail>[]): Partial<Record<DocumentDomain, DocumentActionItem[]>> {
    const result: Partial<Record<DocumentDomain, DocumentActionItem[]>> = {}
    for (const r of resolved) {
        const domain = r.category as DocumentDomain
        if (domain) {
            (result[domain] ??= []).push({
                id: r.action.id,
                label: r.action.label,
                icon: r.action.icon,
                disabled: r.disabled,
                disabledReason: r.disabledReason,
                onClick: () => {}, // Actions are handled in the main toItem
            })
        }
    }
    return result
}

function getRowActions(
    can: (perm: string) => boolean,
    confirmThen: (state: { title: string; description: React.ReactNode; variant: "destructive" | "warning"; confirmText: string; requireReason?: boolean }, run: (reason?: string) => Promise<unknown>, errorLabel: string) => void,
    cancelInvoice: (params: { id: number; reason?: string }) => Promise<unknown>
): (link: DocumentLink) => DocumentActionItem[] {
    return (link) => {
        const { label, id, status: linkStatus, accessible } = link.target
        if (!accessible || linkStatus === "CANCELLED") return []

        if (label === "billing.invoice" && linkStatus === "DRAFT" && can("billing.delete_invoice")) {
            return [{
                id: "cancel-draft-invoice",
                label: "Cancelar borrador",
                icon: Trash2,
                variant: "destructive",
                onClick: () => confirmThen(
                    {
                        title: "Cancelar Borrador",
                        variant: "destructive",
                        confirmText: "Cancelar Borrador",
                        description: "¿Estás seguro de que deseas cancelar este borrador de factura?",
                    },
                    (reason) => cancelInvoice({ id, reason }),
                    "No se pudo cancelar el borrador",
                ),
            }]
        }
        return []
    }
}