"use client"

import { useEffect, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Banknote, Receipt, Filter } from "lucide-react"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface CashFlowItem {
    id: number
    source: 'PAYMENT' | 'CASH_MOVEMENT'
    type: string
    date: string
    amount: string
    description: string
    treasury_account_name: string
    partner_name: string | null
    reference: string
    is_internal: boolean
}

export default function CashFlowPage() {
    const [items, setItems] = useState<CashFlowItem[]>([])
    const [loading, setLoading] = useState(true)
    const [flowType, setFlowType] = useState<'third_party' | 'internal' | 'all'>('third_party')

    const fetchCashFlow = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/cash-flow/', {
                params: { flow_type: flowType }
            })
            setItems(response.data || [])
        } catch (error) {
            console.error("Failed to fetch cash flow", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCashFlow()
    }, [flowType])

    const columns: ColumnDef<CashFlowItem>[] = [
        {
            accessorKey: "source",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Origen" />
            ),
            cell: ({ row }) => {
                const source = row.getValue("source") as string
                const isPayment = source === 'PAYMENT'
                return (
                    <div className="flex justify-center">
                        <DataCell.Badge
                            variant={isPayment ? "default" : "outline"}
                            className="gap-1 pl-1.5 pr-2.5"
                        >
                            {isPayment ? <Banknote className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
                            {isPayment ? "PAGO" : "MOVIMIENTO"}
                        </DataCell.Badge>
                    </div>
                )
            },
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("type") as string
                const isInternal = row.original.is_internal

                let icon = ArrowDownLeft
                let color = "text-emerald-600"

                if (type.includes("EGRESO") || type.includes("Retiro") || type.includes("Gasto")) {
                    icon = ArrowUpRight
                    color = "text-amber-600"
                } else if (type.includes("Traspaso") || type.includes("TRANSFER")) {
                    icon = ArrowLeftRight
                    color = "text-blue-600"
                }

                return (
                    <div className="flex items-center gap-2">
                        <DataCell.Icon icon={icon} color={color} className="bg-transparent p-0" />
                        <span className="text-xs font-medium">{type}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" />
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.original.type
                const isIncome = type.includes("INGRESO") || type.includes("Dep") || type.includes("Venta")
                return <DataCell.Currency
                    value={amount}
                    className={isIncome ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}
                />
            },
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{row.getValue("description")}</span>
                    {row.original.partner_name && (
                        <DataCell.Secondary className="font-bold text-foreground">
                            {row.original.partner_name}
                        </DataCell.Secondary>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "treasury_account_name",
            header: "Cuenta",
            cell: ({ row }) => (
                <span className="text-xs font-medium text-muted-foreground">
                    {row.getValue("treasury_account_name")}
                </span>
            ),
        },
        {
            accessorKey: "reference",
            header: "Referencia",
            cell: ({ row }) => <DataCell.Code>{row.getValue("reference")}</DataCell.Code>,
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Flujo de Efectivo Consolidado</h2>
                    <p className="text-muted-foreground">
                        Vista unificada de todos los flujos de efectivo: pagos a terceros y movimientos internos
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtro:</span>
                </div>
                <ToggleGroup
                    type="single"
                    value={flowType}
                    onValueChange={(value) => value && setFlowType(value as typeof flowType)}
                >
                    <ToggleGroupItem value="third_party" aria-label="Flujos con terceros">
                        <Banknote className="h-4 w-4 mr-2" />
                        Flujos con Terceros
                    </ToggleGroupItem>
                    <ToggleGroupItem value="internal" aria-label="Movimientos internos">
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Movimientos Internos
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all" aria-label="Todos">
                        Todos
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando flujos de efectivo...</div>
                </div>
            ) : (
                <div className="">
                    <DataTable
                        columns={columns}
                        data={items}
                        filterColumn="description"
                        searchPlaceholder="Buscar por descripción..."
                        facetedFilters={[
                            {
                                column: "source",
                                title: "Origen",
                                options: [
                                    { label: "Pago", value: "PAYMENT" },
                                    { label: "Movimiento", value: "CASH_MOVEMENT" },
                                ],
                            },
                        ]}
                        useAdvancedFilter={true}
                        defaultPageSize={20}
                    />
                </div>
            )}
        </div>
    )
}
