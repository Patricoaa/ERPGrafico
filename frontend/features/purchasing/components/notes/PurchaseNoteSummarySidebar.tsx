
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/currency"
import { formatPlainDate } from "@/lib/utils"
import {
    FileText,
    Box,
    Building2,
    Calendar,
    Receipt,
    AlertCircle,
    CheckCircle2,
    ArrowLeft
} from "lucide-react"

interface PurchaseNoteSummarySidebarProps {
    currentStep: number
    totalSteps: number
    orderNumber?: string
    supplierName?: string
    warehouseName?: string
    referenceText?: string
    noteType: "NOTA_CREDITO" | "NOTA_DEBITO"
    totals: {
        net: number
        tax: number
        total: number
    }
    isProcessing?: boolean
}

export function PurchaseNoteSummarySidebar({
    currentStep,
    totalSteps,
    orderNumber,
    supplierName,
    warehouseName,
    referenceText,
    noteType,
    totals,
    isProcessing
}: PurchaseNoteSummarySidebarProps) {
    const progress = (currentStep / totalSteps) * 100

    return (
        <div className="w-80 border-r bg-muted/10 flex flex-col h-full overflow-hidden">
            {/* Header / Progress */}
            <div className="p-6 border-b bg-background">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Paso {currentStep} de {totalSteps}
                    </span>
                    <span className="text-xs font-black text-primary">
                        {Math.round(progress)}%
                    </span>
                </div>
                <Progress value={progress} className="h-2" />

                <div className="mt-6 flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${noteType === 'NOTA_CREDITO' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                        {noteType === 'NOTA_CREDITO' ? (
                            <ArrowLeft className="h-5 w-5" />
                        ) : (
                            <Receipt className="h-5 w-5" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-tight">
                            {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">
                            {referenceText || (orderNumber ? `Sobre OCS-${orderNumber}` : 'Sobre Documento')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Order Details */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        Detalles de Origen
                    </h4>

                    <div className="space-y-3">
                        {supplierName && (
                            <div className="flex items-start gap-3">
                                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Proveedor</p>
                                    <p className="text-sm font-semibold text-foreground leading-tight">{supplierName}</p>
                                </div>
                            </div>
                        )}

                        {warehouseName && (
                            <div className="flex items-start gap-3">
                                <Box className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Bodega</p>
                                    <p className="text-sm font-semibold text-foreground leading-tight">{warehouseName}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Emisión</p>
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                    {formatPlainDate(new Date())}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Impact Info */}
                <div className={`p-4 rounded-lg border text-xs leading-relaxed ${noteType === 'NOTA_CREDITO'
                    ? 'bg-warning/10 border-warning/10 text-warning'
                    : 'bg-primary/10 border-primary/10 text-primary'
                    }`}>
                    <div className="flex items-center gap-2 mb-2 font-bold">
                        <AlertCircle className="h-4 w-4" />
                        Impacto Estimado
                    </div>
                    {noteType === 'NOTA_CREDITO' ? (
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Rebaja deuda con el proveedor</li>
                            <li>Devolución de stock (salida) si aplica</li>
                            <li>Ajuste contable automático</li>
                        </ul>
                    ) : (
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Aumenta deuda con el proveedor</li>
                            <li>Recepción de stock (entrada) si aplica</li>
                            <li>Ajuste contable automático</li>
                        </ul>
                    )}
                </div>

            </div>

            {/* Footer / Totals */}
            <div className="p-6 bg-background border-t mt-auto shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.05)]">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Neto</span>
                        <span>{formatCurrency(totals.net)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>IVA (19%)</span>
                        <span>{formatCurrency(totals.tax)}</span>
                    </div>
                </div>

                <div className="flex justify-between items-baseline pt-4 border-t">
                    <span className="text-xs font-black uppercase text-muted-foreground tracking-wider">Total</span>
                    <span className={`text-2xl font-black ${noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-primary'
                        }`}>
                        {formatCurrency(totals.total)}
                    </span>
                </div>

                {isProcessing && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-primary animate-pulse">
                        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                        Procesando documento...
                    </div>
                )}
            </div>
        </div>
    )
}
