"use client"

import { Drawer, SkeletonShell } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { type ProductInitialData } from "@/types/forms"
import { useProduct } from "../hooks/useProducts"
import { ProductDrawer } from "./ProductDrawer"

interface ProductDrawerByIdProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Ficha de producto abierta solo con su id (enlaces desde documentos, ADR-0083): carga el
 * producto y abre `ProductDrawer` en modo vista. `ProductDrawer` necesita el objeto completo.
 */
export function ProductDrawerById({ id, open, onOpenChange, onSuccess }: ProductDrawerByIdProps) {
    const { product, isLoading, isError } = useProduct(id)
    if (product) {
        return (
            <ProductDrawer
                mode="view"
                open={open}
                onOpenChange={onOpenChange}
                initialData={product as unknown as ProductInitialData}
                onSuccess={() => onSuccess?.()}
            />
        )
    }
    return (
        <Drawer open={open} onOpenChange={onOpenChange} side="left" title="Producto" defaultSize={formDrawerWidth("master", true)} mode="view">
            {isError
                ? <p role="alert" className="p-6 text-sm text-destructive">No se pudo cargar el producto.</p>
                : <SkeletonShell isLoading={isLoading} ariaLabel="Cargando producto" className="h-40 m-6 rounded-md bg-muted" />}
        </Drawer>
    )
}
