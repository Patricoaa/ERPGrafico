import { useRouter, useSearchParams, usePathname } from "next/navigation"
import React, { useState, useEffect, lazy, Suspense } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Plus, Building2, User as UserIcon, Banknote } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatRUT } from "@/lib/utils/format"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { useContacts, type Contact } from "@/features/contacts"
import { LoadingFallback, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

// Lazy load heavy components
const ContactModal = lazy(() => import("./ContactModal"))
const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))



interface ContactsClientViewProps {
    isNewModalOpen?: boolean
    createAction?: React.ReactNode
}

export function ContactsClientView({ isNewModalOpen = false, createAction }: ContactsClientViewProps) {
    const { contacts, deleteContact } = useContacts()
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

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
            setSelectedContact(selectedFromUrl)
            setModalOpen(true)
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
        } catch (error) {
            // Error handling is done in the hook
        }
    }

    const getContactTypeBadge = (type: string) => {
        return <StatusBadge status={type} size="sm" />
    }

    const columns: ColumnDef<Contact>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Code className="font-semibold">{row.getValue("display_id")}</DataCell.Code></div>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => {
                const contact = row.original as Contact
                return (
                    <div className="flex items-center justify-center gap-2 w-full">
                        <DataCell.Text>{contact.name}</DataCell.Text>
                        <div className="flex gap-1">
                            {contact.is_default_customer && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <DataCell.Icon icon={UserIcon} className="bg-primary/10 text-primary h-6 w-6" />
                                        </TooltipTrigger>
                                        <TooltipContent>Cliente por defecto</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {contact.is_default_vendor && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <DataCell.Icon icon={Building2} className="bg-primary/10 text-primary h-6 w-6" />
                                        </TooltipTrigger>
                                        <TooltipContent>Proveedor por defecto</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {(Number(contact.credit_limit || 0) > 0 || Number(contact.credit_balance_used || 0) > 0) && !contact.credit_blocked && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <DataCell.Icon
                                                icon={Banknote}
                                                className={
                                                    Number(contact.credit_balance_used || 0) > 0
                                                        ? "bg-warning/10 text-warning h-6 w-6"
                                                        : "bg-success/10 text-success h-6 w-6"
                                                }
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <div className="flex flex-col gap-1">
                                                {Number(contact.credit_limit || 0) > 0 && (
                                                    <span>Límite de Crédito: ${Number(contact.credit_limit || 0).toLocaleString()} ({contact.credit_days} días)</span>
                                                )}
                                                {Number(contact.credit_balance_used || 0) > 0 && (
                                                    <span className="font-bold text-warning">
                                                        Deuda Activa: ${Number(contact.credit_balance_used || 0).toLocaleString()}
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
            accessorKey: "tax_id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="RUT / Identificación" className="justify-center" />,
            cell: ({ row }) => {
                const taxId = row.getValue("tax_id") as string | null
                return <div className="flex justify-center w-full"><DataCell.Code>{taxId ? formatRUT(taxId) : 'S/Rut'}</DataCell.Code></div>
            },
        },
        {
            accessorKey: "contact_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full">{getContactTypeBadge(row.getValue("contact_type"))}</div>,
        },
        {
            accessorKey: "email",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Email" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Secondary>{row.getValue("email") || "-"}</DataCell.Secondary></div>,
        },
        {
            accessorKey: "phone",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Teléfono" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Secondary>{row.getValue("phone") || "-"}</DataCell.Secondary></div>,
        },
        createActionsColumn<Contact>({
            renderActions: (contact) => (
                <>
                    <DataCell.Action
                        icon={Edit}
                        title="Editar"
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(contact.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}
                    />
                    {!contact.is_default_customer && !contact.is_default_vendor && (
                        <DataCell.Action
                            icon={Trash2}
                            title="Eliminar"
                            className="text-destructive"
                            onClick={() => handleDelete(contact)}
                        />
                    )}
                </>
            ),
        }),
    ]

    return (
        <>
            <DataTable
                columns={columns}
                data={contacts}
                cardMode
                globalFilterFields={["name", "tax_id", "code"]}
                searchPlaceholder="Buscar por nombre, RUT o código..."
                facetedFilters={[
                    {
                        column: "contact_type",
                        title: "Tipo",
                        options: [
                            { label: "Cliente", value: "CUSTOMER" },
                            { label: "Proveedor", value: "SUPPLIER" },
                            { label: "Ambos", value: "BOTH" },
                        ],
                    },
                ]}
                useAdvancedFilter={true}
                defaultPageSize={20}
                createAction={createAction}
            />

            <Suspense fallback={<LoadingFallback />}>
                <ContactModal
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
        </>
    )
}
