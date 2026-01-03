"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, ChevronRight } from "lucide-react"
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

import { AttributeBadges } from "@/components/shared/AttributeBadges"
import { Badge } from "@/components/ui/badge"
import { VariantPicker } from "@/components/shared/VariantPicker"

interface ProductSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    productType?: string
    showAllVariants?: boolean // New prop to control if we want to see variants in the list
}

export function ProductSelector({ value, onChange, placeholder = "Seleccionar producto...", productType, showAllVariants = true }: ProductSelectorProps) {
    const [open, setOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [filteredProducts, setFilteredProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<any>(null)

    // Variant Picker State
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickingParent, setPickingParent] = useState<any>(null)

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true)
            try {
                let url = '/inventory/products/'
                if (productType) {
                    url += `?product_type=${productType}`
                }
                const res = await api.get(url)
                const allProducts = res.data.results || res.data

                setProducts(allProducts)

                // Initial filter: if showAllVariants is false, show only parents
                const initialFiltered = showAllVariants
                    ? allProducts
                    : allProducts.filter((p: any) => p.variant_of === null);

                setFilteredProducts(initialFiltered)

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
    }, [value, productType, showAllVariants])

    const handleSelect = (product: any) => {
        if (product.variants_count > 0 && product.variant_of === null) {
            setPickingParent(product)
            setPickerOpen(true)
            return
        }

        setSelectedProduct(product)
        onChange(product ? product.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const onVariantSelect = (variant: any) => {
        setSelectedProduct(variant)
        onChange(variant ? variant.id.toString() : null)
        setOpen(false)
        setModalOpen(false)
    }

    const searchProducts = (val: string) => {
        setSearchTerm(val)
        const lowerVal = val.toLowerCase()

        let baseList = products;
        if (!showAllVariants && !val) {
            baseList = products.filter(p => p.variant_of === null);
        }

        setFilteredProducts(
            baseList.filter(p =>
                p.code.toLowerCase().includes(lowerVal) ||
                p.name.toLowerCase().includes(lowerVal) ||
                p.attribute_values?.some((av: any) =>
                    av.value.toLowerCase().includes(lowerVal) ||
                    av.attribute_name.toLowerCase().includes(lowerVal)
                )
            )
        )
    }

    return (
        <div className="flex gap-2 w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-9 px-3"
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedProduct ? (
                                <>
                                    <span className="font-medium">{selectedProduct.code} - {selectedProduct.name}</span>
                                    {selectedProduct.attribute_values?.length > 0 && (
                                        <div className="flex gap-0.5 scale-75 origin-left">
                                            {selectedProduct.attribute_values.map((av: any) => (
                                                <Badge key={av.id} variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/50">
                                                    {av.value}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar código, nombre o atributos..."
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
                                    const isVariant = product.variant_of !== null;
                                    const hasVariants = product.variants_count > 0;

                                    return (
                                        <div
                                            key={product.id}
                                            className={cn(
                                                "relative flex cursor-default select-none items-start rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                                selectedProduct?.id === product.id && "bg-accent",
                                                isVariant && "pl-6"
                                            )}
                                            onClick={() => handleSelect(product)}
                                        >
                                            <Check
                                                className={cn(
                                                    "absolute left-2 top-3 h-4 w-4",
                                                    isVariant ? "left-6" : "left-2",
                                                    selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className={cn("flex flex-col w-full ml-6", isVariant ? "ml-4" : "")}>
                                                <div className="flex items-center justify-between">
                                                    <span className={cn("font-medium", isVariant && "text-muted-foreground")}>
                                                        {product.code} - {product.name}
                                                    </span>
                                                    {hasVariants && (
                                                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-blue-600 border-blue-100 bg-blue-50">
                                                            {product.variants_count} var
                                                        </Badge>
                                                    )}
                                                </div>
                                                {product.attribute_values?.length > 0 && (
                                                    <AttributeBadges attributes={product.attribute_values} />
                                                )}
                                                <div className="flex justify-between mt-0.5">
                                                    <span className="text-[10px] text-muted-foreground">
                                                        Stock: {hasVariants ? product.total_stock : (product.current_stock || 0)}
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
                            Filtre por código, nombre o atributos específicos para encontrar el producto exacto.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4 flex-1 overflow-hidden flex flex-col">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Filtrar por código, nombre o atributos..."
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
                                        <TableHead>Nombre / Atributos</TableHead>
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
                                                product.variant_of !== null && "opacity-80"
                                            )}
                                            onClick={() => handleSelect(product)}
                                        >
                                            <TableCell className="font-mono text-xs">
                                                <div className="flex items-center gap-1">
                                                    {product.variant_of !== null && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                                    {product.code}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{product.name}</span>
                                                    {product.attribute_values?.length > 0 && (
                                                        <AttributeBadges attributes={product.attribute_values} />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{product.category_name}</TableCell>
                                            <TableCell className="text-right font-medium">${Number(product.sale_price).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{product.variants_count > 0 ? product.total_stock : (product.current_stock || 0)}</TableCell>
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

            <VariantPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                parentProduct={pickingParent}
                onSelect={onVariantSelect}
            />
        </div>
    )
}
