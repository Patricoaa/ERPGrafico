"use client"

import { useRouter, useSearchParams } from "next/navigation"
import React, { useState, useEffect, lazy, Suspense } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2, User as UserIcon, Banknote } from "lucide-react"

import { formatRUT } from "@/lib/utils/format"
import { DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataCell, Chip, AutoEntityCard } from '@/components/shared'
import { contactFields } from "@/features/contacts/contactFields"
import { contactActions, type ContactActionsCtx } from "@/features/contacts/contactActions"
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { contactsUnifiedSearchDef } from "@/features/contacts/unifiedSearchDef"
import type { ContactFilters } from "@/features/contacts/types"
import { formatCurrency } from "@/lib/money"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

// Lazy load heavy components
const ContactDrawer = lazy(() => import("./ContactDrawer"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))

function ContactRoleIcons({ contact }: { contact: Contact }) {
    const hasCustomer = contact.is_default_customer
    const hasVendor = contact.is_default_vendor
    if (!hasCustomer && !hasVendor) return null

    return (
        <div className="flex items-center gap-1 shrink-0">
            {hasCustomer && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <UserIcon className="h-3 w-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-sm">Cliente por defecto</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {hasVendor && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
                                <Building2 className="h-3 w-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-sm">Proveedor por defecto</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
    initialContacts?: Contact[]
}

export function ContactsClientView({ isNewModalOpen = false, createAction, initialContacts }: ContactsClientViewProps) {
    const search = useUnifiedSearch(contactsUnifiedSearchDef)
    const { contacts, isLoading, isRefetching, deleteContact } = useContacts({
        filters: search.filters as ContactFilters,
        initialData: initialContacts,
    })
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { openSelected } = useEntityRouteActions()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Contact>({
        endpoint: '/contacts'
    })

    const isCreateOpen = searchParams.get("modal") === "new" || isNewModalOpen
    const isEditOpen = !!selectedFromUrl
    const drawerOpen = isCreateOpen || isEditOpen

    const handleCloseModal = (open: boolean) => {
        if (!open) {
            if (isEditOpen) clearSelection()
            if (isCreateOpen && searchParams.get("modal") === "new") {
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

    const actionsCtx: ContactActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (contact) => handleDelete(contact),
    }

    const columns = React.useMemo<ColumnDef<Contact>[]>(() => [
        ...contactFields.toColumns().map(col => {
            const key = col.id || (col as any).accessorKey;
            
            if (key === 'tax_id') {
                return {
                    ...col,
                    header: ({ column }: any) => <DataTableColumnHeader column={column} title="RUT / Identificación" className="justify-center" />,
                    cell: ({ row }: any) => {
                        const taxId = row.getValue("tax_id") as string | null
                        return <DataCell.Text>{taxId ? formatRUT(taxId) : 'S/Rut'}</DataCell.Text>
                    },
                }
            }

            if (key === 'name') {
                return {
                    ...col,
                    header: ({ column }: any) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
                    cell: ({ row }: any) => {
                        const contact = row.original as Contact
                        return (
                            <div className="flex items-center justify-center gap-2 w-full">
                                <ContactRoleIcons contact={contact} />
                                <DataCell.Text>{contact.name}</DataCell.Text>
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
                                            <TooltipContent className="rounded-sm">
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
                        )
                    }
                }
            }
            
            return col;
        }) as ColumnDef<Contact>[],


        contactActions.auto(actionsCtx),
    ] as ColumnDef<Contact>[], [actionsCtx])

    return (

        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="contacts.contact"
                        columns={columns}
                        data={contacts}
                        isLoading={isLoading}
                        isRefetching={isRefetching}
                        variant="embedded"
                        unifiedSearch={<UnifiedSearchBar
                            config={contactsUnifiedSearchDef}
                            chips={search.chips}
                            isFiltered={search.isFiltered}
                            inputValue={search.inputValue}
                            onInputChange={search.setInputValue}
                            onApply={search.applyFilter}
                            onRemove={search.removeFilter}
                            onClearAll={search.clearAll}
                            groupBy={search.groupBy}
                            onGroupBySelect={search.setGroupBy}
                            paramValues={search.paramValues}
                            placeholder="Buscar por nombre, RUT o email..."
                        />}
                        unifiedSearchConfig={contactsUnifiedSearchDef}
                        currentGroupBy={search.groupBy}
                        showReset={search.isFiltered}
                        onReset={search.clearAll}
                        defaultPageSize={20}
                        createAction={createAction}
                        isFiltered={search.isFiltered}
                        emptyState={{
                            context: "users",
                            title: "Aún no hay contactos",
                            description: "Crea tu primer cliente o proveedor para empezar a operar.",
                        }}
                        renderCard={(contact: Contact) => (
                            <AutoEntityCard 
                                key={contact.id}
                                data={contact}
                                fields={contactFields}
                                entityLabel="contacts.contact"
                                title={
                                    <span className="flex items-center gap-1.5">
                                        <ContactRoleIcons contact={contact} />
                                        {contact.name}
                                    </span>
                                }
                                actions={contactActions.render(contact, actionsCtx)}
                                defaultAction={contactActions.defaultAction(actionsCtx)?.(contact) ?? (() => openSelected(contact.id))}

                            />
                        )}
                    />
            </div>

            <Suspense fallback={<LoadingFallback />}>
                <ContactDrawer
                    open={drawerOpen}
                    onOpenChange={handleCloseModal}
                    contact={selectedFromUrl ?? undefined}
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
