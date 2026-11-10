"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BaseModal, Skeleton } from "@/components/shared"
import { Blobatar } from "@/components/ui/blobatar"
import { Input } from "@/components/ui/input"
import { MIN_TOUCH_TARGET } from "../hooks/useDeviceContext"
import type { PosOperator } from "../types"

const SEARCH_THRESHOLD = 12

interface OperatorPickerModalProps {
    open: boolean
    operators: PosOperator[]
    isLoading: boolean
    isError: boolean
    onRetry: () => void
    onSelect: (operator: PosOperator) => void
    onCancel: () => void
    /** Hay una identificación en curso: no se puede elegir otro. */
    isSubmitting?: boolean
}

/**
 * Selector de operador para cajas multiusuario. En la primera edición basta con elegir
 * el nombre; aquí se agregará el segundo paso de credencial (PIN / tarjeta) sin cambiar
 * el resto del flujo. Es un registro de buena fe: el texto no dice "verificado".
 */
export function OperatorPickerModal({
    open, operators, isLoading, isError, onRetry, onSelect, onCancel, isSubmitting = false,
}: OperatorPickerModalProps) {
    const [query, setQuery] = useState("")
    const needle = query.trim().toLowerCase()
    const visible = needle ? operators.filter((o) => o.full_name.toLowerCase().includes(needle)) : operators

    return (
        <BaseModal
            open={open}
            onOpenChange={(next) => { if (!next) onCancel() }}
            title="¿Quién opera?"
            description="Elija el operador que realizará esta acción."
            size="md"
            footer={(
                <>
                    {isSubmitting && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                    <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                </>
            )}
        >
                {operators.length > SEARCH_THRESHOLD && (
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar operador…"
                        aria-label="Buscar operador"
                    />
                )}

                {isLoading ? (
                    <div role="status" aria-label="Cargando operadores" className="grid grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">No se pudieron cargar los operadores.</p>
                        <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
                    </div>
                ) : operators.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No hay operadores habilitados para esta caja.
                    </p>
                ) : (
                    <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
                        {visible.map((operator) => (
                            <Button
                                key={operator.id}
                                variant="outline"
                                disabled={isSubmitting}
                                className="h-auto justify-start gap-3 px-3 py-3"
                                style={{ minHeight: MIN_TOUCH_TARGET + 20 }}
                                onClick={() => onSelect(operator)}
                            >
                                <Blobatar name={operator.username || operator.full_name} className="size-10 shrink-0 rounded-full" />
                                <span className="truncate text-left font-medium">{operator.full_name}</span>
                            </Button>
                        ))}
                    </div>
                )}
        </BaseModal>
    )
}
