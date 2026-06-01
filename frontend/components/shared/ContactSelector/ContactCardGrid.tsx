"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"
import { useContactSearch } from "@/features/contacts/hooks/useContactSearch"
import { useDeviceContext } from "@/hooks/useDeviceContext"
import { EmptyState, CardSkeleton } from "@/components/shared"
import { Search, Building2, User, Check } from "lucide-react"
import { formatRUT } from "@/lib/utils/format"
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
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    className="pl-9 h-10"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>

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
                                    "relative flex flex-col p-4 cursor-pointer transition-all duration-150 hover:shadow-md",
                                    isSelected
                                        ? "ring-2 ring-primary border-primary shadow-sm bg-primary/5"
                                        : "border-border/60 hover:border-primary/30",
                                    isTouchPOS && "active:scale-[0.98]"
                                )}
                                onClick={() => onSelect(contact)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className={cn(
                                        "p-1.5 rounded-md",
                                        isSelected ? "bg-primary/10" : "bg-muted"
                                    )}>
                                        {contact.contact_type === 'COMPANY' ? (
                                            <Building2 className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                        ) : (
                                            <User className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                        )}
                                    </div>
                                    {isSelected && (
                                        <div className="p-0.5 rounded-full bg-primary">
                                            <Check className="h-3 w-3 text-primary-foreground" />
                                        </div>
                                    )}
                                </div>
                                <span className="font-bold text-sm truncate leading-tight">{contact.name}</span>
                                <span className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                                    {contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
                                </span>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
