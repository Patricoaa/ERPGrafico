"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart, Search, User, Minus, Package } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { VariantPicker } from "@/components/shared/VariantPicker"
import { AttributeBadges } from "@/components/shared/AttributeBadges"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Product {
    id: number
    code: string
    name: string
    sale_price: string
    current_stock?: number
    product_type?: string
    unit_price?: string
    variants_count?: number
    variant_of?: number | null
    attribute_values?: any[]
    image?: string | null
    category?: {
        id: number
        name: string
        icon?: string | null
    } | number
    uom?: number
    uom_name?: string
}

interface Category {
    id: number
    name: string
    icon?: string | null
}

interface Customer {
    id: number
    name: string
}

interface CartItem extends Product {
    qty: number
    total: number
    uom?: number
    uom_name?: string
}

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.Package
    return <IconComponent className={className} />
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    // const [customers, setCustomers] = useState<Customer[]>([]) // Removed in favor of async selector
    const [selectedCustomer, setSelectedCustomer] = useState<string>("")
    const [items, setItems] = useState<CartItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [uoms, setUoMs] = useState<any[]>([])

    // Variant Picker State
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickingParent, setPickingParent] = useState<Product | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, catRes, uomRes] = await Promise.all([
                    api.get('/inventory/products/'),
                    api.get('/inventory/categories/'),
                    api.get('/inventory/uoms/'),
                ])
                setProducts(prodRes.data.results || prodRes.data)
                setCategories(catRes.data.results || catRes.data)
                setUoMs(uomRes.data.results || uomRes.data)
            } catch (error) {
                console.error("Failed to fetch POS data", error)
                toast.error("Error al cargar datos del POS")
            }
        }
        fetchData()
    }, [])

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase()))

        const categoryId = typeof p.category === 'object' ? p.category?.id : p.category
        const matchesCategory = selectedCategoryId === null || categoryId === selectedCategoryId

        return matchesSearch && matchesCategory && p.variant_of === null
    })

    const addToCart = (product: Product) => {
        if ((product.variants_count || 0) > 0) {
            setPickingParent(product)
            setPickerOpen(true)
            return
        }

        const existing = items.find(i => i.id === product.id)
        if (existing) {
            setItems(items.map(i => i.id === product.id
                ? { ...i, qty: i.qty + 1, total: Math.ceil((i.qty + 1) * parseFloat(i.sale_price)) }
                : i
            ))
        } else {
            setItems([...items, {
                ...product,
                qty: 1,
                uom: product.uom,
                uom_name: product.uom_name,
                total: Math.ceil(parseFloat(product.sale_price))
            }])
        }
    }

    const onVariantSelect = (variant: any) => {
        const existing = items.find(i => i.id === variant.id)
        if (existing) {
            setItems(items.map(i => i.id === variant.id
                ? { ...i, qty: i.qty + 1, total: Math.ceil((i.qty + 1) * parseFloat(i.sale_price)) }
                : i
            ))
        } else {
            setItems([...items, {
                ...variant,
                qty: 1,
                uom: variant.uom,
                uom_name: variant.uom_name,
                total: Math.ceil(parseFloat(variant.sale_price))
            }])
        }
    }

    const updateQty = (id: number, delta: number) => {
        setItems(items.map(i => {
            if (i.id === id) {
                const newQty = Math.max(1, i.qty + delta)
                return { ...i, qty: newQty, total: Math.ceil(newQty * parseFloat(i.sale_price)) }
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

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const term = searchTerm.toLowerCase().trim()
            if (!term) return

            // 1. Try exact code match
            const exactMatch = products.find(p => p.code.toLowerCase() === term && p.variant_of === null)
            if (exactMatch) {
                addToCart(exactMatch)
                setSearchTerm("")
                return
            }

            // 2. If not exact, check if filtered list has exactly one result
            if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0])
                setSearchTerm("")
            }
        }
    }

    const handleCheckoutConfirm = async (data: { dteType?: string, paymentMethod: string, amount?: number, transaction_number?: string, is_pending_registration?: boolean, treasury_account_id?: string | null }) => {
        setCheckoutOpen(false)
        setLoading(true)
        try {
            const payload = {
                order_data: {
                    customer: parseInt(selectedCustomer),
                    lines: items.map(i => ({
                        product: i.id,
                        description: i.name,
                        quantity: i.qty,
                        uom: i.uom,
                        unit_price: parseFloat(i.unit_price || i.sale_price),
                        tax_rate: 19
                    }))
                },
                dte_type: data.dteType || 'BOLETA',
                payment_method: data.paymentMethod,
                amount: data.amount,
                transaction_number: data.transaction_number,
                is_pending_registration: data.is_pending_registration,
                treasury_account_id: data.treasury_account_id
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
                    {/* Elements moved to cart card */}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full overflow-hidden">
                {/* Left: Product List / Search */}
                <div className="md:col-span-2 flex flex-col space-y-4 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3 border-b">
                            <div className="flex flex-col gap-4">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre o código..."
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    <Badge
                                        variant={selectedCategoryId === null ? "default" : "outline"}
                                        className="cursor-pointer whitespace-nowrap"
                                        onClick={() => setSelectedCategoryId(null)}
                                    >
                                        Todos
                                    </Badge>
                                    {categories.map(cat => (
                                        <Badge
                                            key={cat.id}
                                            variant={selectedCategoryId === cat.id ? "default" : "outline"}
                                            className="cursor-pointer whitespace-nowrap flex items-center gap-1"
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                        >
                                            {cat.icon && <DynamicIcon name={cat.icon} className="h-3 w-3" />}
                                            {cat.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto pt-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {filteredProducts.map(product => {
                                    const categoryIcon = typeof product.category === 'object' ? product.category?.icon : null

                                    return (
                                        <Card
                                            key={product.id}
                                            className={cn(
                                                "cursor-pointer hover:border-primary transition-all active:scale-95 relative flex flex-col overflow-hidden group",
                                                product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0 && "opacity-50 pointer-events-none grayscale-[0.5]"
                                            )}
                                            onClick={() => addToCart(product)}
                                        >
                                            <div className="aspect-square bg-muted flex items-center justify-center relative">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <DynamicIcon name={categoryIcon || "Package"} className="h-12 w-12 text-muted-foreground/40 group-hover:scale-110 transition-transform" />
                                                )}

                                                {product.product_type === 'STORABLE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className={`h-2 w-2 rounded-full ${(product.current_stock || 0) > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {product.current_stock || 0}
                                                    </div>
                                                )}
                                            </div>
                                            <CardContent className="p-3 text-center flex-1 flex flex-col justify-center">
                                                <div className="font-bold text-sm line-clamp-2">{product.name}</div>
                                                <div className="text-primary font-semibold text-base mt-1">${Number(product.sale_price).toLocaleString()}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase opacity-60 tracking-wider">{product.code}</div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
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
                            <div className="p-4 border-b space-y-3 bg-muted/20">
                                <div className="flex items-center gap-2 justify-between">
                                    <div className="flex-1">
                                        <AdvancedContactSelector
                                            value={selectedCustomer}
                                            onChange={(val) => setSelectedCustomer(val || "")}
                                            placeholder="Buscar Cliente (Nombre o Rut)..."
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setItems([])} title="Limpiar Carrito" className="hover:bg-destructive/10 hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
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
                                        {items.map((item) => {
                                            const itemUom = uoms.find(u => u.id === item.uom)
                                            const categoryUoms = itemUom ? uoms.filter(u => u.category === itemUom.category) : []

                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="max-w-[120px]">
                                                        <div className="flex flex-col">
                                                            <span className="truncate font-medium">{item.name}</span>
                                                            {item.attribute_values && item.attribute_values.length > 0 && (
                                                                <div className="scale-75 origin-left -mt-1 -mb-1">
                                                                    <AttributeBadges attributes={item.attribute_values} />
                                                                </div>
                                                            )}
                                                            <div className="mt-1">
                                                                {categoryUoms.length > 1 ? (
                                                                    <Select
                                                                        value={item.uom?.toString()}
                                                                        onValueChange={(val) => {
                                                                            const newUom = uoms.find(u => u.id.toString() === val)
                                                                            setItems(items.map(i => i.id === item.id ? { ...i, uom: parseInt(val), uom_name: newUom?.name } : i))
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50 py-0 px-2 min-h-0">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {categoryUoms.map(u => (
                                                                                <SelectItem key={u.id} value={u.id.toString()} className="text-[10px]">
                                                                                    {u.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                        {item.uom_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
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
                                            )
                                        })}
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

            <VariantPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                parentProduct={pickingParent}
                onSelect={onVariantSelect}
                restrictStock={true}
            />
        </div>
    )
}
