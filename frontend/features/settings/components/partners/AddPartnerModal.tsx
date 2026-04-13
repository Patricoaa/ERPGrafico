"use client"

import { showApiError } from "@/lib/errors"
import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { BaseModal } from "@/components/shared/BaseModal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { Loader2, UserPlus, Info, TrendingDown } from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { formatCurrency } from "@/lib/utils"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AddPartnerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function AddPartnerModal({ open, onOpenChange, onSuccess }: AddPartnerModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<any[]>([])
    const [totalCapital, setTotalCapital] = useState(0)
    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        description: "Incorporación de nuevo socio"
    })

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(data => {
                setPartners(data)
                const total = data.reduce((acc: number, p: any) => {
                    const amount = typeof p.partner_total_contributions === 'string' 
                        ? parseFloat(p.partner_total_contributions) 
                        : (p.partner_total_contributions || 0)
                    return acc + amount
                }, 0)
                setTotalCapital(total)
            })
        }
    }, [open])

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordSubscription({
                contact_id: parseInt(formData.contact_id),
                amount: parseFloat(formData.amount),
                type: 'SUBSCRIPTION',
                date: formData.date,
                description: formData.description
            })
            toast.success("Socio añadido exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al añadir socio")
        } finally {
            setLoading(false)
        }
    }

    const newAmount = parseFloat(formData.amount) || 0
    const projectedTotal = totalCapital + newAmount

    const footerContent = (
        <div className="flex w-full gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !formData.contact_id || newAmount <= 0}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar Incorporación
            </Button>
        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Incorporación de Nuevo Socio
                </div>
            }
            description="Añada un nuevo integrante a la sociedad y registre su compromiso de capital inicial."
            footer={footerContent}
        >
            <div className="space-y-6">
                {/* Selector de nuevo socio */}
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="grid gap-2">
                        <Label>Seleccionar Persona / Empresa</Label>
                        <AdvancedContactSelector 
                            value={formData.contact_id} 
                            onChange={(val) => setFormData(prev => ({ ...prev, contact_id: val || "" }))}
                            placeholder="Busque por nombre o RUT..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">Aporte de Capital ($)</Label>
                            <Input 
                                id="amount" 
                                type="number" 
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                placeholder="0"
                                className="font-mono"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="date">Fecha de Incorporación</Label>
                            <Input 
                                id="date" 
                                type="date" 
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Proyección de Dilución */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            Proyección de Participación (Dilución)
                        </h4>
                        <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                            Total Proyectado: {formatCurrency(projectedTotal)}
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-[10px] font-bold uppercase">Socio</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase text-right">Capital Actual</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase text-right">Actual %</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase text-right text-primary">Proyectado %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {partners.map(p => {
                                    const contributions = typeof p.partner_total_contributions === 'string' 
                                        ? parseFloat(p.partner_total_contributions) 
                                        : (p.partner_total_contributions || 0)
                                    
                                    const currentPerc = p.partner_equity_percentage
                                    const projectedPerc = projectedTotal > 0 ? (contributions / projectedTotal * 100).toFixed(2) : '0.00'
                                    
                                    return (
                                        <TableRow key={p.id} className="opacity-70 grayscale-[0.5]">
                                            <TableCell className="text-xs font-medium">{p.name}</TableCell>
                                            <TableCell className="text-right text-xs font-mono">{formatCurrencyExcludingSymbol(contributions)}</TableCell>
                                            <TableCell className="text-right text-xs">{currentPerc}%</TableCell>
                                            <TableCell className="text-right text-xs font-bold text-primary">{projectedPerc}%</TableCell>
                                        </TableRow>
                                    )
                                })}
                                {/* Nueva fila */}
                                {newAmount > 0 && (
                                    <TableRow className="bg-primary/5 font-bold">
                                        <TableCell className="text-xs text-primary">NUEVO SOCIO</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-primary">{formatCurrencyExcludingSymbol(newAmount)}</TableCell>
                                        <TableCell className="text-right text-xs">-</TableCell>
                                        <TableCell className="text-right text-xs text-primary">{ (newAmount / projectedTotal * 100).toFixed(2) }%</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">
                        Esta acción registrará la suscripción formal de capital. Los aportes reales (efectivo/activos) deben cargarse a través del Libro Auxiliar o Tesorería.
                    </AlertDescription>
                </Alert>
            </div>
        </BaseModal>
    )
}

function formatCurrencyExcludingSymbol(amount: number) {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(amount)
}
