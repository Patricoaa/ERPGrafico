"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart, Search, User, Minus, Package, Paintbrush, Info } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { SalesCheckoutWizard } from "@/components/sales/SalesCheckoutWizard"
import { Badge } from "@/components/ui/badge"
import { AdvancedManufacturingDialog } from "@/components/forms/AdvancedManufacturingDialog"
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
    internal_code?: string
    name: string
    sale_price: string
    current_stock?: number
    manufacturable_quantity?: number | null
    product_type?: string
    unit_price?: string
    variants_count?: number
    image?: string | null
    requires_advanced_manufacturing?: boolean
    has_bom?: boolean
    category?: {
        id: number
        name: string
        icon?: string | null
    } | number
    uom?: number
    uom_name?: string
    allowed_sale_uoms?: number[]
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
    total_net: number
    total_tax: number
    total_gross: number
    unit_price_net: number
    uom?: number
    manufacturing_data?: any // Add this line
    uom_name?: string
}

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.Package
    return <IconComponent className={className} />
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    // const [customers, setCustomers] = useState<Customer[]>([]) // Removed in favor of async selector
    const [items, setItems] = useState<CartItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [uoms, setUoMs] = useState<any[]>([])

    // Advanced Manufacturing State
    const [advMfgDialogOpen, setAdvMfgDialogOpen] = useState(false)
    const [pendingProduct, setPendingProduct] = useState<Product | null>(null)

    const [pricingRules, setPricingRules] = useState<any[]>([])

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)

            // Fetch Products
            try {
                const res = await api.get('/inventory/products/')
                setProducts(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch products", error)
                toast.error("Error al cargar productos")
                setProducts([])
            }

            // Fetch Categories
            try {
                const res = await api.get('/inventory/categories/')
                setCategories(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch categories", error)
                setCategories([])
            }

            // Fetch UoMs
            try {
                const res = await api.get('/inventory/uoms/')
                setUoMs(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch UoMs", error)
                setUoMs([])
            }

            // Fetch Pricing Rules
            try {
                const res = await api.get('/inventory/pricing-rules/?active=true')
                setPricingRules(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch pricing rules", error)
                setPricingRules([])
            }

            setLoading(false)
        }
        fetchData()
    }, [])

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase()))

        const categoryId = typeof p.category === 'object' ? p.category?.id : p.category
        const matchesCategory = selectedCategoryId === null || categoryId === selectedCategoryId

        return matchesSearch && matchesCategory
    })

    const getEffectivePrice = (product: Product, qty: number) => {
        const basePrice = parseFloat(product.sale_price)
        const date = new Date().toISOString().split('T')[0]

        const categoryId = typeof product.category === 'object' ? product.category?.id : product.category

        const applicableRules = pricingRules.filter(rule => {
            const matchesProduct = rule.product === product.id
            const matchesCategory = rule.category === categoryId
            const matchesQty = qty >= parseFloat(rule.min_quantity)
            const matchesDate = (!rule.start_date || rule.start_date <= date) &&
                (!rule.end_date || rule.end_date >= date)

            return (matchesProduct || matchesCategory) && matchesQty && matchesDate
        }).sort((a, b) => b.priority - a.priority || parseFloat(b.min_quantity) - parseFloat(a.min_quantity))

        if (applicableRules.length > 0) {
            const rule = applicableRules[0]
            if (rule.rule_type === "FIXED") {
                return parseFloat(rule.fixed_price || "0")
            } else {
                return basePrice * (1 - (parseFloat(rule.discount_percentage || "0") / 100))
            }
        }

        return basePrice
    }

    const addToCart = (product: Product, mfgData?: any) => {
        if (product.requires_advanced_manufacturing && !mfgData) {
            setPendingProduct(product)
            setAdvMfgDialogOpen(true)
            return
        }

        const existing = items.find(i => i.id === product.id)
        const netPrice = getEffectivePrice(product, existing ? existing.qty + 1 : 1)

        if (existing) {
            const newQty = existing.qty + 1
            setItems(items.map(i => i.id === product.id
                ? {
                    ...i,
                    qty: newQty,
                    unit_price_net: netPrice,
                    total_net: Math.round(newQty * netPrice),
                    total_tax: Math.round(newQty * netPrice * 0.19),
                    total_gross: Math.round(newQty * netPrice * 1.19),
                    manufacturing_data: mfgData || i.manufacturing_data
                }
                : i
            ))
        } else {
            // Prioritize sale_uom if available
            const saleUoMId = (product as any).sale_uom
            const defaultUoM = saleUoMId || product.uom

            // Find name for the UoM
            const uomName = uoms?.find(u => u.id === defaultUoM)?.name || product.uom_name

            setItems([...items, {
                ...product,
                qty: 1,
                uom: defaultUoM,
                uom_name: uomName,
                unit_price_net: netPrice,
                total_net: Math.round(netPrice),
                total_tax: Math.round(netPrice * 0.19),
                total_gross: Math.round(netPrice * 1.19),
                manufacturing_data: mfgData
            }])
        }
    }


    const updateQty = (id: number, delta: number) => {
        setItems(items.map(i => {
            if (i.id === id) {
                const newQty = Math.max(1, i.qty + delta)
                const netPrice = getEffectivePrice(i, newQty)
                return {
                    ...i,
                    qty: newQty,
                    unit_price_net: netPrice,
                    total_net: Math.round(newQty * netPrice),
                    total_tax: Math.round(newQty * netPrice * 0.19),
                    total_gross: Math.round(newQty * netPrice * 1.19)
                }
            }
            return i
        }))
    }

    const removeItem = (id: number) => {
        setItems(items.filter(i => i.id !== id))
    }

    const handleConfirm = () => {
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
            const exactMatch = products.find(p => p.code.toLowerCase() === term)
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

    const total_gross_sum = items.reduce((acc, i) => acc + i.total_gross, 0)
    const total_net_sum = items.reduce((acc, i) => acc + i.total_net, 0)
    const total_tax_sum = items.reduce((acc, i) => acc + i.total_tax, 0)

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
                                                // Disable if STORABLE with no stock
                                                product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0 && "opacity-50 pointer-events-none grayscale-[0.5]",
                                                // Disable if MANUFACTURABLE and quantity is 0 (specifically 0, not null/infinity)
                                                product.product_type === 'MANUFACTURABLE' && (product.manufacturable_quantity === 0) && "opacity-50 pointer-events-none grayscale-[0.5]"
                                            )}
                                            onClick={() => addToCart(product)}
                                        >
                                            <div className="aspect-square bg-muted flex items-center justify-center relative">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <DynamicIcon name={categoryIcon || "Package"} className="h-12 w-12 text-muted-foreground/40 group-hover:scale-110 transition-transform" />
                                                )}

                                                {/* Stock/Availability Badge */}
                                                {product.product_type === 'STORABLE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className={`h-2 w-2 rounded-full ${(product.current_stock || 0) > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {product.current_stock || 0}
                                                    </div>
                                                )}
                                                {product.product_type === 'MANUFACTURABLE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className={`h-2 w-2 rounded-full ${(product.manufacturable_quantity || 0) > 0 ? 'bg-blue-500' : 'bg-red-500'}`} />
                                                        {(product.manufacturable_quantity === null || product.manufacturable_quantity === undefined || product.manufacturable_quantity > 999999)
                                                            ? 'Disponible'
                                                            : `${product.manufacturable_quantity} fab.`}
                                                    </div>
                                                )}
                                                {product.product_type === 'SERVICE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                        Disponible
                                                    </div>
                                                )}
                                            </div>
                                            <CardContent className="p-3 text-center flex-1 flex flex-col justify-center">
                                                <div className="font-bold text-sm line-clamp-2">{product.name}</div>
                                                <div className="text-primary font-semibold text-base mt-1">
                                                    ${Math.round(Number(product.sale_price) * 1.19).toLocaleString()}
                                                    <span className="text-[10px] text-muted-foreground ml-1">c/IVA</span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground uppercase opacity-60 tracking-wider font-mono">{product.internal_code || product.code}</div>
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
                            <div className="p-4 border-b flex justify-end bg-muted/20">
                                <Button variant="ghost" size="icon" onClick={() => setItems([])} title="Limpiar Carrito" className="hover:bg-destructive/10 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
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
                                            <TableHead className="w-[80px] text-center">Cant</TableHead>
                                            <TableHead className="w-[70px] text-center">Unidad</TableHead>
                                            <TableHead className="text-right text-xs">Neto</TableHead>
                                            <TableHead className="text-right text-xs">IVA</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="w-[30px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            // Need to find the product in the full list to get allowed_sale_uoms
                                            const originalProduct = products.find(p => p.id === item.id)
                                            const itemUom = uoms.find(u => u.id === item.uom)

                                            // Logic: allowed_sale_uoms (if any) + default sale UoM OR Category fallback
                                            // The 'product' interface in this file needs to include allowed_sale_uoms for this to work.
                                            // I will assume the API returns it (ProductSerializer does), I need to update the interface above too.

                                            let allowedUoMs = []
                                            if (originalProduct && (originalProduct as any).allowed_sale_uoms?.length > 0) {
                                                const allowedIds = (originalProduct as any).allowed_sale_uoms
                                                const saleUoMId = (originalProduct as any).sale_uom
                                                allowedUoMs = uoms.filter(u => allowedIds.includes(u.id) || u.id === saleUoMId)
                                            } else if (itemUom) {
                                                allowedUoMs = uoms.filter(u => u.category === itemUom.category)
                                            }

                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="max-w-[120px]">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="truncate font-medium">
                                                                <span className="font-mono text-[10px] text-muted-foreground mr-1">{item.internal_code || item.code}</span>
                                                                {item.name}
                                                            </span>
                                                            {item.manufacturing_data && item.manufacturable_quantity && (
                                                                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <Package className="h-3 w-3" />
                                                                    Mfg: {item.manufacturable_quantity || 0}
                                                                </div>
                                                            )}
                                                            {item.requires_advanced_manufacturing && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={cn("h-6 w-6 mt-1", item.manufacturing_data ? "text-primary" : "text-muted-foreground")}
                                                                    onClick={() => {
                                                                        setPendingProduct(item as Product)
                                                                        setAdvMfgDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Paintbrush className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                                                            <span className="text-xs font-mono">{item.qty}</span>
                                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {allowedUoMs.length > 1 ? (
                                                            <Select
                                                                value={item.uom?.toString()}
                                                                onValueChange={(val) => {
                                                                    const newUom = uoms.find(u => u.id.toString() === val)
                                                                    setItems(items.map(i => i.id === item.id ? { ...i, uom: parseInt(val), uom_name: newUom?.name } : i))
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-6 text-[10px] w-full border-none bg-muted/50 py-0 px-2 min-h-0">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {allowedUoMs.map(u => (
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
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">${Number(item.total_net).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">${Number(item.total_tax).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-bold text-sm">${Number(item.total_gross).toLocaleString()}</TableCell>
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
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    Carrito vacío
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 bg-muted/50 border-t space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Neto</span>
                                        <span>${total_net_sum.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>IVA (19%)</span>
                                        <span>${total_tax_sum.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                        <span>Total</span>
                                        <span>${total_gross_sum.toLocaleString()}</span>
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

            {checkoutOpen && (
                <SalesCheckoutWizard
                    open={checkoutOpen}
                    onOpenChange={setCheckoutOpen}
                    order={null}
                    orderLines={items}
                    total={total_gross_sum}
                    onComplete={() => {
                        setItems([])
                    }}
                />
            )}

            <AdvancedManufacturingDialog
                open={advMfgDialogOpen}
                onOpenChange={setAdvMfgDialogOpen}
                product={pendingProduct}
                onConfirm={(data) => {
                    if (pendingProduct) {
                        addToCart(pendingProduct, data)
                        setPendingProduct(null)
                    }
                }}
            />

        </div>
    )
}
