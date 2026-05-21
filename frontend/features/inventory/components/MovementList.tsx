"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, createActionsColumn } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"

import { Eye, ArrowRightLeft, Plus } from "lucide-react"
import { Chip } from "@/components/shared/Chip"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm"
import { CancelButton, SubmitButton, FormFooter } from "@/components/shared"
import { BaseModal } from "@/components/shared/BaseModal"

import { TransactionType } from "@/types/transactions"

interface StockMove {
    id: number
    date: string
    product_name: string
    product_internal_code?: string
    product_code?: string
    warehouse_name: string
    quantity: string
    uom_name: string
    move_type: string
    description: string
    related_documents: Array<{
        type: string
        id: number | string
        name: string
    }>
}
interface MovementListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useStockMovesList } from "@/features/inventory/hooks/useStockMoves"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { stockMoveSearchDef } from "@/features/inventory/searchDef"

export function MovementList({ externalOpen, onExternalOpenChange, createAction }: MovementListProps) {
    const { filters } = useSmartSearch(stockMoveSearchDef)
    const { moves, isLoading, refetch } = useStockMovesList(filters)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: TransactionType, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
    const [isFormLoading, setIsFormLoading] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Open detail modal if ?selected= is present (ADR-0020)
    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId && !viewingTransaction) {
            setViewingTransaction({ type: 'inventory', id: selectedId })
        }
    }, [searchParams, viewingTransaction])

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const handleCloseModal = () => {
        setShowAdjustmentModal(false)
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        {
            id: "folio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center gap-0.5">
                    <DataCell.Entity label="inventory.stockmove" data={row.original} />
                    <DataCell.Date value={row.original.date} className="text-[10px] opacity-50" />
                </div>
            ),
            size: 100,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex flex-col items-center py-1 w-full">
                    <DataCell.Text className="text-center">{row.original.product_name}</DataCell.Text>
                    <div className="flex gap-2 items-center justify-center">
                        {row.original.product_internal_code && (
                            <DataCell.Code>{row.original.product_internal_code}</DataCell.Code>
                        )}
                        {row.original.product_code && row.original.product_code !== row.original.product_internal_code && (
                            <DataCell.Secondary className="text-[9px] font-mono opacity-50">
                                {row.original.product_code}
                            </DataCell.Secondary>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="font-normal">
                    {row.getValue("warehouse_name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "quantity",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.NumericFlow
                    value={row.getValue("quantity")}
                    unit={row.original.uom_name}
                    showSign={true}
                />
            ),
            size: 100,
        },
        {
            accessorKey: "move_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.original.move_type
                const typeMap: Record<string, { intent: "success" | "destructive" | "warning" | "neutral", label: string }> = {
                    'IN': { intent: 'success', label: 'Entrada' },
                    'OUT': { intent: 'destructive', label: 'Salida' },
                    'ADJ': { intent: 'warning', label: 'Ajuste' }
                }
                const config = typeMap[type] || { intent: 'neutral', label: type }
                return (
                    <div className="flex justify-center w-full">
                        <Chip intent={config.intent} size="sm">{config.label}</Chip>
                    </div>
                )
            },
            size: 100,
        },
        createActionsColumn<StockMove>({
            renderActions: (item) => (
                <DataCell.Action
                    icon={Eye}
                    title="Ver Detalles"
                    color="text-primary"
                    onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('selected', String(item.id))
                        router.push(`${pathname}?${params.toString()}`, { scroll: false })
                    }}
                />
            ),
        }),
    ], [])

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={moves}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={stockMoveSearchDef} placeholder="Buscar movimientos..." className="w-full" />}
                    createAction={createAction}
                />
            </div>

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewingTransaction(null)
                            clearSelection()
                        }
                    }}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            <BaseModal
                open={showAdjustmentModal || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setShowAdjustmentModal(true)
                    }
                }}
                size="lg"
                hideScrollArea={true}
                contentClassName="p-0"
                icon={ArrowRightLeft}
                title="Nuevo Ajuste de Inventario"
                description="Procedimiento táctico de rectificación de stock físico."
                footer={
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={handleCloseModal} />
                                <SubmitButton
                                    form="adjustment-form"
                                    loading={isFormLoading}
                                    variant="primary"
                                    className="px-8"
                                >
                                    Confirmar Ajuste
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >
                <AdjustmentForm
                    onLoadingChange={setIsFormLoading}
                    onSuccess={() => {
                        handleCloseModal();
                        refetch();
                    }}
                    onCancel={handleCloseModal}
                />
            </BaseModal>
        </div>
    )
}
