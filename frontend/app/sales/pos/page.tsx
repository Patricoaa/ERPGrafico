"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart, Search, User, Minus, Package, Info } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { SalesCheckoutWizard } from "@/components/sales/SalesCheckoutWizard"
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
    cartItemId: string
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

    const [pricingRules, setPricingRules] = useState<any[]>([])

    useEffect(() => {
        // ... (fetchData implementation unchanged)
        const fetchData = async () => {
            setLoading(true)

            // Fetch Products
            try {
                const res = await api.get('/inventory/products/?can_be_sold=true')
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

    // ... (filteredProducts and getEffectivePrice unchanged)
    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase()))

        const categoryId = typeof p.category === 'object' ? p.category?.id : p.category
        const matchesCategory = selectedCategoryId === null || categoryId === selectedCategoryId

        return matchesSearch && matchesCategory
    })

    const getEffectivePrice = (product: Product, qty: number, selectedUomId?: number) => {
        const basePrice = parseFloat(product.sale_price)
        const date = new Date().toISOString().split('T')[0]

        const categoryId = typeof product.category === 'object' ? product.category?.id : product.category

        // 1. Check for specific pricing rules
        const applicableRules = pricingRules.filter(rule => {
            const matchesProduct = rule.product === product.id
            const matchesCategory = rule.category === categoryId
            const matchesQty = qty >= parseFloat(rule.min_quantity)
            const matchesUom = !rule.uom || rule.uom === selectedUomId
            const matchesDate = (!rule.start_date || rule.start_date <= date) &&
                (!rule.end_date || rule.end_date >= date)

            return (matchesProduct || matchesCategory) && matchesQty && matchesDate && matchesUom
        }).sort((a, b) => b.priority - a.priority || parseFloat(b.min_quantity) - parseFloat(a.min_quantity))

        if (applicableRules.length > 0) {
            const rule = applicableRules[0]
            if (rule.rule_type === "FIXED") {
                return parseFloat(rule.fixed_price || "0")
            } else {
                return PricingUtils.applyDiscount(basePrice, parseFloat(rule.discount_percentage || "0"))
            }
        }

        // 2. Proportional pricing based on UoM if no rule
        if (selectedUomId && selectedUomId !== product.uom) {
            const baseUom = uoms.find(u => u.id === product.uom)
            const targetUom = uoms.find(u => u.id === selectedUomId)

            if (baseUom && targetUom) {
                return PricingUtils.calculateUoMPrice(
                    basePrice,
                    parseFloat(baseUom.ratio),
                    parseFloat(targetUom.ratio)
                )
            }
        }

        return basePrice
    }

    const addToCart = (product: Product, mfgData?: any) => {
        const isManufacturable = product.product_type === 'MANUFACTURABLE' || product.requires_advanced_manufacturing;
        const existing = !isManufacturable ? items.find(i => i.id === product.id) : null;

        // Prioritize sale_uom if available
        const saleUoMId = (product as any).sale_uom
        const defaultUoM = saleUoMId || product.uom
        const uomName = uoms?.find(u => u.id === defaultUoM)?.name || product.uom_name

        if (existing) {
            const newQty = existing.qty + 1
            const netPrice = getEffectivePrice(product, newQty, existing.uom)
            setItems(items.map(i => i.cartItemId === existing.cartItemId
                ? {
                    ...i,
                    qty: newQty,
                    unit_price_net: netPrice,
                    total_net: PricingUtils.calculateLineNet(newQty, netPrice),
                    total_tax: PricingUtils.calculateTax(PricingUtils.calculateLineNet(newQty, netPrice)),
                    total_gross: PricingUtils.calculateLineTotal(newQty, netPrice),
                    manufacturing_data: mfgData || i.manufacturing_data
                }
                : i
            ))
        } else {
            const netPrice = getEffectivePrice(product, 1, defaultUoM)
            setItems([...items, {
                ...product,
                cartItemId: Math.random().toString(36).substring(2, 9),
                qty: 1,
                uom: defaultUoM,
                uom_name: uomName,
                unit_price_net: netPrice,
                total_net: PricingUtils.calculateLineNet(1, netPrice),
                total_tax: PricingUtils.calculateTax(PricingUtils.calculateLineNet(1, netPrice)),
                total_gross: PricingUtils.calculateLineTotal(1, netPrice),
                manufacturing_data: mfgData
            }])
        }
    }


    const updateQty = (cartItemId: string, qty: number | string) => {
        setItems(items.map(i => {
            if (i.cartItemId === cartItemId) {
                let newQty = typeof qty === 'string' ? parseInt(qty) : qty
                if (isNaN(newQty) || newQty < 1) newQty = 1

                const netPrice = getEffectivePrice(i, newQty, i.uom)
                return {
                    ...i,
                    qty: newQty,
                    unit_price_net: netPrice,
                    total_net: PricingUtils.calculateLineNet(newQty, netPrice),
                    total_tax: PricingUtils.calculateTax(PricingUtils.calculateLineNet(newQty, netPrice)),
                    total_gross: PricingUtils.calculateLineTotal(newQty, netPrice)
                }
            }
            return i
        }))
    }

    const removeItem = (cartItemId: string) => {
        setItems(items.filter(i => i.cartItemId !== cartItemId))
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

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
                {/* Left: Product List / Search */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col space-y-4 overflow-hidden">
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
                                                // Disable if MANUFACTURABLE and quantity is 0 (specifically 0, not null/infinity), EXCEPT if has no BOM
                                                product.product_type === 'MANUFACTURABLE' && (product.manufacturable_quantity === 0) && product.has_bom && "opacity-50 pointer-events-none grayscale-[0.5]"
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
                                                        <div className={`h-2 w-2 rounded-full ${(!product.has_bom || (product.manufacturable_quantity || 0) > 0 || product.manufacturable_quantity === null || product.manufacturable_quantity === undefined) ? 'bg-blue-500' : 'bg-red-500'}`} />
                                                        {(!product.has_bom || product.manufacturable_quantity === null || product.manufacturable_quantity === undefined || product.manufacturable_quantity > 999999)
                                                            ? 'Disponible'
                                                            : `${product.manufacturable_quantity} fab.`}
                                                    </div>
                                                )}
                                                {(product.product_type === 'SERVICE' || product.product_type === 'SUBSCRIPTION' || product.product_type === 'CONSUMABLE') && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                        Disponible
                                                    </div>
                                                )}
                                            </div>
                                            <CardContent className="p-3 text-center flex-1 flex flex-col justify-center">
                                                <div className="font-bold text-sm line-clamp-2">{product.name}</div>
                                                <div className="text-primary font-semibold text-base mt-1">
                                                    {formatCurrency(PricingUtils.netToGross(Number(product.sale_price)))}
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
                <div className="md:col-span-12 lg:col-span-5 flex flex-col space-y-4 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b font-medium bg-muted/50 flex justify-between items-center">
                                <span>Resumen de Venta</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{items.length} items</span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                        <TableRow className="hover:bg-transparent border-b">
                                            <TableHead className="w-[40%] text-xs py-2">Producto</TableHead>
                                            <TableHead className="w-[15%] text-xs py-2 text-center">Cant.</TableHead>
                                            <TableHead className="w-[15%] text-xs py-2 text-center">Unidad</TableHead>
                                            <TableHead className="w-[20%] text-xs py-2 text-right">Total</TableHead>
                                            <TableHead className="w-[10%] py-2"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            const originalProduct = products.find(p => p.id === item.id)
                                            const itemUom = uoms.find(u => u.id === item.uom)

                                            let allowedUoMs: any[] = []
                                            if (originalProduct && (originalProduct as any).allowed_sale_uoms?.length > 0) {
                                                const allowedIds = (originalProduct as any).allowed_sale_uoms
                                                const saleUoMId = (originalProduct as any).sale_uom
                                                allowedUoMs = uoms.filter(u => allowedIds.includes(u.id) || u.id === saleUoMId)
                                            } else if (itemUom) {
                                                allowedUoMs = uoms.filter(u => u.category === itemUom.category)
                                            }

                                            return (
                                                <TableRow key={item.cartItemId} className="group border-b hover:bg-muted/30 transition-colors">
                                                    <TableCell className="py-2 align-top">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-xs truncate max-w-[150px]" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-tighter">
                                                                {item.internal_code || item.code}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex justify-center">
                                                            <Input
                                                                type="number"
                                                                className="h-7 w-12 text-center text-xs font-bold bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0"
                                                                value={item.qty}
                                                                onChange={(e) => updateQty(item.cartItemId, e.target.value)}
                                                                min="1"
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex justify-center">
                                                            {allowedUoMs.length > 1 ? (
                                                                <Select
                                                                    value={item.uom?.toString()}
                                                                    onValueChange={(val) => {
                                                                        const newUom = uoms.find(u => u.id.toString() === val)
                                                                        setItems(items.map(i => i.cartItemId === item.cartItemId ? { ...i, uom: parseInt(val), uom_name: newUom?.name } : i))
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50 py-0 px-2 min-h-0 focus:ring-0">
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
                                                                <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/30 px-1.5 py-0.5 rounded leading-none">
                                                                    {item.uom_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-xs">
                                                                {formatCurrency(item.total_gross)}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground leading-none">
                                                                Neto: {formatCurrency(item.total_net)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => removeItem(item.cartItemId)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-xs italic">
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
                                        <span>{formatCurrency(total_net_sum)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>IVA (19%)</span>
                                        <span>{formatCurrency(total_tax_sum)}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                        <span>Total</span>
                                        <span>{formatCurrency(total_gross_sum)}</span>
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

            {
                checkoutOpen && (
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
                )
            }
        </div>
    )
}
