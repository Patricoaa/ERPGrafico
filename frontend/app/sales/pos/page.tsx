"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart } from "lucide-react"

export default function POSPage() {
    const [items, setItems] = useState<any[]>([])

    const addItem = () => {
        // Placeholder for adding item logic
        setItems([...items, { id: Date.now(), description: "Producto Ejemplo", price: 1000, qty: 1, total: 1000 }])
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Punto de Venta</h2>
                <Button variant="destructive">Cancelar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                {/* Left: Product List / Search */}
                <div className="md:col-span-2 flex flex-col space-y-4">
                    <Card className="flex-1">
                        <CardContent className="p-4">
                            <div className="flex space-x-2 mb-4">
                                <Input placeholder="Buscar por nombre o código..." className="flex-1" />
                                <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Placeholder Grid of Products */}
                                <Card className="cursor-pointer hover:border-primary" onClick={addItem}>
                                    <CardContent className="p-4 text-center">
                                        <div className="font-bold">Tarjeta Visita</div>
                                        <div className="text-sm text-muted-foreground">$5.000</div>
                                    </CardContent>
                                </Card>
                                <Card className="cursor-pointer hover:border-primary" onClick={addItem}>
                                    <CardContent className="p-4 text-center">
                                        <div className="font-bold">Flyer A5</div>
                                        <div className="text-sm text-muted-foreground">$15.000</div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Cart & Totals */}
                <div className="flex flex-col space-y-4">
                    <Card className="flex-1 flex flex-col">
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <div className="p-4 border-b font-medium bg-muted/50">Resumen de Venta</div>
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Desc</TableHead>
                                            <TableHead className="w-[80px]">Cant</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell>{item.qty}</TableCell>
                                                <TableCell className="text-right">${item.total}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t space-y-2">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span>${items.reduce((acc, i) => acc + i.total, 0)}</span>
                                </div>
                                <Button className="w-full" size="lg">
                                    <ShoppingCart className="mr-2 h-4 w-4" /> Confirmar Venta
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
