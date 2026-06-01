import { useRouter, useSearchParams, usePathname } from "next/navigation"
import React, { useState, useEffect, lazy, Suspense } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Building2, User as UserIcon, Banknote } from "lucide-react"

import { formatRUT } from "@/lib/utils/format"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataCell, createActionsColumn, Chip, EntityCard } from '@/components/shared'
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback, SmartSearchBar, StatusBadge, useSmartSearch } from "@/components/shared"
import { contactSearchDef } from "@/features/contacts/searchDef"
import type { ContactFilters } from "@/features/contacts/types"
import { formatCurrency } from "@/lib/money"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

// Lazy load heavy components
const ContactDrawer = lazy(() => import("./ContactDrawer"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))

interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
}

export function ContactsClientView({ isNewModalOpen = false, createAction }: ContactsClientViewProps) {
    const { filters: smartFilters, isFiltered } = useSmartSearch(contactSearchDef)
    const { contacts, isLoading, deleteContact } = useContacts({ filters: smartFilters as ContactFilters })
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const { openSelected } = useEntityRouteActions()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Contact>({
        endpoint: '/contacts'
    })

    // Sync modal with props from URL
    useEffect(() => {
        if (isNewModalOpen) {
            requestAnimationFrame(() => {
                setSelectedContact(null)
                setModalOpen(true)
            })
        }
    }, [isNewModalOpen])

    // Sync modal with selected entity from URL (deep-link)
    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setSelectedContact(selectedFromUrl)
                setModalOpen(true)
            })
        }
    }, [selectedFromUrl])

    const handleCloseModal = (open: boolean) => {
        setModalOpen(open)
        if (!open) {
            setSelectedContact(null)
            clearSelection()
            // Clear URL params if it was a 'new' modal
            if (searchParams.get("modal") === "new") {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`)
            }
        }
    }

    const handleDelete = async (contact: Contact, isConfirmed = false) => {
        if (!contact) return
        if (!isConfirmed) {
            setContactToDelete(contact)
            setIsDeleteModalOpen(true)
            return
        }
        try {
            await deleteContact(contact.id)
            setIsDeleteModalOpen(false)
        } catch {
            // Error handling is done in the hook
        }
    }

    const getContactTypeBadge = (type: string) => {
        return <StatusBadge status={type} size="sm" />
    }

    const columns: ColumnDef<Contact>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.original.display_id}</DataCell.Code>,
        },
        {
            accessorKey: "tax_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="RUT / Identificación" className="justify-center" />,
            cell: ({ row }) => {
                const taxId = row.getValue("tax_id") as string | null
                return <DataCell.Text>{taxId ? formatRUT(taxId) : 'S/Rut'}</DataCell.Text>
            },
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => {
                const contact = row.original as Contact
                return (
                    <div className="flex items-center justify-center gap-2 w-full">
                        <DataCell.Text>{contact.name}</DataCell.Text>
                        <div className="flex gap-1 shrink-0">
                            {contact.is_default_customer && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Chip size="xs" intent="primary" icon={UserIcon} className="cursor-help shrink-0">Cliente</Chip>
                                        </TooltipTrigger>
                                        <TooltipContent>Cliente por defecto</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {contact.is_default_vendor && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Chip size="xs" intent="success" icon={Building2} className="cursor-help shrink-0">Proveedor</Chip>
                                        </TooltipTrigger>
                                        <TooltipContent>Proveedor por defecto</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {(Number(contact.credit_limit || 0) > 0 || Number(contact.credit_balance_used || 0) > 0) && !contact.credit_blocked && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Chip
                                                size="xs"
                                                intent={Number(contact.credit_balance_used || 0) > 0 ? "warning" : "success"}
                                                icon={Banknote}
                                                className="cursor-help shrink-0"
                                            >
                                                Crédito
                                            </Chip>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <div className="flex flex-col gap-1">
                                                {Number(contact.credit_limit || 0) > 0 && (
                                                    <span>Límite de Crédito: {formatCurrency(Number(contact.credit_limit || 0))} ({contact.credit_days} días)</span>
                                                )}
                                                {Number(contact.credit_balance_used || 0) > 0 && (
                                                    <span className="font-bold text-warning">
                                                        Deuda Activa: {formatCurrency(Number(contact.credit_balance_used || 0))}
                                                    </span>
                                                )}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                )
            },
        },

        {
            accessorKey: "active_roles",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Roles" className="justify-center" />,
            cell: ({ row }) => {
                const roles = row.original.active_roles || []
                return (
                    <div className="flex flex-wrap gap-1 justify-center w-full">
                        {roles.map(role => (
                            <Chip.Category key={role} domain="contact_type" value={role} size="xs" />
                        ))}
                    </div>
                )
            },
        },
        {
            accessorKey: "email",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Email" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("email") || "-"}</DataCell.Text>,
        },
        {
            accessorKey: "phone",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Teléfono" className="justify-center" />,
            cell: ({ row }) => <DataCell.Text>{row.getValue("phone") || "-"}</DataCell.Text>,
        },
        createActionsColumn<Contact>({
            renderActions: (contact) => (
                <>
                    <DataCell.Action
                        action="edit"
                        onClick={() => openSelected(contact.id)}
                    />
                    {!contact.is_default_customer && !contact.is_default_vendor && (
                        <DataCell.Action
                            action="delete"
                            onClick={() => handleDelete(contact)}
                        />
                    )}
                </>
            ),
        }),
    ]

    return (

        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="contacts.contact"
                        columns={columns}
                        data={contacts}
                        isLoading={isLoading}
                        variant="embedded"
                        leftAction={<SmartSearchBar searchDef={contactSearchDef} placeholder="Buscar por nombre, RUT o tipo..." className="w-full" />}
                        defaultPageSize={20}
                        createAction={createAction}
                        isFiltered={isFiltered}
                        emptyState={{
                            context: "users",
                            title: "Aún no hay contactos",
                            description: "Crea tu primer cliente o proveedor para empezar a operar.",
                        }}
                        renderCard={(contact: Contact) => (
                            <EntityCard key={contact.id} onClick={() => openSelected(contact.id)}>
                                <EntityCard.Header
                                    title={contact.name}
                                    subtitle={contact.tax_id || 'S/Rut'}
                                    trailing={
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex gap-1 flex-wrap justify-end">
                                                {contact.active_roles?.map(role => (
                                                    <Chip.Category key={role} domain="contact_type" value={role} size="xs" />
                                                ))}
                                            </div>
                                            <div className="flex gap-1">
                                                {contact.is_default_customer && <Chip size="xs" intent="primary" icon={UserIcon}>Cliente</Chip>}
                                                {contact.is_default_vendor && <Chip size="xs" intent="success" icon={Building2}>Proveedor</Chip>}
                                            </div>
                                        </div>
                                    }
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Email" value={contact.email || '-'} />
                                    <EntityCard.Field label="Teléfono" value={contact.phone || '-'} />
                                    {Number(contact.credit_limit || 0) > 0 && (
                                        <EntityCard.Field label="Crédito" value={`${formatCurrency(Number(contact.credit_limit))} (${contact.credit_days}d)`} />
                                    )}
                                </EntityCard.Body>
                            </EntityCard>
                        )}
                    />
            </div>

            <Suspense fallback={<LoadingFallback />}>
                <ContactDrawer
                    open={modalOpen}
                    onOpenChange={handleCloseModal}
                    contact={selectedContact}
                    onSuccess={() => {
                        handleCloseModal(false)
                        // Automatic invalidation handles refetch
                    }}
                />
            </Suspense>

            <Suspense fallback={<LoadingFallback />}>
                <ActionConfirmModal
                    open={isDeleteModalOpen}
                    onOpenChange={(open: boolean) => setIsDeleteModalOpen(open)}
                    title="Eliminar Contacto"
                    variant="destructive"
                    onConfirm={() => { if (contactToDelete) return handleDelete(contactToDelete, true) }}
                    confirmText="Eliminar"
                    description={
                        <p>
                            ¿Está seguro de que desea eliminar el contacto <strong>{contactToDelete?.name}</strong>?
                            Esta acción no se puede deshacer y puede afectar documentos asociados.
                        </p>
                    }
                />
            </Suspense>
        </div>
    )
}
