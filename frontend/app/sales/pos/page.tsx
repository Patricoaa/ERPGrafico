"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart, Search, User, Minus } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PaymentDialog } from "@/components/shared/PaymentDialog"

interface Product {
    id: number
    code: string
    name: string
    sale_price: string
    current_stock?: number
    product_type?: string
    unit_price?: string
}

interface Customer {
    id: number
    name: string
}

interface CartItem extends Product {
    qty: number
    total: number
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<string>("")
    const [items, setItems] = useState<CartItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkoutOpen, setCheckoutOpen] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, custRes] = await Promise.all([
                    api.get('/inventory/products/'),
                    api.get('/sales/customers/')
                ])
                setProducts(prodRes.data.results || prodRes.data)
                setCustomers(custRes.data.results || custRes.data)
            } catch (error) {
                console.error("Failed to fetch POS data", error)
                toast.error("Error al cargar datos del POS")
            }
        }
        fetchData()
    }, [])

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const addToCart = (product: Product) => {
        const existing = items.find(i => i.id === product.id)
        if (existing) {
            setItems(items.map(i => i.id === product.id
                ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * parseFloat(i.sale_price) }
                : i
            ))
        } else {
            setItems([...items, {
                ...product,
                qty: 1,
                total: parseFloat(product.sale_price)
            }])
        }
    }

    const updateQty = (id: number, delta: number) => {
        setItems(items.map(i => {
            if (i.id === id) {
                const newQty = Math.max(0.1, i.qty + delta)
                return { ...i, qty: newQty, total: newQty * parseFloat(i.sale_price) }
            }
            return i
        }))
    }

    const removeItem = (id: number) => {
        setItems(items.filter(i => i.id !== id))
    }

    const handleConfirm = () => {
        if (!selectedCustomer) {
            toast.error("Seleccione un cliente")
            return
        }
        if (items.length === 0) {
            toast.error("El carrito está vacío")
            return
        }
        setCheckoutOpen(true)
    }

    const handleCheckoutConfirm = async (data: { dteType?: string, paymentMethod: string, amount?: number, transaction_number?: string, is_pending_registration?: boolean }) => {
        setCheckoutOpen(false)
        setLoading(true)
        try {
            const payload = {
                order_data: {
                    customer: parseInt(selectedCustomer),
                    lines: items.map(i => ({
                        description: i.name,
                        quantity: i.qty,
                        unit_price: parseFloat(i.unit_price || i.sale_price),
                        tax_rate: 19
                    }))
                },
                dte_type: data.dteType || 'BOLETA',
                payment_method: data.paymentMethod,
                amount: data.amount,
                transaction_number: data.transaction_number,
                is_pending_registration: data.is_pending_registration
            }
            await api.post('/billing/invoices/pos_checkout/', payload)

            toast.success("Venta procesada correctamente")
            setItems([])
            setSelectedCustomer("")
        } catch (error) {
            console.error("Error in POS checkout:", error)
            toast.error("Error al procesar el pago")
        } finally {
            setLoading(false)
        }
    }

    const total = items.reduce((acc, i) => acc + i.total, 0)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Punto de Venta</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-64 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar Cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" onClick={() => setItems([])}>Limpiar</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full overflow-hidden">
                {/* Left: Product List / Search */}
                <div className="md:col-span-2 flex flex-col space-y-4 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre o código..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {filteredProducts.map(product => (
                                    <Card
                                        key={product.id}
                                        className="cursor-pointer hover:border-primary transition-all active:scale-95"
                                        onClick={() => addToCart(product)}
                                    >
                                        <CardContent className="p-4 text-center space-y-1">
                                            <div className="font-bold truncate">{product.name}</div>
                                            <div className="text-sm text-muted-foreground">${Number(product.sale_price).toLocaleString()}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{product.code}</div>
                                            {product.product_type === 'STORABLE' && (
                                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border">
                                                    <div className={`h-2 w-2 rounded-full ${(product.current_stock || 0) > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className="text-[10px] font-medium">{product.current_stock || 0}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full text-center py-10 text-muted-foreground">
                                        No se encontraron productos.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Cart & Totals */}
                <div className="flex flex-col space-y-4 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b font-medium bg-muted/50 flex justify-between items-center">
                                <span>Resumen de Venta</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{items.length} items</span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="w-[100px] text-center">Cant</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="w-[40px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="max-w-[120px] truncate">{item.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                                                        <span>{item.qty}</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">${Number(item.total).toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    Carrito vacío
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Neto</span>
                                        <span>${(total / 1.19).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>IVA (19%)</span>
                                        <span>${(total - total / 1.19).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                        <span>Total</span>
                                        <span>${total.toLocaleString()}</span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full h-12 text-lg shadow-lg"
                                    size="lg"
                                    disabled={loading || items.length === 0}
                                    onClick={handleConfirm}
                                >
                                    <ShoppingCart className="mr-2 h-5 w-5" />
                                    {loading ? "Procesando..." : "Confirmar Venta"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <PaymentDialog
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                total={total}
                pendingAmount={total}
                showDteSelector={true}
                onConfirm={handleCheckoutConfirm}
            />
        </div>
    )
}
