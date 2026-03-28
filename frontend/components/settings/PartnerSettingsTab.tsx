"use client"

import React, { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Building2, Plus, ArrowUpRight, ArrowDownRight, Wallet, Users, Banknote, Edit2, Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { PartnerSummary } from "@/features/contacts/types/partner"
import { CashMovementModal } from "@/features/treasury/components/CashMovementModal"
import { PartnerEditModal } from "./PartnerEditModal"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { InitialCapitalModal } from "./InitialCapitalModal"

export function PartnerSettingsTab() {
    const [partners, setPartners] = useState<any[]>([])
    const [summary, setSummary] = useState<PartnerSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [fixedMoveType, setFixedMoveType] = useState<string | undefined>()
    const [selectedPartner, setSelectedPartner] = useState<{ id: number; name: string } | null>(null)
    const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false)
    const [selectedNewPartnerId, setSelectedNewPartnerId] = useState<number | null>(null)
    const [accountingSettings, setAccountingSettings] = useState<any>(null)
    const [isInitialCapitalModalOpen, setIsInitialCapitalModalOpen] = useState(false)
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [partnersData, summaryData, settingsData] = await Promise.all([
                partnersApi.getPartners(),
                partnersApi.getSummary(),
                accountingApi.getSettings()
            ])
            setPartners(partnersData)
            setSummary(summaryData)
            setAccountingSettings(settingsData)
        } catch (error) {
            toast.error("Error al cargar la información")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleEditPartnerClick = (partner: any) => {
        setSelectedPartner(partner)
        setIsEditModalOpen(true)
    }

    const handleAddExistingContact = (contactId: string | null) => {
        if (!contactId) return;
        setSelectedPartner({ id: parseInt(contactId), name: "Contacto Seleccionado" })
        setIsEditModalOpen(true)
        setSelectedNewPartnerId(null)
    }

    const handleUpdateCapitalAccount = async (accountId: string | null) => {
        setIsUpdatingSettings(true)
        try {
            await accountingApi.updateSettings({
                partner_capital_social_account: accountId ? parseInt(accountId) : null
            })
            toast.success("Cuenta de Capital Social actualizada correctamente")
            const updated = await accountingApi.getSettings()
            setAccountingSettings(updated)
        } catch (error) {
            toast.error("Error al actualizar la configuración contable")
        } finally {
            setIsUpdatingSettings(false)
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-start" title="Socio" />,
            cell: ({ row }) => <DataCell.Text className="font-bold">{row.getValue("name")}</DataCell.Text>,
        },
        {
            accessorKey: "tax_id",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-start" title="RUT" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("tax_id")}</DataCell.Code>,
        },
        {
            accessorKey: "partner_equity_percentage",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Participación" />,
            cell: ({ row }) => (
                <div className="text-center font-bold text-primary">
                    {row.original.partner_equity_percentage ? `${row.original.partner_equity_percentage}%` : '—'}
                </div>
            )
        },
        {
            accessorKey: "partner_balance",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-end" title="Saldo Particular (Neto)" />,
            cell: ({ row }) => <DataCell.Currency className="font-bold text-foreground" value={row.getValue("partner_balance")} />,
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const p = row.original
                return (
                    <div className="flex justify-end pr-4 gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-2 text-xs"
                            onClick={() => handleEditPartnerClick(p)}
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                            Ajustar %
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => {
                                    setSelectedPartner({ id: p.id, name: p.name })
                                    setFixedMoveType('CAPITAL_CONTRIBUTION')
                                    setIsCashMovementModalOpen(true)
                                }}
                            >
                                <TrendingUp className="h-3.5 w-3.5" />
                                Aporte
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => {
                                    setSelectedPartner({ id: p.id, name: p.name })
                                    setFixedMoveType('PARTNER_WITHDRAWAL')
                                    setIsCashMovementModalOpen(true)
                                }}
                            >
                                <TrendingDown className="h-3.5 w-3.5" />
                                Retiro
                            </Button>
                        </div>
                    </div>
                )
            }
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm tracking-tight text-foreground">Composición Societaria</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                            Gestión de capital, aportes y retiros
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-[300px]">
                        <AdvancedContactSelector
                            value={selectedNewPartnerId}
                            onChange={handleAddExistingContact}
                            placeholder="Buscar contacto para hacer socio..."
                        />
                    </div>
                    <Button 
                        variant="default"
                        className="gap-2 bg-foreground text-background hover:bg-foreground/90 font-bold"
                        onClick={() => setIsInitialCapitalModalOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Configuración Inicial de Capital
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="md:col-span-3 border-dashed border-2 bg-muted/20">
                    <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">Configuración Contable</h4>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                    Define la cuenta donde se registrará el Capital Social
                                </p>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex items-center gap-2">
                            <div className="flex-1">
                                <AccountSelector
                                    value={accountingSettings?.partner_capital_social_account}
                                    onChange={handleUpdateCapitalAccount}
                                    placeholder="Seleccionar cuenta de Capital Social..."
                                    accountType="EQUITY"
                                />
                            </div>
                            {isUpdatingSettings && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" /> Total Socios
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-2xl font-bold">{summary?.total_partners || 0}</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-emerald-500/20 bg-emerald-50/50">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 flex items-center gap-2">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Total Aportes
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <DataCell.Currency className="text-2xl font-bold text-emerald-700" value={summary?.total_contributions || 0} />
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-rose-500/20 bg-rose-50/50">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-rose-700 flex items-center gap-2">
                            <ArrowDownRight className="h-3.5 w-3.5" /> Total Retiros
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <DataCell.Currency className="text-2xl font-bold text-rose-700" value={summary?.total_withdrawals || 0} />
                    </CardContent>
                </Card>

                <Card className="shadow-sm border bg-foreground text-background md:col-span-2 lg:col-span-1">
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted flex items-center gap-2">
                            <Wallet className="h-3.5 w-3.5" /> Patrimonio Neto
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <DataCell.Currency className="text-2xl font-bold" value={summary?.net_equity || 0} />
                    </CardContent>
                </Card>
            </div>

            <div className="border bg-card rounded-xl shadow-sm">
                <DataTable
                    columns={columns}
                    data={partners}
                    isLoading={loading}
                    searchPlaceholder="Buscar socio..."
                    noBorder={true}
                    globalFilterFields={['name', 'tax_id']}
                />
            </div>

            <CashMovementModal
                open={isCashMovementModalOpen}
                onOpenChange={(open) => {
                    setIsCashMovementModalOpen(open)
                    if (!open) {
                        setFixedMoveType(undefined)
                        setSelectedPartner(null)
                    }
                }}
                initialContactId={selectedPartner?.id}
                initialContactName={selectedPartner?.name}
                fixedMoveType={fixedMoveType}
                onSuccess={() => {
                    fetchData()
                    setFixedMoveType(undefined)
                    setSelectedPartner(null)
                }}
            />

            <PartnerEditModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                contact={selectedPartner}
                onSuccess={fetchData}
            />

            <InitialCapitalModal
                open={isInitialCapitalModalOpen}
                onOpenChange={setIsInitialCapitalModalOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
