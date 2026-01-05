"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Pencil, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { ServiceCategoryDialog } from "@/components/services/ServiceCategoryDialog"

export default function ServiceCategoriesPage() {
    const [categories, setCategories] = useState([])

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = () => {
        api.get('/services/categories/').then(res => setCategories(res.data.results || res.data))
    }

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`¿Está seguro de eliminar la categoría "${name}"?\n\nNota: No se puede eliminar si hay contratos asociados.`)) return

        try {
            await api.delete(`/services/categories/${id}/`)
            toast.success("Categoría eliminada correctamente")
            fetchCategories()
        } catch (error: any) {
            console.error("Error deleting category:", error)
            const errorMsg = error.response?.data?.detail || error.response?.data?.error || "No se pudo eliminar la categoría. Puede tener contratos asociados."
            toast.error(errorMsg)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Categorías de Servicio</h1>
                <ServiceCategoryDialog onSuccess={fetchCategories}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                    </Button>
                </ServiceCategoryDialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cuenta Gasto</TableHead>
                                <TableHead>Cuenta Pasivo</TableHead>
                                <TableHead>Provisión</TableHead>
                                <TableHead className="text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No hay categorías registradas
                                    </TableCell>
                                </TableRow>
                            ) : categories.map((cat: any) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-mono">{cat.code}</TableCell>
                                    <TableCell>{cat.name}</TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs text-muted-foreground">{cat.expense_account_data?.code}</span>
                                            <span>{cat.expense_account_data?.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs text-muted-foreground">{cat.payable_account_data?.code}</span>
                                            <span>{cat.payable_account_data?.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{cat.requires_provision ? 'Sí' : 'No'}</TableCell>
                                    <TableCell>
                                        <div className="flex justify-center gap-2">
                                            <ServiceCategoryDialog initialData={cat} onSuccess={fetchCategories}>
                                                <Button variant="ghost" size="icon">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </ServiceCategoryDialog>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-600 hover:text-red-700"
                                                onClick={() => handleDelete(cat.id, cat.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
