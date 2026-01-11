"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import {
    CheckCircle2,
    Circle,
    Printer,
    FileText,
    Layers,
    History,
    Package,
    ArrowLeft,
    ArrowRight,
    Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Input } from "@/components/ui/input"

interface WorkOrderWizardProps {
    orderId: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

const STAGES = [
    { id: 'MATERIAL_ASSIGNMENT', label: 'Asignación de Materiales', icon: Package },
    { id: 'MATERIAL_APPROVAL', label: 'Aprobación de Stock', icon: CheckCircle2 },
    { id: 'PREPRESS', label: 'Pre-Impresión', icon: FileText },
    { id: 'PRESS', label: 'Impresión', icon: Printer },
    { id: 'POSTPRESS', label: 'Post-Impresión', icon: Layers },
    { id: 'FINISHED', label: 'Finalizada', icon: CheckCircle2 },
]

export function WorkOrderWizard({ orderId, open, onOpenChange, onSuccess }: WorkOrderWizardProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false)
    const [newMaterialProduct, setNewMaterialProduct] = useState<string | null>(null)
    const [newMaterialQty, setNewMaterialQty] = useState("1")
    const [addingMaterial, setAddingMaterial] = useState(false)

    const fetchOrder = async () => {
        setLoading(true)
        try {
            const response = await api.get(`/production/orders/${orderId}/`)
            setOrder(response.data)

            // Find current stage index
            const index = STAGES.findIndex(s => s.id === response.data.current_stage)
            setCurrentStep(index !== -1 ? index : 0)
        } catch (error) {
            console.error("Error fetching order details:", error)
            toast.error("No se pudo cargar la información de la OT")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && orderId) {
            fetchOrder()
        }
    }, [open, orderId])

    const handleTransition = async (nextStageId: string, data: any = {}) => {
        setTransitioning(true)
        try {
            await api.post(`/production/orders/${orderId}/transition/`, {
                next_stage: nextStageId,
                data: data
            })
            toast.success("Etapa actualizada")
            fetchOrder()
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cambiar de etapa")
        } finally {
            setTransitioning(false)
        }
    }

    const handlePrint = async () => {
        try {
            const response = await api.get(`/production/orders/${orderId}/print_pdf/`, {
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `OT-${order.number}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            toast.error("Error al generar el PDF")
        }
    }

    const handleAddMaterial = async () => {
        if (!newMaterialProduct) {
            toast.error("Seleccione un producto")
            return
        }
        if (parseFloat(newMaterialQty) <= 0) {
            toast.error("Ingrese una cantidad válida")
            return
        }

        setAddingMaterial(true)
        try {
            await api.post(`/production/orders/${orderId}/add_material/`, {
                product_id: newMaterialProduct,
                quantity: newMaterialQty
            })
            toast.success("Material agregado")
            setIsAddMaterialOpen(false)
            setNewMaterialProduct(null)
            setNewMaterialQty("1")
            fetchOrder()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al agregar material")
        } finally {
            setAddingMaterial(false)
        }
    }

    if (!order && loading) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col p-0">
                <div className="p-6 border-b flex justify-between items-center bg-muted/30">
                    <div>
                        <DialogTitle className="text-2xl">Gestión de Orden de Trabajo OT-{order?.number}</DialogTitle>
                        <DialogDescription>
                            {order?.description} | Cliente: {order?.sale_customer_name || 'Manual'}
                        </DialogDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir OT
                    </Button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Steps */}
                    <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block">
                        {STAGES.map((stage, index) => {
                            const Icon = stage.icon
                            const isActive = currentStep === index
                            const isPast = currentStep > index

                            // Check if stage is applicable (stub for now, should use backend metadata)
                            const isApplicable = true

                            return (
                                <div
                                    key={stage.id}
                                    className={cn(
                                        "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                                        isActive ? "bg-primary text-primary-foreground shadow-sm" :
                                            isPast ? "text-green-600 bg-green-50" : "text-muted-foreground"
                                    )}
                                >
                                    <Icon className="h-5 w-5 shrink-0" />
                                    <span className="text-sm font-medium">{stage.label}</span>
                                    {isPast && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                                </div>
                            )
                        })}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{STAGES[currentStep]?.label}</h3>
                            <Badge variant="outline">{order?.status}</Badge>
                        </div>

                        {/* Stage Content */}
                        <div className="flex-1 space-y-6">
                            {order?.current_stage === 'MATERIAL_ASSIGNMENT' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">Revise y asigne los materiales necesarios para esta pieza gráfica.</p>
                                    <div className="border rounded-md overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="p-2 text-left">Componente</th>
                                                    <th className="p-2 text-right">Cant. Planificada</th>
                                                    <th className="p-2 text-left">UoM</th>
                                                    <th className="p-2 text-left">Origen</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order?.materials?.map((m: any) => (
                                                    <tr key={m.id} className="border-t">
                                                        <td className="p-2">{m.component_name} <span className="text-xs text-muted-foreground">({m.component_code})</span></td>
                                                        <td className="p-2 text-right font-medium">{m.quantity_planned}</td>
                                                        <td className="p-2">{m.uom_name}</td>
                                                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{m.source}</Badge></td>
                                                    </tr>
                                                ))}
                                                {(!order?.materials || order.materials.length === 0) && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4 text-center text-muted-foreground italic">No hay materiales asignados.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {isAddMaterialOpen ? (
                                        <div className="p-4 border rounded-md bg-muted/20 space-y-4">
                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                                <div className="flex-1 space-y-2">
                                                    <label className="text-xs font-bold uppercase">Producto / Componente</label>
                                                    <ProductSelector
                                                        value={newMaterialProduct}
                                                        onChange={setNewMaterialProduct}
                                                    />
                                                </div>
                                                <div className="w-full md:w-32 space-y-2">
                                                    <label className="text-xs font-bold uppercase">Cantidad</label>
                                                    <Input
                                                        type="number"
                                                        value={newMaterialQty}
                                                        onChange={(e) => setNewMaterialQty(e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setIsAddMaterialOpen(false)}>Cancelar</Button>
                                                    <Button size="sm" onClick={handleAddMaterial} disabled={addingMaterial}>
                                                        {addingMaterial ? "Añadiendo..." : "Añadir"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-dashed"
                                            onClick={() => setIsAddMaterialOpen(true)}
                                            disabled={order?.status === 'FINISHED'}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Agregar Material Manualmente
                                        </Button>
                                    )}
                                </div>
                            )}

                            {order?.current_stage === 'MATERIAL_APPROVAL' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">Verifique la disponibilidad de stock en {order?.warehouse_name || 'la bodega seleccionada'}.</p>
                                    <div className="grid gap-4">
                                        {/* Simplified stock check view */}
                                        {order?.materials?.map((m: any) => (
                                            <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{m.component_name}</p>
                                                    <p className="text-xs text-muted-foreground">Requerido: {m.quantity_planned} {m.uom_name}</p>
                                                </div>
                                                <Badge variant="default" className="bg-green-500">Disponible</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'PREPRESS' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-sm">
                                        Captura de especificaciones técnicas y archivos de diseño.
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground">Folio Inicial</label>
                                            <input type="number" className="w-full p-2 border rounded-md" placeholder="0" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase text-muted-foreground">Folio Final</label>
                                            <input type="number" className="w-full p-2 border rounded-md" placeholder="0" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground">Observaciones de Diseño</label>
                                        <textarea className="w-full p-2 border rounded-md h-24" placeholder="Instrucciones adicionales..."></textarea>
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'PRESS' && (
                                <div className="space-y-4 text-center py-10">
                                    <Printer className="h-16 w-16 mx-auto text-primary opacity-20" />
                                    <div className="max-w-md mx-auto space-y-2">
                                        <p className="font-semibold">Confirmación de Impresión</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Al pasar a la siguiente etapa, se confirma que el trabajo ha pasado por la prensa y se están generando las pliegos/hojas base.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'POSTPRESS' && (
                                <div className="space-y-4">
                                    <p className="font-semibold text-sm">Validación de Acabados</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['Laminado', 'Troquelado', 'Encuadernación', 'Barniz UV'].map(item => (
                                            <div key={item} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/30 cursor-pointer transition-colors">
                                                <Circle className="h-4 w-4" />
                                                <span className="text-sm">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'FINISHED' && (
                                <div className="space-y-4 text-center py-10">
                                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                                    <div className="max-w-md mx-auto space-y-2">
                                        <p className="font-semibold">Producción Finalizada</p>
                                        <p className="text-sm text-muted-foreground">
                                            Se han registrado los consumos de material y se ha sumado el stock del producto terminado (si aplica).
                                        </p>
                                    </div>
                                    <div className="pt-4">
                                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar Gestión</Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Progress Buttons */}
                        <div className="mt-8 pt-6 border-t flex justify-between">
                            <Button
                                variant="ghost"
                                disabled={currentStep === 0 || transitioning || order?.status === 'FINISHED'}
                                onClick={() => {
                                    const prevStage = STAGES[currentStep - 1]
                                    handleTransition(prevStage.id)
                                }}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Anterior
                            </Button>

                            {order?.status !== 'FINISHED' && (
                                <Button
                                    disabled={transitioning}
                                    onClick={() => {
                                        const nextStage = STAGES[currentStep + 1]
                                        if (nextStage) {
                                            handleTransition(nextStage.id)
                                        }
                                    }}
                                >
                                    {transitioning ? "Procesando..." : currentStep === STAGES.length - 2 ? "Finalizar Producción" : "Siguiente Etapa"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
