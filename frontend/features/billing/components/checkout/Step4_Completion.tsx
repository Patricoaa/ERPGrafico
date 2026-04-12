"use client"

import { showApiError } from "@/lib/errors"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, Wallet, ArrowRight, Printer, FileText } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPlainDate } from "@/lib/utils"

interface Step4_CompletionProps {
    workflow: any
    onSuccess: (updatedWorkflow: any) => void
}

export function Step4_Completion({
    workflow,
    onSuccess
}: Step4_CompletionProps) {
    const [loading, setLoading] = useState(false)

    const handleComplete = async () => {
        try {
            setLoading(true)
            const res = await api.post(`/billing/note-workflows/${workflow.id}/complete/`)
            onSuccess(res.data)
        } catch (error: unknown) {
            console.error("Error completing workflow:", error)
            showApiError(error, "Error al finalizar el proceso.")
        } finally {
            setLoading(false)
        }
    }

    const { invoice } = workflow

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-success/10 text-success rounded-full mb-2">
                    <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">¡Todo Listo para Finalizar!</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    La {invoice.dte_type_display} ha sido registrada con el folio <strong>#{invoice.number}</strong>.
                    Confirme para realizar los ajustes finales en la contabilidad y saldos.
                </p>
            </div>

            <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="bg-muted/10 p-6 border-b flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-primary" />
                            <span className="font-black text-xs uppercase tracking-widest">Resumen de Liquidación</span>
                        </div>
                        <Badge className="bg-primary text-primary-foreground font-black text-[10px] py-0.5">
                            {invoice.dte_type_display}
                        </Badge>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-muted-foreground font-medium">Subtotal Neto</span>
                                <span className="font-mono font-bold">${Number(invoice.total_net).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-dashed pb-3">
                                <span className="text-muted-foreground font-medium">IVA (19%)</span>
                                <span className="font-mono font-bold text-muted-foreground">${Number(invoice.total_tax).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-xs font-black uppercase tracking-widest text-primary">Total Documento</span>
                                <span className="text-3xl font-black text-primary font-mono tracking-tighter">
                                    ${Number(invoice.total).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className="bg-muted/20 p-4 rounded-lg space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground/60">Folio</p>
                                <p className="text-sm font-bold truncate">{invoice.number}</p>
                            </div>
                            <div className="bg-muted/20 p-4 rounded-lg space-y-1">
                                <p className="text-[10px] font-black uppercase text-muted-foreground/60">Fecha</p>
                                <p className="text-sm font-bold">{formatPlainDate(invoice.date)}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-3 pt-4">
                <Button
                    onClick={handleComplete}
                    disabled={loading}
                    className="group w-full py-8 rounded-lg font-black text-lg transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl hover:shadow-primary/30"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                            Finalizando...
                        </>
                    ) : (
                        <>
                            Finalizar y Emitir Nota
                            <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </Button>

                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 py-6 rounded-lg font-bold text-xs gap-2">
                        <Printer className="h-4 w-4" /> Imprimir Borrador
                    </Button>
                    <Button variant="outline" className="flex-1 py-6 rounded-lg font-bold text-xs gap-2">
                        <FileText className="h-4 w-4" /> Ver Factura Original
                    </Button>
                </div>
            </div>
        </div>
    )
}

