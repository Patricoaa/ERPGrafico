"use client"

import { useDeviceContext } from "@/hooks/useDeviceContext"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { ContactCardGrid, Banner, MoneyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"

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

    const handleSelect = (contact: Contact) => {
        setSelectedCustomerId(contact.id.toString())
        setSelectedCustomerName(contact.name)
    }

    return (
        <div className="space-y-6">
            {/* Pending Debts Banner */}
            {pendingDebts && pendingDebts.length > 0 && (
                <Banner
                    tone="warning"
                    icon={FileWarning}
                    bleed="lg"
                    title={`Deudas pendientes (${pendingDebts.length})`}
                    actions={
                        <div className="flex flex-wrap items-center gap-1.5">
                            {pendingDebts.slice(0, 4).map((debt) => (
                                <Button
                                    key={debt.id}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 border-warning/20 text-warning-foreground hover:bg-warning/10 text-3xs gap-1 font-medium bg-card"
                                    onClick={() => onDebtClick?.(debt)}
                                >
                                    <span className="font-mono">{formatEntityDisplay('sales.saleorder', debt)}</span>
                                    <span className="opacity-60">
                                        <MoneyDisplay amount={debt.balance} inline />
                                    </span>
                                    {(debt.days_overdue ?? 0) > 0 && (
                                        <span className="text-destructive font-medium ml-0.5">
                                            {debt.days_overdue}d
                                        </span>
                                    )}
                                </Button>
                            ))}
                            {pendingDebts.length > 4 && (
                                <div className="text-3xs text-warning/70 py-1 px-1.5 bg-warning/5 rounded border border-warning/10">
                                    +{pendingDebts.length - 4}
                                </div>
                            )}
                        </div>
                    }
                >
                    Total:{" "}
                    <span className="font-bold font-mono">
                        <MoneyDisplay amount={pendingDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0)} inline />
                    </span>
                </Banner>
            )}

            {/* Customer Selector */}
            {showContactGrid ? (
                <ContactCardGrid
                    selectedId={selectedCustomerId}
                    onSelect={handleSelect}
                    placeholder="Buscar por Nombre, RUT o Email..."
                    creatable
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
