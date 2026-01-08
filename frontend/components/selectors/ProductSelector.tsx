"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface ProductSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    productType?: string
    allowedTypes?: string[]
    disabled?: boolean
    restrictStock?: boolean
    showSearch?: boolean
}

export function ProductSelector({
    value,
    onChange,
    placeholder = "Seleccionar producto...",
    productType,
    allowedTypes,
    disabled = false,
    restrictStock = false,
    showSearch = true
}: ProductSelectorProps) {
    const [open, setOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [filteredProducts, setFilteredProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<any>(null)

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true)
            try {
                let url = '/inventory/products/'
                if (productType) {
                    url += `?product_type=${productType}`
                }
                const res = await api.get(url)
                let allProducts = res.data.results || res.data

                if (allowedTypes && allowedTypes.length > 0) {
                    allProducts = allProducts.filter((p: any) => allowedTypes.includes(p.product_type))
                }

                setProducts(allProducts)
                setFilteredProducts(allProducts)

                if (value) {
                    const found = allProducts.find((p: any) => p.id.toString() === value.toString())
                    setSelectedProduct(found)
                }
            } catch (error) {
                console.error("Error fetching products", error)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [value, productType])

    const isStockRestricted = (product: any) => {
        return restrictStock && product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0
    }

    const handleSelect = (product: any) => {
        if (isStockRestricted(product)) {
            return;
        }

        setSelectedProduct(product)
        onChange(product ? product.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const searchProducts = (val: string) => {
        setSearchTerm(val)
        const lowerVal = val.toLowerCase()

        setFilteredProducts(
            products.filter(p =>
                p.code.toLowerCase().includes(lowerVal) ||
                p.name.toLowerCase().includes(lowerVal)
            )
        )
    }

    return (
        <div className="flex gap-2 w-full min-w-0">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="flex-1 justify-between h-9 px-3 min-w-0"
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedProduct ? (
                                <span className="font-medium truncate">{selectedProduct.code} - {selectedProduct.name}</span>
                            ) : (
                                <span className="text-muted-foreground truncate">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar código o nombre..."
                                value={searchTerm}
                                onChange={(e) => searchProducts(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="p-4 text-sm text-center">No se encontraron productos.</div>
                            ) : (
                                filteredProducts.slice(0, 15).map((product) => {
                                    return (
                                        <div
                                            key={product.id}
                                            data-disabled={isStockRestricted(product)}
                                            className={cn(
                                                "relative flex cursor-default select-none items-start rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                                                selectedProduct?.id === product.id && "bg-accent"
                                            )}
                                            onClick={() => handleSelect(product)}
                                        >
                                            <Check
                                                className={cn(
                                                    "absolute left-2 top-3 h-4 w-4 opacity-0",
                                                    selectedProduct?.id === product.id && "opacity-100"
                                                )}
                                            />
                                            <div className="flex flex-col w-full ml-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {product.code} - {product.name}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between mt-0.5">
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {product.product_type === 'STORABLE' && `Stock: ${(product.current_stock || 0)}`}
                                                    </span>
                                                    <span className="text-[10px] font-bold">${Number(product.sale_price).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            {filteredProducts.length > 15 && (
                                <div className="p-2 text-xs text-center text-muted-foreground border-t">
                                    Use búsqueda avanzada para ver más...
                                </div>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {showSearch && (
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" title="Búsqueda Avanzada" className="h-9 w-9 shrink-0">
                            <Search className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Búsqueda Avanzada de Productos</DialogTitle>
                            <DialogDescription>
                                Filtre por código o nombre para encontrar el producto exacto.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4 flex-1 overflow-hidden flex flex-col">
                            <div className="flex gap-2">
                                <Input
                                    autoFocus
                                    placeholder="Filtrar por código o nombre..."
                                    value={searchTerm}
                                    onChange={(e) => searchProducts(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                            <div className="border rounded-md flex-1 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-1/4">Código</TableHead>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead className="text-right">Precio</TableHead>
                                            <TableHead className="text-right">Stock</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((product) => (
                                            <TableRow
                                                key={product.id}
                                                className={cn(
                                                    "cursor-pointer hover:bg-accent",
                                                    isStockRestricted(product) && "opacity-50 pointer-events-none grayscale-[0.5]"
                                                )}
                                                onClick={() => handleSelect(product)}
                                            >
                                                <TableCell className="font-mono text-xs">
                                                    {product.code}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{product.name}</span>
                                                </TableCell>
                                                <TableCell className="text-sm">{product.category_name}</TableCell>
                                                <TableCell className="text-right font-medium">${Number(product.sale_price).toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{(product.current_stock || 0)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                                    No se encontraron resultados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
