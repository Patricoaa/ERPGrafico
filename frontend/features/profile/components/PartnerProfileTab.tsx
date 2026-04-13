"use client"

import React, { useEffect, useState, lazy, Suspense } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { 
    Activity, 
    CalendarDays, 
    Wallet, 
    User, 
    Mail, 
    FileText, 
    Building2, 
    TrendingUp, 
    TrendingDown,
    Loader2,
    ChevronRight,
    Briefcase,
    Eye
} from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { PartnerStatement, PartnerTransaction } from "@/features/contacts/types/partner"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LoadingFallback } from "@/components/shared/LoadingFallback"

const TransactionViewModal = lazy(() => import("@/components/shared/TransactionViewModal"))

interface Props {
    contactId: number;
}

export function PartnerProfileTab({ contactId }: Props) {
    const [statement, setStatement] = useState<PartnerStatement | null>(null)
    const [loading, setLoading] = useState(true)
    
    // Movement Details state
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null)

    const fetchData = async () => {
        if (!contactId) return
        setLoading(true)
        try {
            const data = await partnersApi.getStatement(contactId)
            setStatement(data)
        } catch (error) {
            toast.error("Error al cargar estado de cuenta societario")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [contactId])

    const handleViewDetails = (movementId: number) => {
        setSelectedMovementId(movementId)
        setDetailsOpen(true)
    }

    const columns: ColumnDef<PartnerTransaction>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Fecha" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("date")} className="text-center" />
                </div>
            ),
        },
        {
            accessorKey: "transaction_type",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Operación" />,
            cell: ({ row }) => {
                const tx = row.original;
                const type = tx.transaction_type;
                let variant: 'success' | 'warning' | 'info' | 'secondary' = 'secondary';
                
                if (type === 'SUBSCRIPTION' || type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY' || type === 'TRANSFER_IN') {
                    variant = 'success';
                } else if (type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT') {
                    variant = 'warning';
                } else if (type === 'LOAN_IN') {
                    variant = 'info';
                }

                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Badge variant={variant as any}>
                            {tx.transaction_type_display || type}
                        </DataCell.Badge>
                    </div>
                );
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Monto" />,
            cell: ({ row }) => {
                const type = row.original.transaction_type
                const amount = row.getValue("amount") as string
                const isNegative = type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT' || type === 'LOAN_OUT'
                
                return (
                    <div className={cn("flex items-center justify-center gap-1 font-bold w-full", isNegative ? 'text-destructive' : 'text-success')}>
                        <span>{isNegative ? '-' : '+'}</span>
                        <DataCell.Currency value={amount} className="" />
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Acciones" />,
            cell: ({ row }) => {
                const movementId = row.original.treasury_movement
                return (
                    <div className="flex justify-center w-full">
                        {movementId ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => handleViewDetails(movementId)}
                                title="Ver Detalle Transaccional"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        ) : (
                            <span className="text-[10px] text-muted-foreground italic">No vinculado</span>
                        )}
                    </div>
                )
            }
        }
    ]

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!statement) return null

    const { contact, summary } = statement

    return (
        <div className="w-full space-y-6">
            <Accordion type="multiple" defaultValue={["summary", "history"]} className="w-full space-y-6">
                
                {/* Section 1: Metrics & Summary */}
                <AccordionItem value="summary" className="border-none">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
                        <Card className="border shadow-sm overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-6 py-4 border-b bg-muted/30 [&[data-state=open]>div>svg]:rotate-180">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <Wallet className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold tracking-tight">Resumen Patrimonial</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                                            Estado de capitalización neta
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Participation Card */}
                                        <div className="bg-muted/30 p-4 rounded-lg border flex flex-col justify-center text-center">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Participación</span>
                                            <div className="text-3xl font-extrabold text-foreground">
                                                {summary.equity_percentage}%
                                            </div>
                                            <span className="text-[9px] text-muted-foreground mt-1">Participación sobre el total patrimonial</span>
                                        </div>

                                        {/* Net Balance Card */}
                                        <div className="md:col-span-2 bg-primary/5 p-4 rounded-lg border border-primary/20 flex flex-col justify-center items-center text-center">
                                            <span className="text-[10px] text-primary/70 uppercase font-bold tracking-widest mb-1">Saldo Particular Neto</span>
                                            <div className="text-4xl font-black text-primary">
                                                <MoneyDisplay amount={parseFloat(summary.balance)} />
                                            </div>
                                            <span className="text-[9px] text-primary/60 mt-1">Neto acumulado de aportes y retiros</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </AccordionContent>
                        </Card>
                    </motion.div>
                </AccordionItem>

                {/* Section 2: Societal Info */}
                <AccordionItem value="info" className="border-none">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
                        <Card className="border shadow-sm overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-6 py-4 border-b bg-muted/30 [&[data-state=open]>div>svg]:rotate-180">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <Briefcase className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold tracking-tight">Información Societaria</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                                            Identificación y cuentas vinculadas
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <InfoField icon={<User className="h-3.5 w-3.5" />} label="Socio" value={contact.name} />
                                        <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="RUT" value={contact.tax_id} />
                                        <InfoField 
                                            icon={<Building2 className="h-3.5 w-3.5" />} 
                                            label="Cuenta Particular" 
                                            value={contact.partner_account_detail ? `${contact.partner_account_detail.name} (${contact.partner_account_detail.code})` : "No asignada"} 
                                        />
                                        <InfoField 
                                            icon={<CalendarDays className="h-3.5 w-3.5" />} 
                                            label="Socio desde" 
                                            value={(contact.partner_since || contact.created_at) ? new Date(contact.partner_since || contact.created_at).toLocaleDateString('es-CL') : "—"} 
                                        />
                                    </div>
                                </CardContent>
                            </AccordionContent>
                        </Card>
                    </motion.div>
                </AccordionItem>

                {/* Section 3: History */}
                <AccordionItem value="history" className="border-none">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
                        <Card className="border shadow-sm overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-6 py-4 border-b bg-muted/30 [&[data-state=open]>div>svg]:rotate-180">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-success/10 text-success">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold tracking-tight">Historial de Capital</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                                            Resumen de movimientos históricos
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
                                <DataTable
                                    columns={columns}
                                    data={statement.transactions}
                                    noBorder={true}
                                    defaultPageSize={10}
                                />
                            </AccordionContent>
                        </Card>
                    </motion.div>
                </AccordionItem>

            </Accordion>

            <Suspense fallback={<LoadingFallback />}>
                {selectedMovementId && (
                    <TransactionViewModal
                        open={detailsOpen}
                        onOpenChange={setDetailsOpen}
                        type="payment"
                        id={selectedMovementId}
                        view="details"
                    />
                )}
            </Suspense>
        </div>
    )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="space-y-1.5">
            <span className={FORM_STYLES.label}>{label}</span>
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border bg-muted/20 text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{icon}</span>
                {value}
            </div>
        </div>
    )
}
