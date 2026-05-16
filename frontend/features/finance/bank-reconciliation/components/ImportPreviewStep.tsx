"use client"

import React from "react"
import { AlertCircle, CheckCircle2, AlertTriangle, Calendar, FileText, DollarSign, Wallet } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"
import { Chip } from "@/components/shared"
import { FormSection } from "@/components/shared"

export interface DryRunWarning {
    line: number | null
    message: string
}

export interface DryRunResult {
    total_lines: number
    period_start: string | null
    period_end: string | null
    opening_balance: string
    closing_balance: string
    is_duplicate: boolean
    errors: string[]
    warnings: DryRunWarning[]
    can_import: boolean
}

interface ImportPreviewStepProps {
    data: DryRunResult | null
    isLoading: boolean
}

function MetricCard({ title, value, icon: Icon, subtitle }: { title: string, value: string | React.ReactNode, icon: React.ElementType, subtitle?: string }) {
    return (
        <div className="flex items-center p-4 bg-background border border-border/40 rounded-lg shadow-sm">
            <div className="p-3 bg-muted/50 rounded-full mr-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">{title}</p>
                <div className="text-lg font-black tracking-tight mt-0.5">{value}</div>
                {subtitle && <p className="text-[10px] uppercase text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
        </div>
    )
}

export default function ImportPreviewStep({ data, isLoading }: ImportPreviewStepProps) {
    if (isLoading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center space-y-4 animate-pulse">
                <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
                <p className="text-sm font-bold uppercase text-muted-foreground">Validando cartola...</p>
            </div>
        )
    }

    if (!data) return null
    
    const hasWarnings = data.warnings.length > 0
    const hasErrors = data.errors.length > 0

    return (
        <div className="px-4 pb-4 pt-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <FormSection title="Resumen de la Cartola" icon={FileText} />
            
            {data.is_duplicate && (
                <Alert className="border-warning/50 bg-warning/10 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-black uppercase">Archivo Duplicado</AlertTitle>
                    <AlertDescription className="text-xs font-medium">
                        Este archivo exacto ya ha sido importado anteriormente. Puedes continuar si se trata de una rectificación, pero ten cuidado con duplicar transacciones.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    title="Líneas Válidas" 
                    value={data.total_lines} 
                    icon={FileText} 
                />
                <MetricCard 
                    title="Período" 
                    value={
                        data.period_start === data.period_end 
                            ? data.period_start || "N/A"
                            : `${data.period_start} al ${data.period_end}`
                    } 
                    icon={Calendar} 
                />
                <MetricCard 
                    title="Balance Inicial" 
                    value={formatCurrency(parseFloat(data.opening_balance))} 
                    icon={DollarSign} 
                />
                <MetricCard 
                    title="Balance Final" 
                    value={formatCurrency(parseFloat(data.closing_balance))} 
                    icon={Wallet} 
                />
            </div>

            <FormSection title="Resultados de Validación" icon={CheckCircle2} />

            {hasErrors ? (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-black uppercase tracking-wider">Error Bloqueante</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                        La cartola contiene errores críticos y no puede ser importada en su estado actual.
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {data.errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            ) : hasWarnings ? (
                <Alert className="border-warning/50 bg-warning/5 text-warning-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertTitle className="text-xs font-black uppercase tracking-wider text-warning">Advertencias</AlertTitle>
                    <AlertDescription className="text-xs mt-1 text-muted-foreground font-medium">
                        La cartola puede ser importada, pero se encontraron inconsistencias menores. Verifica la tabla de abajo.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert className="border-success/30 bg-success/5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertTitle className="text-xs font-black uppercase tracking-wider text-success">Validación Exitosa</AlertTitle>
                    <AlertDescription className="text-xs mt-1 text-muted-foreground font-medium">
                        Todo parece estar en orden. La cartola puede ser importada.
                    </AlertDescription>
                </Alert>
            )}

            {hasWarnings && (
                <div className="rounded-lg border border-border/40 overflow-hidden bg-background max-h-[40vh] overflow-y-auto custom-scrollbar">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                            <TableRow>
                                <TableHead className="w-[100px] text-xs font-black uppercase">Línea</TableHead>
                                <TableHead className="w-[120px] text-xs font-black uppercase">Tipo</TableHead>
                                <TableHead className="text-xs font-black uppercase">Mensaje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.warnings.map((warn, i) => (
                                <TableRow key={i} className="hover:bg-muted/30">
                                    <TableCell className="text-xs font-mono font-medium">
                                        {warn.line ?? "General"}
                                    </TableCell>
                                    <TableCell>
                                        <Chip intent="warning">Advertencia</Chip>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground font-medium">
                                        {warn.message}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
