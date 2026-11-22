"use client"

import { SkeletonShell } from "@/components/shared"
import { useBOM } from "../hooks/useBOMs"
import type { BOM, ProductMinimal } from "../types"
import { BOMDrawer } from "./BOMDrawer"

interface BOMRecordDrawerProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Lista de materiales abierta como pestaña propia (ADR-0152): carga la BOM por id y deriva el producto
 * que el drawer necesita. La creación (`?modal=new`) sigue en el panel de la página.
 */
export function BOMRecordDrawer({ id, open, onOpenChange, onSuccess }: BOMRecordDrawerProps) {
    const query = useBOM(id)
    // `getBOM` has no typed response: cast once here instead of a cast per field below.
    const bom = query.data as BOM | undefined
    if (!bom) return query.isError ? null : <SkeletonShell isLoading ariaLabel="Cargando lista de materiales" />
    return (
        <BOMDrawer
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={() => onSuccess?.()}
            bomToEdit={bom}
            product={{ id: bom.product, name: bom.product_name, code: bom.product_code } as unknown as ProductMinimal}
        />
    )
}
