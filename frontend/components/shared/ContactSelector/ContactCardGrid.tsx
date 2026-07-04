"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"
import { useContactSearch } from "@/features/contacts/hooks/useContactSearch"
import { useDeviceContext } from "@/hooks/useDeviceContext"
import { EmptyState, CardSkeleton, SearchBar } from "@/components/shared"
import { Building2, User } from "lucide-react"
import { formatRUT } from "@/lib/utils/format"
import { formatCurrency } from "@/lib/money"
import type { Contact } from "@/types/entities"

interface ContactCardGridProps {
    selectedId: string | null
    onSelect: (contact: Contact) => void
    placeholder?: string
    contactType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'
}

export function ContactCardGrid({ selectedId, onSelect, placeholder = "Buscar contacto...", contactType }: ContactCardGridProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 300)
    const { isTouchPOS } = useDeviceContext()

    const { contacts, loading } = useContactSearch({
        search: debouncedSearch,
        contactType,
        limit: 8 // Show more cards in grid mode
    }, true)

    const gridCols = isTouchPOS
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3"

    return (
        <div className="flex flex-col gap-4">
            <SearchBar
                placeholder={placeholder}
                value={searchTerm}
                onChange={setSearchTerm}
                autoFocus
            />

            {loading ? (
                <div className={cn("grid gap-3", gridCols)}>
                    <CardSkeleton variant="compact" count={6} />
                </div>
            ) : contacts.length === 0 ? (
                <EmptyState
                    context="search"
                    variant="compact"
                    title={searchTerm ? "No se encontraron contactos" : "Escriba para buscar"}
                    description={searchTerm ? "Intente con otro término de búsqueda." : "Ingrese nombre, RUT o código del contacto."}
                />
            ) : (
                <div className={cn("grid gap-3", gridCols)}>
                    {contacts.map((contact: Contact) => {
                        const isSelected = selectedId === contact.id.toString()
                        return (
                            <Card
                                key={contact.id}
                                className={cn(
                                    "overflow-hidden flex flex-col cursor-pointer transition-all bg-transparent group",
                                    "focus-visible:border-2 focus-visible:border-primary",
                                    isSelected
                                        ? "border-2 border-primary ring-1 ring-primary/20"
                                        : "border border-border/50 hover:border-border",
                                    isTouchPOS && "active:scale-[0.98]"
                                )}
                                onClick={() => onSelect(contact)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex items-center justify-between gap-2 p-2.5 pb-1.5">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className={cn(
                                            "flex items-center justify-center h-7 w-7 rounded-md shrink-0 transition-colors",
                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                                        )}>
                                            {contact.contact_type === 'COMPANY' ? (
                                                <Building2 className="h-3.5 w-3.5" />
                                            ) : (
                                                <User className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-bold text-xs truncate leading-tight block">{contact.name}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground truncate block mt-0.5">
                                                {contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center justify-center">
                                        <div className={cn(
                                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                                            isSelected ? "border-primary bg-background" : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                                        )}>
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 pb-2 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground mt-auto">
                                    {contactType === 'SUPPLIER' ? (
                                        <>
                                            <span className="font-semibold text-foreground/80">{formatCurrency(Number(contact.credit_available ?? 0))}</span>
                                            <span className="text-muted-foreground/50">línea</span>
                                            <span className="text-muted-foreground/30">|</span>
                                            <span className="font-semibold text-destructive">{formatCurrency(Number(contact.credit_balance_used ?? 0))}</span>
                                            <span className="text-muted-foreground/50">por pagar</span>
                                            <span className="text-muted-foreground/30">•</span>
                                            <span>{(contact as any).last_purchase_date ? new Date((contact as any).last_purchase_date).toLocaleDateString() : '—'}</span>
                                            <span className="text-muted-foreground/50">última compra</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-semibold text-foreground/80">{formatCurrency(Number(contact.credit_available ?? 0))}</span>
                                            <span className="text-muted-foreground/50">crédito</span>
                                            <span className="text-muted-foreground/30">|</span>
                                            <span className="font-semibold text-destructive">{formatCurrency(Number(contact.credit_balance_used ?? 0))}</span>
                                            <span className="text-muted-foreground/50">adeudado</span>
                                            <span className="text-muted-foreground/30">•</span>
                                            <span>{contact.last_sale_date ? new Date(contact.last_sale_date).toLocaleDateString() : '—'}</span>
                                            <span className="text-muted-foreground/50">última venta</span>
                                        </>
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
