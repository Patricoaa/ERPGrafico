"use client"

// ContactSelector/ContactCardGrid
// Searchable grid of contacts for checkout steps (customer / supplier). Each contact is a ChoiceCard:
// Blobatar on the media strip, kind chip, RUT in mono, name, and the credit position pinned at the bottom.

import { useState } from "react"
import { cn, formatPlainDate } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"
import { useContactSearch } from "@/features/contacts"
import { useDeviceContext } from "@/hooks/useDeviceContext"
import { EmptyState, CardSkeleton, ChoiceCard, ChoiceGroup } from "@/components/shared"
import { SearchBar } from "@/components/selectors/ProductGridPicker"
import { Blobatar } from "@/components/ui/blobatar"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContactDrawer } from "@/features/contacts"
import { formatRUT } from "@/lib/utils/format"
import { formatCurrency } from "@/lib/money"
import type { Contact } from "@/types/entities"

type ContactKind = 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'

/** Supplier cards read `last_purchase_date`, which the contact search returns but `Contact` does not declare yet. */
type ContactWithPurchases = Contact & { last_purchase_date?: string | null }

const formatDate = (value?: string | null) => (formatPlainDate(value))

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
            badge={contact.contact_type === 'COMPANY' ? 'Empresa' : 'Contacto'}
            meta={contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
            title={contact.name}
            footer={<ContactFooter contact={contact} contactType={contactType} />}
            className={className}
        />
    )
}

/** Leading card of the grid: an empty-state card that opens the contact creation flow. */
function ContactCreateCard({ onCreate }: { onCreate: () => void }) {
    return (
        <Button
            type="button"
            variant="outline"
            onClick={onCreate}
            className="h-auto min-h-[12rem] flex-col gap-3 whitespace-normal rounded-md border-dashed border-primary/50 bg-card p-4 text-center text-primary hover:border-primary hover:bg-primary/5"
        >
            <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-primary/50">
                <Plus className="size-5" />
            </span>
            <span className="text-sm font-semibold">Nuevo contacto</span>
            <span className="text-3xs text-muted-foreground">Crear y seleccionar</span>
        </Button>
    )
}

interface ContactCardGridProps {
    selectedId: string | null
    onSelect: (contact: Contact) => void
    placeholder?: string
    contactType?: ContactKind
    /** Enables contact creation: the grid starts with a create card and an empty state offers the same action. */
    creatable?: boolean
}

export function ContactCardGrid({ selectedId, onSelect, placeholder = "Buscar contacto...", contactType, creatable = false }: ContactCardGridProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const debouncedSearch = useDebounce(searchTerm, 300)
    const { isTouchPOS } = useDeviceContext()

    // Select the new contact and search for it, so its card shows up highlighted in the grid.
    const handleCreated = (contact?: Contact) => {
        if (contact) {
            onSelect(contact)
            setSearchTerm(contact.name)
        }
        setIsCreateOpen(false)
    }

    const onCreate = creatable ? () => setIsCreateOpen(true) : undefined

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
                <div className="flex min-h-[16rem] flex-1 items-center justify-center">
                        <EmptyState
                            context="search"
                            variant="compact"
                            title={searchTerm ? "No se encontraron contactos" : "Escriba para buscar"}
                            description={searchTerm ? "Intente con otro término de búsqueda." : "Ingrese nombre, RUT o código del contacto."}
                            action={onCreate ? (
                                <Button size="sm" onClick={onCreate}>
                                    <Plus className="size-4" />
                                    Crear contacto
                                </Button>
                            ) : undefined}
                        />
                </div>
            ) : (
                <ChoiceGroup label="Contactos" columns={gridCols}>
                    {onCreate && <ContactCreateCard onCreate={onCreate} />}
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

            {isCreateOpen && (
                <ContactDrawer
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    onSuccess={handleCreated}
                    contact={null}
                    mode="create"
                    boundary="screen"
                    showOverlay
                />
            )}
        </div>
    )
}
