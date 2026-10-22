"use client"

// ContactSelector/ContactCardGrid
// Searchable grid of contacts for checkout steps (customer / supplier). Each contact is a ChoiceCard:
// Blobatar on the media strip, kind chip, RUT in mono, name, and the credit position pinned at the bottom.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"
import { useContactSearch } from "@/features/contacts/hooks/useContactSearch"
import { useDeviceContext } from "@/hooks/useDeviceContext"
import { EmptyState, CardSkeleton, ChoiceCard, ChoiceGroup } from "@/components/shared"
import { SearchBar } from "@/components/selectors/ProductGridPicker"
import { Blobatar } from "@/components/ui/blobatar"
import { formatRUT } from "@/lib/utils/format"
import { formatCurrency } from "@/lib/money"
import type { Contact } from "@/types/entities"

type ContactKind = 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'

/** Supplier cards read `last_purchase_date`, which the contact search returns but `Contact` does not declare yet. */
type ContactWithPurchases = Contact & { last_purchase_date?: string | null }

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('es-CL') : '—')

function ContactFooter({ contact, contactType }: { contact: ContactWithPurchases; contactType?: ContactKind }) {
    const isSupplier = contactType === 'SUPPLIER'
    const owed = Number(contact.credit_balance_used ?? 0)

    return (
        <span className="flex items-end justify-between gap-2">
            <span className="flex flex-col">
                <span className="text-3xs text-muted-foreground">{isSupplier ? 'Línea de crédito' : 'Crédito disponible'}</span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(Number(contact.credit_available ?? 0))}</span>
            </span>
            <span className="flex flex-col items-end text-3xs text-muted-foreground">
                {owed > 0 && (
                    <span className="font-medium text-destructive">
                        {isSupplier ? 'Por pagar' : 'Adeuda'} {formatCurrency(owed)}
                    </span>
                )}
                <span>
                    {isSupplier ? 'Última compra' : 'Última venta'} {formatDate(isSupplier ? contact.last_purchase_date : contact.last_sale_date)}
                </span>
            </span>
        </span>
    )
}

export interface ContactCardProps {
    contact: Contact
    selected: boolean
    onSelect: (contact: Contact) => void
    contactType?: ContactKind
    className?: string
}

/** One contact as a ChoiceCard: Blobatar strip, kind chip, RUT, name, credit position. */
export function ContactCard({ contact, selected, onSelect, contactType, className }: ContactCardProps) {
    return (
        <ChoiceCard
            selected={selected}
            onSelect={() => onSelect(contact)}
            media={<Blobatar name={contact.name} className="size-14 rounded-sm" />}
            badge={contact.contact_type === 'COMPANY' ? 'Empresa' : 'Persona'}
            meta={contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
            title={contact.name}
            footer={<ContactFooter contact={contact} contactType={contactType} />}
            className={className}
        />
    )
}

interface ContactCardGridProps {
    selectedId: string | null
    onSelect: (contact: Contact) => void
    placeholder?: string
    contactType?: ContactKind
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
                <CardSkeleton variant="contact-card" count={6} gridClassName={gridCols} />
            ) : contacts.length === 0 ? (
                <EmptyState
                    context="search"
                    variant="compact"
                    title={searchTerm ? "No se encontraron contactos" : "Escriba para buscar"}
                    description={searchTerm ? "Intente con otro término de búsqueda." : "Ingrese nombre, RUT o código del contacto."}
                />
            ) : (
                <ChoiceGroup label="Contactos" columns={gridCols}>
                    {contacts.map((contact: Contact) => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            selected={selectedId === contact.id.toString()}
                            onSelect={onSelect}
                            contactType={contactType}
                            className={cn(isTouchPOS && "active:scale-[0.98]")}
                        />
                    ))}
                </ChoiceGroup>
            )}
        </div>
    )
}
