"use client"

import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Pencil, Trash2, Layers, CheckCircle2, XCircle } from "lucide-react"
import api from "@/lib/api"
import { BomForm } from "@/components/production/BomForm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface BOM {
    id: number
    name: string
    product: number
    product_name: string
    active: boolean
    lines_count: number
}

export default function BOMsPage() {
    const [boms, setBoms] = useState<BOM[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBom, setEditingBom] = useState<any | null>(null)

    const fetchBoms = async () => {
        setLoading(true)
        try {
            const response = await api.get('/production/boms/')
            setBoms(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching BOMs:", error)
            toast.error("Error al cargar las Listas de Materiales")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta Lista de Materiales?")) return
        try {
            await api.delete(`/production/boms/${id}/`)
            toast.success("BOM eliminado correctamente")
            fetchBoms()
        } catch (error) {
            toast.error("Error al eliminar BOM")
        }
    }

    const handleEdit = async (id: number) => {
        try {
            const response = await api.get(`/production/boms/${id}/`)
            setEditingBom(response.data)
            setIsFormOpen(true)
        } catch (error) {
            toast.error("Error al cargar detalles del BOM")
        }
    }

    useEffect(() => {
        fetchBoms()
    }, [])

    const filteredBoms = boms.filter(bom =>
        bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bom.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Listas de Materiales (BOM)</h2>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => { setEditingBom(null); setIsFormOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Lista
                    </Button>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Buscar por nombre o producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Nombre / Versión</TableHead>
                            <TableHead className="text-center">Componentes</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredBoms.map((bom) => (
                            <TableRow key={bom.id}>
                                <TableCell className="font-medium">{bom.product_name}</TableCell>
                                <TableCell>{bom.name}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className="gap-1">
                                        <Layers className="h-3 w-3" />
                                        {bom.lines_count || 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    {bom.active ? (
                                        <Badge className="bg-green-600 hover:bg-green-700">
                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Activa
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            <XCircle className="h-3 w-3 mr-1" /> Inactiva
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(bom.id)}
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(bom.id)}
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filteredBoms.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No se encontraron listas de materiales.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <BomForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={fetchBoms}
                initialData={editingBom}
            />
        </div>
    )
}
