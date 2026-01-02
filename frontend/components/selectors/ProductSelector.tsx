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

interface ProductSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    productType?: string
}

export function ProductSelector({ value, onChange, placeholder = "Seleccionar producto...", productType }: ProductSelectorProps) {
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
                const allProducts = res.data.results || res.data

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

    const handleSelect = (product: any) => {
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
        <div className="flex gap-2 w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-9 px-3"
                    >
                        <span className="truncate">
                            {selectedProduct
                                ? `${selectedProduct.code} - ${selectedProduct.name}`
                                : placeholder}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
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
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="p-4 text-sm text-center">No se encontraron productos.</div>
                            ) : (
                                filteredProducts.slice(0, 10).map((product) => (
                                    <div
                                        key={product.id}
                                        className={cn(
                                            "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                            selectedProduct?.id === product.id && "bg-accent"
                                        )}
                                        onClick={() => handleSelect(product)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{product.code} - {product.name}</span>
                                            <span className="text-xs text-muted-foreground">Stock: {product.stock || 0}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                            {filteredProducts.length > 10 && (
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
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Búsqueda Avanzada de Productos</DialogTitle>
                        <DialogDescription>
                            Seleccione un producto del inventario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4 flex-1 overflow-hidden flex flex-col">
                        <Input
                            placeholder="Filtrar por código o nombre..."
                            value={searchTerm}
                            onChange={(e) => searchProducts(e.target.value)}
                        />
                        <div className="border rounded-md flex-1 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-1/4">Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Stock</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.map((product) => (
                                        <TableRow
                                            key={product.id}
                                            className="cursor-pointer hover:bg-accent"
                                            onClick={() => handleSelect(product)}
                                        >
                                            <TableCell className="font-mono">{product.code}</TableCell>
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.category_name}</TableCell>
                                            <TableCell>{product.stock || 0}</TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
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
        </div>
    )
}
