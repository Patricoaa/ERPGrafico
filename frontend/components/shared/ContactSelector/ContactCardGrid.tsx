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
}

export function ContactCardGrid({ selectedId, onSelect, placeholder = "Buscar contacto..." }: ContactCardGridProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 300)
    const { isTouchPOS } = useDeviceContext()

    const { contacts, loading } = useContactSearch({ search: debouncedSearch }, true)

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
                    {contacts.map((contact) => {
                        const isSelected = selectedId === contact.id.toString()
                        return (
                            <Card
                                key={contact.id}
                                className={cn(
                                    "border border-border/50 hover:shadow-elevated transition-all overflow-hidden flex flex-col rounded-md bg-card card-accent-cmyk cursor-pointer shadow-card shadow-black/5",
                                    "focus-visible:border-2 focus-visible:border-primary",
                                    isSelected
                                        ? "border-2 border-primary accent-visible"
                                        : "border",
                                    isTouchPOS && "active:scale-[0.98]"
                                )}
                                onClick={() => onSelect(contact)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex items-start gap-2 p-2.5 pb-1.5">
                                    <div className={cn(
                                        "flex items-center justify-center h-7 w-7 rounded-md shrink-0",
                                        isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                        {contact.contact_type === 'COMPANY' ? (
                                            <Building2 className="h-3.5 w-3.5" />
                                        ) : (
                                            <User className="h-3.5 w-3.5" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="font-bold text-xs truncate leading-tight block">{contact.name}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground truncate block">
                                            {contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                                    <span className="font-semibold text-foreground/80">{formatCurrency(Number(contact.credit_available ?? 0))}</span>
                                    <span className="text-muted-foreground/50">crédito</span>
                                    <span className="text-muted-foreground/30">|</span>
                                    <span className="font-semibold text-destructive">{formatCurrency(Number(contact.credit_balance_used ?? 0))}</span>
                                    <span className="text-muted-foreground/50">adeudado</span>
                                    <span className="text-muted-foreground/30">•</span>
                                    <span>{contact.last_sale_date ? new Date(contact.last_sale_date).toLocaleDateString() : '—'}</span>
                                    <span className="text-muted-foreground/50">última venta</span>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
