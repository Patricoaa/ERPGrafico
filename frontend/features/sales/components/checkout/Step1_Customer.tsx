"use client"

import { useDeviceContext } from "@/hooks/useDeviceContext"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { ContactCardGrid, MoneyDisplay } from "@/components/shared"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { FileWarning } from "lucide-react"
import type { Contact } from "@/types/entities"

interface PendingDebt {
    id: number
    balance: string | number
    days_overdue?: number
    [key: string]: unknown
}

interface Step1_CustomerProps {
    selectedCustomerId: string | null
    setSelectedCustomerId: (id: string | null) => void
    setSelectedCustomerName: (name: string) => void
    pendingDebts?: PendingDebt[] | null
    onDebtClick?: (debt: PendingDebt) => void
    touchMode?: boolean
    isInline?: boolean
}

export function Step1_Customer({
    selectedCustomerId,
    setSelectedCustomerId,
    setSelectedCustomerName,
    pendingDebts,
    onDebtClick,
    touchMode,
    isInline,
}: Step1_CustomerProps) {
    const { isTouchPOS } = useDeviceContext()
    // Show grid in POS inline mode (touch-optimised), fall back to prop or device detection
    const showContactGrid = isInline ? true : (touchMode ?? isTouchPOS)
    const { openHub } = useHubPanel()

    const handleSelect = (contact: Contact) => {
        setSelectedCustomerId(contact.id.toString())
        setSelectedCustomerName(contact.name)
    }

    return (
        <div className="space-y-6">
            {/* Pending Debts Banner */}
            {pendingDebts && pendingDebts.length > 0 && (
                <Alert variant="warning">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <FileWarning className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="text-sm font-bold text-warning-foreground shrink-0">
                                    Deudas Pendientes ({pendingDebts.length})
                                </span>
                                <span className="text-xs text-warning-foreground/80 leading-none">
                                    Total:{" "}
                                    <span className="font-bold font-mono">
                                        <MoneyDisplay amount={pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0)} inline />
                                    </span>
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 ml-8 sm:ml-0">
                            {pendingDebts.slice(0, 4).map((debt) => (
                                <Button
                                    key={debt.id}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 border-warning/20 text-warning-foreground hover:bg-warning/10 text-[10px] gap-1 font-medium bg-card"
                                    onClick={() => onDebtClick?.(debt)}
                                >
                                    <span className="font-mono">{formatEntityDisplay('sales.saleorder', debt)}</span>
                                    <span className="opacity-60">
                                        <MoneyDisplay amount={debt.balance} inline />
                                    </span>
                                    {(debt.days_overdue ?? 0) > 0 && (
                                        <span className="text-destructive font-bold ml-0.5">
                                            {debt.days_overdue}d
                                        </span>
                                    )}
                                </Button>
                            ))}
                            {pendingDebts.length > 4 && (
                                <div className="text-[10px] text-warning/70 py-1 px-1.5 bg-warning/5 rounded border border-warning/10">
                                    +{pendingDebts.length - 4}
                                </div>
                            )}
                        </div>
                    </div>
                </Alert>
            )}

            {/* Customer Selector */}
            {showContactGrid ? (
                <ContactCardGrid
                    selectedId={selectedCustomerId}
                    onSelect={handleSelect}
                    placeholder="Buscar por Nombre, RUT o Email..."
                />
            ) : (
                <div className="space-y-4">
                    <AdvancedContactSelector
                        label="Seleccionar Cliente"
                        value={selectedCustomerId}
                        onChange={(id) => setSelectedCustomerId(id)}
                        onSelectContact={(contact) => setSelectedCustomerName(contact.name)}
                        placeholder="Buscar por Nombre, RUT o Email..."
                    />
                </div>
            )}
        </div>
    )
}
