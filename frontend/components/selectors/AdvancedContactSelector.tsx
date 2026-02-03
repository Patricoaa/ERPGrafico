"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { useDebounce } from "@/hooks/use-debounce"
import { formatRUT } from "@/lib/utils/format"

interface Contact {
    id: number
    name: string
    tax_id: string
    email?: string
    phone?: string
    contact_type?: 'PERSON' | 'COMPANY'
    code?: string
}

interface AdvancedContactSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    contactType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'
    onSelectContact?: (contact: Contact) => void
    disabled?: boolean
}

export function AdvancedContactSelector({
    value,
    onChange,
    placeholder = "Seleccionar contacto...",
    contactType,
    onSelectContact,
    disabled
}: AdvancedContactSelectorProps) {
    const [open, setOpen] = useState(false)

    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

    // Fetch initial selected contact if value exists
    useEffect(() => {
        const fetchSelected = async () => {
            if (value && !selectedContact) {
                try {
                    const res = await api.get(`/contacts/${value}/`)
                    setSelectedContact(res.data)
                } catch (e) {
                    console.error("Failed to fetch selected contact", e)
                }
            } else if (!value) {
                setSelectedContact(null)
            }
        }
        fetchSelected()
    }, [value])

    // Fetch contacts on search
    useEffect(() => {
        const fetchContacts = async () => {
            setLoading(true)
            try {
                // Determine URL params
                const params = new URLSearchParams()
                if (debouncedSearch) params.append('search', debouncedSearch)
                if (contactType) params.append('type', contactType)

                // If no search, maybe fetch top 10? Or standard list
                const res = await api.get(`/contacts/?${params.toString()}`)
                setContacts(res.data.results || res.data)
            } catch (error) {
                console.error("Error searching contacts", error)
            } finally {
                setLoading(false)
            }
        }

        // Only search if open
        if (open) {
            fetchContacts()
        }
    }, [debouncedSearch, open, contactType])

    const handleSelect = (contact: Contact) => {
        setSelectedContact(contact)
        onChange(contact.id.toString())
        if (onSelectContact) {
            onSelectContact(contact)
        }
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto py-2"
                    disabled={disabled}
                >
                    {selectedContact ? (
                        <div className="flex flex-col items-start text-left overflow-hidden">
                            <span className="font-medium truncate w-full">{selectedContact.name}</span>
                            <span className="text-xs text-muted-foreground">{selectedContact.tax_id ? formatRUT(selectedContact.tax_id) : 'S/Rut'}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar por nombre, rut, código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {loading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                        ) : contacts.length === 0 ? (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                                {searchTerm ? "No se encontraron contactos." : "Escriba para buscar..."}
                            </div>
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
    )
}
