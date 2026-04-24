"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, User, Building2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"
import { formatRUT } from "@/lib/utils/format"
import { useContactSearch } from "@/features/contacts/hooks/useContactSearch"
import { EmptyState } from "@/components/shared/EmptyState"
import { Contact } from "@/types/entities"
import { CardSkeleton } from "@/components/shared"
import React, { Suspense } from "react"

const ContactModal = React.lazy(() => import("@/features/contacts/components/ContactModal"))

interface AdvancedContactSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    contactType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'
    onSelectContact?: (contact: Contact) => void
    disabled?: boolean
    isPartnerOnly?: boolean
    label?: string
    error?: string
    className?: string
}

export function AdvancedContactSelector({
    value,
    onChange,
    placeholder = "Seleccionar contacto...",
    contactType,
    onSelectContact,
    disabled,
    isPartnerOnly,
    label,
    error,
    className
}: AdvancedContactSelectorProps) {
    const { contacts, singleContact, loading: searchLoading, fetchContacts, fetchSingleContact } = useContactSearch()
    const [open, setOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

    // Fetch initial selected contact if value exists
    useEffect(() => {
        if (value && !selectedContact && value.toString() !== singleContact?.id.toString()) {
            fetchSingleContact(value.toString())
        } else if (!value) {
            requestAnimationFrame(() => setSelectedContact(null))
        }
    }, [value, selectedContact, singleContact, fetchSingleContact])

    // Sync fetched single contact to local state
    useEffect(() => {
        if (singleContact && singleContact.id.toString() === value?.toString()) {
            requestAnimationFrame(() => setSelectedContact(singleContact))
        }
    }, [singleContact, value])

    // Fetch contacts on search
    useEffect(() => {
        if (open) {
            fetchContacts({
                search: debouncedSearch,
                contactType: contactType === 'BOTH' ? undefined : contactType as any,
                isCustomer: contactType === 'CUSTOMER' ? true : undefined,
                isVendor: contactType === 'SUPPLIER' ? true : undefined,
                isPartnerOnly
            })
        }
    }, [debouncedSearch, open, contactType, isPartnerOnly, fetchContacts])

    const handleSelect = (contact: Contact) => {
        setSelectedContact(contact)
        onChange(contact.id.toString())
        if (onSelectContact) {
            onSelectContact(contact)
        }
        setOpen(false)
        setSearchTerm("")
    }

    const handleCreateSuccess = (contact?: Contact) => {
        if (contact) {
            handleSelect(contact)
            // Agregamos una búsqueda extra en el background para tenerlo en la lista la próxima vez
            setSearchTerm(contact.name)
        }
        setIsCreateModalOpen(false)
    }

    const initialContactTemplate = contactType === 'CUSTOMER' 
        ? { is_default_customer: true, is_default_vendor: false } 
        : contactType === 'SUPPLIER' 
            ? { is_default_customer: false, is_default_vendor: true } 
            : null;

    return (
        <div className={cn("relative w-full flex flex-col group", className)}>
            <fieldset 
                className={cn(
                    "notched-field w-full group transition-all",
                    open && "focused",
                    error && "error",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                )}
            >
                {label && (
                    <legend className={cn("notched-legend", error && "text-destructive", disabled && "text-muted-foreground/50")}>
                        {label}
                    </legend>
                )}
                <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between overflow-hidden h-auto py-2 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                    disabled={disabled}
                >
                    {selectedContact ? (
                        <div className="flex items-center gap-2 truncate text-left w-[calc(100%-20px)]">
                            <div className={cn("p-1.5 rounded-md shrink-0", disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                                {selectedContact.contact_type === 'COMPANY' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col items-start truncate leading-tight">
                                <span className="font-medium text-sm truncate w-full">{selectedContact.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate w-full">
                                    {selectedContact.tax_id ? formatRUT(selectedContact.tax_id) : 'S/Rut'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    {!disabled && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 flex items-center px-3 border rounded-md bg-background">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar por nombre, rut, código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 shrink-0 border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                                        onClick={() => {
                                            setOpen(false)
                                            setIsCreateModalOpen(true)
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Crear nuevo contacto</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {searchLoading ? (
                            <div className="p-2 space-y-1">
                                <CardSkeleton variant="compact" count={5} />
                            </div>
                        ) : contacts.length === 0 ? (
                            <EmptyState
                                context="search"
                                variant="compact"
                                title={searchTerm ? "No se encontraron contactos" : "Escriba para buscar"}
                                description={searchTerm ? "Use el botón + para crear un nuevo contacto." : undefined}
                            />
                        ) : (
                            contacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className={cn(
                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                        selectedContact?.id === contact.id && "bg-accent"
                                    )}
                                    onClick={() => handleSelect(contact)}
                                >
                                    <div className="flex items-center gap-3 w-full overflow-hidden">
                                        <div className="flex-shrink-0">
                                            {contact.contact_type === 'COMPANY' ? (
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="truncate font-medium">{contact.name}</span>
                                            <span className="text-xs text-muted-foreground truncate">
                                                {contact.tax_id ? formatRUT(contact.tax_id) : 'S/Rut'}
                                                {contact.code && ` • ${contact.code}`}
                                            </span>
                                        </div>
                                        {selectedContact?.id === contact.id && (
                                            <Check className="ml-auto h-4 w-4 opacity-100 flex-shrink-0" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
        </fieldset>
            {error && (
                <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 w-full text-left px-1">
                    {error}
                </p>
            )}

            {isCreateModalOpen && (
                <Suspense fallback={<div />}>
                    <ContactModal
                        open={isCreateModalOpen}
                        onOpenChange={setIsCreateModalOpen}
                        onSuccess={handleCreateSuccess as any}
                        contact={initialContactTemplate as any}
                    />
                </Suspense>
            )}
        </div>
    )
}
