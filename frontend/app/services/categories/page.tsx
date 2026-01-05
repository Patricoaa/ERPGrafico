"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import api from "@/lib/api"

export default function ServiceCategoriesPage() {
    const [categories, setCategories] = useState([])

    useEffect(() => {
        api.get('/services/categories/').then(res => setCategories(res.data.results || res.data))
    }, [])

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Categorías de Servicio</h1>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Nueva Categoría
                </Button>
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((cat: any) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-mono">{cat.code}</TableCell>
                                    <TableCell>{cat.name}</TableCell>
                                    <TableCell>{cat.expense_account_data?.name}</TableCell>
                                    <TableCell>{cat.payable_account_data?.name}</TableCell>
                                    <TableCell>{cat.requires_provision ? 'Sí' : 'No'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
