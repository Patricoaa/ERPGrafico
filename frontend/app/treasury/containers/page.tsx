"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    ColumnDef
} from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Loader2, Vault, Wallet, Coins, Calculator, MapPin, User as UserIcon } from "lucide-react"
import { toast } from "sonner"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { formatCurrency } from "@/lib/utils"

interface CashContainer {
    id: number
    name: string
    container_type: 'SAFE' | 'PETTY_CASH' | 'CHANGE_FUND' | 'TILL'
    container_type_display: string
    location: string
    treasury_account: number | null
    treasury_account_name: string | null
    current_balance: string
    custodian: number | null
    custodian_name: string | null
    is_active: boolean
    notes: string
}

export default function CashContainersPage() {
    const [containers, setContainers] = useState<CashContainer[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [currentContainer, setCurrentContainer] = useState<CashContainer | null>(null)

    const fetchContainers = async () => {
        setLoading(true)
        try {
            const res = await api.get('/treasury/cash-containers/')
            setContainers(res.data.results || res.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar contenedores de efectivo")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchContainers()
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este contenedor? Se recomienda desactivarlo en su lugar si tiene historial.")) return
        try {
            await api.delete(`/treasury/cash-containers/${id}/`)
            toast.success("Contenedor eliminado")
            fetchContainers()
        } catch (error) {
            toast.error("Error al eliminar. Probablemente tenga movimientos asociados.")
        }
    }

    const openCreate = () => {
        setCurrentContainer(null)
        setDialogOpen(true)
    }

    const openEdit = (container: CashContainer) => {
        setCurrentContainer(container)
        setDialogOpen(true)
    }

    const columns: ColumnDef<CashContainer>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Nombre" />
            ),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.getValue("name")}</span>
                    {row.original.location && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-2 w-2" /> {row.original.location}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "container_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("container_type") as string
                const iconMap: Record<string, any> = {
                    'SAFE': <Vault className="h-4 w-4 text-slate-600" />,
                    'PETTY_CASH': <Wallet className="h-4 w-4 text-emerald-600" />,
                    'CHANGE_FUND': <Coins className="h-4 w-4 text-amber-600" />,
                    'TILL': <Calculator className="h-4 w-4 text-blue-600" />,
                }
                return (
                    <div className="flex items-center gap-2">
                        {iconMap[type] || <Wallet className="h-4 w-4" />}
                        {row.original.container_type_display}
                    </div>
                )
            },
        },
        {
            accessorKey: "current_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo Actual" />
            ),
            cell: ({ row }) => (
                <div className="font-bold text-emerald-700">
                    {formatCurrency(row.getValue("current_balance"))}
                </div>
            ),
        },
        {
            accessorKey: "custodian_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Responsable" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-sm">
                    {row.original.custodian_name ? (
                        <>
                            <UserIcon className="h-3 w-3 text-muted-foreground" />
                            {row.original.custodian_name}
                        </>
                    ) : (
                        <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Caja/Banco Relac." />
            ),
            cell: ({ row }) => row.original.treasury_account_name || <span className="text-muted-foreground text-xs italic">N/A</span>,
        },
        {
            accessorKey: "is_active",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => (
                <Badge variant={row.getValue("is_active") ? "success" : "secondary"}>
                    {row.getValue("is_active") ? "Activo" : "Inactivo"}
                </Badge>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title="Editar">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Contenedores de Efectivo</h2>
                    <p className="text-muted-foreground">
                        Gestión de ubicaciones físicas de efectivo. Los contenedores rastrean dónde está el dinero, mientras que las Cuentas de Tesorería registran el valor contable.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> Nuevo Contenedor
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Summary cards could go here later */}
            </div>

            <DataTable
                columns={columns}
                data={containers}
                filterColumn="name"
                searchPlaceholder="Buscar por nombre..."
                facetedFilters={[
                    {
                        column: "container_type",
                        title: "Tipo",
                        options: [
                            { label: "Caja Fuerte", value: "SAFE" },
                            { label: "Caja Menor", value: "PETTY_CASH" },
                            { label: "Fondo Cambio", value: "CHANGE_FUND" },
                            { label: "Gaveta/Till", value: "TILL" },
                        ],
                    },
                    {
                        column: "is_active",
                        title: "Estado",
                        options: [
                            { label: "Activo", value: "true" },
                            { label: "Inactivo", value: "false" },
                        ],
                    },
                ]}
            />

            <ContainerDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                container={currentContainer}
                onSuccess={() => {
                    setDialogOpen(false)
                    fetchContainers()
                }}
            />
        </div>
    )
}

