"use client"

import { useState, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Plus, Building2, User as UserIcon } from "lucide-react"
import api from "@/lib/api"
import { ContactModal } from "@/components/contacts/ContactModal"
import { toast } from "sonner"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { formatRUT } from "@/lib/utils/format"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataCell } from "@/components/ui/data-table-cells"

interface Contact {
    id: number
    code: string | null
    display_id: string
    name: string
    tax_id: string | null
    contact_type: string
    email: string | null
    phone: string | null
    address: string | null
    is_default_customer: boolean
    is_default_vendor: boolean
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<any>(null)

    const fetchContacts = async () => {
        setLoading(true)
        try {
            const res = await api.get("/contacts/")
            setContacts(res.data.results || res.data)
        } catch (error) {
            console.error("Error fetching contacts", error)
            toast.error("No se pudieron cargar los contactos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchContacts()
    }, [])

    const handleDelete = async (contact: any, isConfirmed = false) => {
        if (!contact) return

        if (!isConfirmed) {
            setContactToDelete(contact)
            setIsDeleteModalOpen(true)
            return
        }

        try {
            await api.delete(`/contacts/${contact.id}/`)
            toast.success("El contacto ha sido eliminado exitosamente")
            setIsDeleteModalOpen(false)
            fetchContacts()
        } catch (error) {
            toast.error("No se pudo eliminar el contacto. Puede que tenga documentos asociados.")
        }
    }

    const getContactTypeBadge = (type: string) => {
        switch (type) {
            case 'CUSTOMER':
                return <DataCell.Badge variant="info">Cliente</DataCell.Badge>
            case 'SUPPLIER':
                return <DataCell.Badge variant="indigo">Proveedor</DataCell.Badge>
            case 'BOTH':
                return <DataCell.Badge variant="success">Ambos</DataCell.Badge>
            default:
                return <DataCell.Badge variant="outline">Sin Clasificar</DataCell.Badge>
        }
    }

    // Definición de columnas para DataTable
    const columns: ColumnDef<Contact>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Código" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-semibold">{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => {
                const contact = row.original
                return (
                    <div className="flex items-center gap-2">
                        <DataCell.Text>{contact.name}</DataCell.Text>
                        <div className="flex gap-1">
                            {contact.is_default_customer && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <DataCell.Icon icon={UserIcon} className="bg-blue-100 text-blue-600 h-6 w-6" />
                                        </TooltipTrigger>
                                        <TooltipContent>Cliente por defecto</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {contact.is_default_vendor && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <DataCell.Icon icon={Building2} className="bg-purple-100 text-purple-600 h-6 w-6" />
                                        </TooltipTrigger>
                                        <TooltipContent>Proveedor por defecto</TooltipContent>
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="RUT / Identificación" />
            ),
            cell: ({ row }) => {
                const taxId = row.getValue("tax_id") as string | null
                return <DataCell.Code>{taxId ? formatRUT(taxId) : 'S/Rut'}</DataCell.Code>
            },
        },
        {
            accessorKey: "contact_type",
            header: "Tipo",
            cell: ({ row }) => getContactTypeBadge(row.getValue("contact_type")),
        },
        {
            accessorKey: "email",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Email" />
            ),
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("email") || "-"}</DataCell.Secondary>,
        },
        {
            accessorKey: "phone",
            header: "Teléfono",
            cell: ({ row }) => {
                return <DataCell.Secondary>{row.getValue("phone") || "-"}</DataCell.Secondary>
            },
        },
        {
            id: "actions",
            header: () => <div className="text-center">Acciones</div>,
            cell: ({ row }) => {
                const contact = row.original
                return (
                    <div className="flex justify-center space-x-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSelectedContact(contact)
                                setModalOpen(true)
                            }}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(contact)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4 space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Contactos</h2>
                <Button
                    size="icon"
                    className="rounded-full h-8 w-8"
                    onClick={() => { setSelectedContact(null); setModalOpen(true); }}
                    title="Nuevo Contacto"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                    Cargando contactos...
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={contacts}
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
                />
            )}

            <ContactModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                contact={selectedContact}
                onSuccess={() => {
                    setModalOpen(false)
                    setSelectedContact(null)
                    fetchContacts()
                }}
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
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
        </div>
    )
}