function ContainerDialog({ open, onOpenChange, container, onSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, container: CashContainer | null, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [type, setType] = useState<string>("SAFE")
    const [location, setLocation] = useState("")
    const [treasuryAccount, setTreasuryAccount] = useState<string | null>(null)
    const [custodian, setCustodian] = useState<number | null>(null)
    const [isActive, setIsActive] = useState(true)
    const [notes, setNotes] = useState("")

    useEffect(() => {
        if (open) {
            if (container) {
                setName(container.name)
                setType(container.container_type)
                setLocation(container.location || "")
                setTreasuryAccount(container.treasury_account ? container.treasury_account.toString() : null)
                setCustodian(container.custodian)
                setIsActive(container.is_active)
                setNotes(container.notes || "")
            } else {
                setName("")
                setType("SAFE")
                setLocation("")
                setTreasuryAccount(null)
                setCustodian(null)
                setIsActive(true)
                setNotes("")
            }
        }
    }, [open, container])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = {
                name,
                container_type: type,
                location,
                treasury_account: treasuryAccount,
                custodian,
                is_active: isActive,
                notes
            }
            if (container) {
                await api.patch(`/treasury/cash-containers/${container.id}/`, payload)
                toast.success("Contenedor actualizado")
            } else {
                await api.post('/treasury/cash-containers/', payload)
                toast.success("Contenedor creado")
            }
            onSuccess()
        } catch (error: any) {
            toast.error("Error al guardar: " + (error.response?.data?.detail || "Error desconocido"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{container ? "Editar Contenedor" : "Nuevo Contenedor de Efectivo"}</DialogTitle>
                    <DialogDescription>
                        Los contenedores rastrean <strong>dónde está físicamente</strong> el efectivo
                        (cajas fuertes, gavetas, etc.) independientemente del registro contable.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                        <Label>Nombre</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja Fuerte Principal, Fondo Local A..." required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SAFE">Caja Fuerte</SelectItem>
                                    <SelectItem value="PETTY_CASH">Caja Menor</SelectItem>
                                    <SelectItem value="CHANGE_FUND">Fondo de Cambio</SelectItem>
                                    <SelectItem value="TILL">Gaveta/Till</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Ubicación</Label>
                            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Oficina 2, Mostrador..." />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Responsable (Custodio)</Label>
                        <UserSelector value={custodian} onChange={setCustodian} placeholder="Seleccione responsable..." />
                    </div>

                    <div className="grid gap-2">
                        <Label>Cuenta de Tesorería Relacionada (Opcional)</Label>
                        <TreasuryAccountSelector
                            value={treasuryAccount}
                            onChange={setTreasuryAccount}
                            type="CASH"
                            placeholder="Vincular con una cuenta de tesorería..."
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            <strong>Opcional</strong>: Este contenedor rastrea la <strong>ubicación física</strong> del efectivo.
                            La vinculación con una Cuenta de Tesorería solo es necesaria si desea conectar movimientos físicos
                            con registros contables específicos.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label>Sugerencias o Notas</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." rows={2} />
                    </div>

                    <div className="flex items-center space-x-2 py-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="is_active">Contenedor Activo</Label>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
