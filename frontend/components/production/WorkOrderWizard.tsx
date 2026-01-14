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
    Package,
    ArrowLeft,
    ArrowRight,
    Plus,
    Trash2,
    Upload,
    Download,
    Check,
    X,
    Pencil,
    User
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/currency"

interface WorkOrderWizardProps {
    orderId: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    targetStage?: string // New prop
}

const BASE_STAGES = [
    { id: 'MATERIAL_ASSIGNMENT', label: 'Asignación de Materiales', icon: Package, alwaysShow: true },
    { id: 'MATERIAL_APPROVAL', label: 'Aprobación de Stock', icon: CheckCircle2, alwaysShow: true },
    { id: 'PREPRESS', label: 'Pre-Impresión', icon: FileText, alwaysShow: false },
    { id: 'PRESS', label: 'Impresión', icon: Printer, alwaysShow: false },
    { id: 'POSTPRESS', label: 'Post-Impresión', icon: Layers, alwaysShow: false },
    { id: 'FINISHED', label: 'Finalizada', icon: CheckCircle2, alwaysShow: true },
]

export function WorkOrderWizard({ orderId, open, onOpenChange, onSuccess, targetStage }: WorkOrderWizardProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transitioning, setTransitioning] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false)
    const [newMaterialProduct, setNewMaterialProduct] = useState<string | null>(null)
    const [newMaterialQty, setNewMaterialQty] = useState("1")
    const [newMaterialUoM, setNewMaterialUoM] = useState<string>("")
    const [selectedProductObj, setSelectedProductObj] = useState<any>(null)
    const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null)
    const [uoms, setUoMs] = useState<any[]>([]) // Store all UoMs
    const [addingMaterial, setAddingMaterial] = useState(false)
    const [designUrl, setDesignUrl] = useState("")
    const [designFile, setDesignFile] = useState<File | null>(null)
    const [clientApprovalFile, setClientApprovalFile] = useState<File | null>(null)
    const [clientApproved, setClientApproved] = useState(false)
    const [supervisorApproved, setSupervisorApproved] = useState(false)

    const fetchOrder = async () => {
        setLoading(true)
        try {
            const response = await api.get(`/production/orders/${orderId}/`)
            setOrder(response.data)

            // Calculate steps
            const filteredStages = getFilteredStages(response.data)

            // If targetStage provided, try to find its index to set as current step?
            // Actually, we usually want to show the CURRENT stage of the order, 
            // but if the user dragged to a FUTURE stage, we want to allow them to confirm transition TO that stage.
            // But WorkOrderWizard logic assumes we are AT current_stage.
            // If we are transitioning, we are basically previewing the "Next" action.

            // For now, let's stick to showing current stage, but maybe alert user or auto-advance if logical.
            // The simplest "Kanban drop -> Modal" flow is just opening the modal to manage the current state, 
            // and the user manually clicks "Next Stage" (which matches the drag intent).
            // BUT user wants to understand which stages can be selected.

            const index = filteredStages.findIndex(s => s.id === response.data.current_stage)
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

    const getFilteredStages = (orderData: any) => {
        if (!orderData) return BASE_STAGES.filter(s => s.alwaysShow)

        return BASE_STAGES.filter(stage => {
            if (stage.alwaysShow) return true
            if (stage.id === 'PREPRESS') return orderData.requires_prepress
            if (stage.id === 'PRESS') return orderData.requires_press
            if (stage.id === 'POSTPRESS') return orderData.requires_postpress
            return false
        })
    }

    const STAGES = getFilteredStages(order)

    const handleTransition = async (nextStageId: string, data: any = {}) => {
        // Validation: Materials
        if (order.current_stage === 'MATERIAL_ASSIGNMENT' && (!order.materials || order.materials.length === 0)) {
            toast.error("Debe asignar al menos un componente antes de continuar.")
            return
        }

        // Validation: Approvals (Prepress)
        if (order.current_stage === 'PREPRESS' && nextStageId !== 'PREPRESS') {
            // Only enforced when moving forward (not backward)
            const nextIndex = STAGES.findIndex(s => s.id === nextStageId)
            const currentIndex = STAGES.findIndex(s => s.id === order.current_stage)
            if (nextIndex > currentIndex) {
                if (!clientApproved || !supervisorApproved) {
                    toast.error("Debe completar todas las aprobaciones requeridas.")
                    return
                }
            }
        }

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

    useEffect(() => {
        // Fetch UoMs
        api.get('/inventory/uoms/').then(res => {
            setUoMs(res.data.results || res.data)
        })
    }, [])

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
            if (editingMaterialId) {
                // Update existing
                await api.post(`/production/orders/${orderId}/update_material/`, {
                    material_id: editingMaterialId,
                    quantity: newMaterialQty,
                    uom_id: newMaterialUoM
                })
                toast.success("Material actualizado")
            } else {
                // Add new
                await api.post(`/production/orders/${orderId}/add_material/`, {
                    product_id: newMaterialProduct,
                    quantity: newMaterialQty,
                    uom_id: newMaterialUoM
                })
                toast.success("Material agregado")
            }

            setIsAddMaterialOpen(false)
            resetMaterialForm()
            fetchOrder()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al guardar material")
        } finally {
            setAddingMaterial(false)
        }
    }

    const resetMaterialForm = () => {
        setNewMaterialProduct(null)
        setNewMaterialQty("1")
        setNewMaterialUoM("")
        setSelectedProductObj(null)
        setEditingMaterialId(null)
    }

    const handleEditMaterial = (material: any) => {
        setEditingMaterialId(material.id)
        setNewMaterialProduct(material.component.toString()) // Assuming component is ID
        // Note: material.component might be an object or ID depending on serializer.
        // WorkOrderMaterialSerializer: component_name, component_code. But 'component' field?
        // Let's check serializer: fields = '__all__', so 'component' is ID.
        setNewMaterialQty(material.quantity_planned)
        setNewMaterialUoM(material.uom.toString())

        // We need the product object for UoM selector. 
        // We might need to fetch it or finding it if we have it. 
        // Ideally we should fetch the product details to get allowed UoMs.
        api.get(`/inventory/products/${material.component}/`).then(res => {
            setSelectedProductObj(res.data)
            setIsAddMaterialOpen(true)
        })
    }

    const handleDeleteMaterial = async (materialId: number) => {
        try {
            await api.post(`/production/orders/${orderId}/remove_material/`, {
                material_id: materialId
            })
            toast.success("Material eliminado")
            fetchOrder()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al eliminar material")
        }
    }

    if (!order && loading) return null

    const stageData = order?.stage_data || {}
    const productName = order?.product_name || order?.sale_line?.product?.name || "Producto"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1400px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
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
                    {/* Left Sidebar - Steps */}
                    <div className="w-56 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
                        {STAGES.map((stage, index) => {
                            const Icon = stage.icon
                            const isActive = currentStep === index
                            const isPast = currentStep > index

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

                    {/* Center - Content Area */}
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
                                                    <th className="p-2 text-right">Costo Unit.</th>
                                                    <th className="p-2 text-right">Costo Total</th>
                                                    <th className="p-2 text-left">Origen</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order?.materials?.map((m: any) => (
                                                    <tr key={m.id} className="border-t">
                                                        <td className="p-2">{m.component_name} <span className="text-xs text-muted-foreground">({m.component_code})</span></td>
                                                        <td className="p-2 text-right font-medium">{m.quantity_planned}</td>
                                                        <td className="p-2">{m.uom_name}</td>
                                                        <td className="p-2 text-right text-muted-foreground">{formatCurrency(m.component_cost)}</td>
                                                        <td className="p-2 text-right font-bold">{formatCurrency(m.total_cost)}</td>
                                                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{m.source}</Badge></td>
                                                        <td className="p-2">
                                                            {m.source === 'MANUAL' && (
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-primary"
                                                                        onClick={() => handleEditMaterial(m)}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-destructive"
                                                                        onClick={() => handleDeleteMaterial(m.id)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!order?.materials || order.materials.length === 0) && (
                                                    <tr>
                                                        <td colSpan={7} className="p-4 text-center text-muted-foreground italic">No hay materiales asignados.</td>
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
                                                        onSelect={(p) => {
                                                            setSelectedProductObj(p)
                                                            // Auto-select base UoM
                                                            if (p?.uom) setNewMaterialUoM(typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString())
                                                        }}
                                                        disabled={!!editingMaterialId} // Disable product change when editing
                                                        customFilter={(p: any) => {
                                                            // 1. Exclude the product being manufactured
                                                            if (order?.main_product_id && p.id.toString() === order.main_product_id.toString()) return false;

                                                            // 2. Exclude Consumable products
                                                            if (p.product_type === 'CONSUMABLE') return false;

                                                            // 3. Exclude Simple Manufacturable products
                                                            if (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing) return false;

                                                            // 4. Exclude Advanced Manufacturable WITHOUT stock control
                                                            if (p.requires_advanced_manufacturing && !p.track_inventory) return false;

                                                            return true;
                                                        }}
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
                                                <div className="w-full md:w-40 space-y-2">
                                                    <label className="text-xs font-bold uppercase">Unidad</label>
                                                    <UoMSelector
                                                        product={selectedProductObj}
                                                        context="bom" // Flexible category selection
                                                        value={newMaterialUoM}
                                                        onChange={setNewMaterialUoM}
                                                        uoms={uoms}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => {
                                                        setIsAddMaterialOpen(false)
                                                        resetMaterialForm()
                                                    }}>Cancelar</Button>
                                                    <Button size="sm" onClick={handleAddMaterial} disabled={addingMaterial}>
                                                        {addingMaterial ? (editingMaterialId ? "Guardando..." : "Añadiendo...") : (editingMaterialId ? "Guardar" : "Añadir")}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-dashed"
                                            onClick={() => {
                                                resetMaterialForm()
                                                setIsAddMaterialOpen(true)
                                            }}
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
                                        {order?.materials?.map((m: any) => (
                                            <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{m.component_name} <span className="text-xs text-muted-foreground">({m.component_code})</span></p>
                                                    <p className="text-xs text-muted-foreground">Requerido: {m.quantity_planned} {m.uom_name}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right mr-2">
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">En Bodega</p>
                                                        <p className={cn("text-sm font-bold", m.is_available ? "text-green-600" : "text-destructive")}>
                                                            {m.stock_available >= 999999 ? "∞" : m.stock_available} {m.uom_name}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant={m.is_available ? "default" : "destructive"}
                                                        className={cn(m.is_available ? "bg-green-500 hover:bg-green-600" : "")}
                                                    >
                                                        {m.is_available ? "Disponible" : "Sin Stock"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'PREPRESS' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-sm font-semibold">Diseño</Label>
                                            <div className="mt-2 space-y-3">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">URL del Diseño</Label>
                                                    <Input
                                                        placeholder="https://..."
                                                        value={designUrl}
                                                        onChange={(e) => setDesignUrl(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">O cargar archivo</Label>
                                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                                                        <Upload className="h-4 w-4" />
                                                        <span className="text-sm">{designFile ? designFile.name : "Seleccionar archivo"}</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={(e) => setDesignFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t pt-4">
                                            <Label className="text-sm font-semibold mb-3 block">Aprobación del Diseño</Label>
                                            <div className="space-y-3">
                                                <div className="p-4 border rounded-lg space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm">Aprobación del Cliente</Label>
                                                        <Button
                                                            size="sm"
                                                            variant={clientApproved ? "default" : "outline"}
                                                            className={cn("transition-all duration-300", clientApproved && "bg-green-600 hover:bg-green-700 text-white border-green-600")}
                                                            onClick={() => setClientApproved(!clientApproved)}
                                                        >
                                                            {clientApproved ? <Check className="h-4 w-4 mr-2 animate-bounce" /> : <Circle className="h-4 w-4 mr-2" />}
                                                            {clientApproved ? "Aprobado" : "Aprobar"}
                                                        </Button>
                                                    </div>
                                                    {clientApproved && (
                                                        <div className="space-y-2 animate-in fade-in">
                                                            <Label className="text-xs text-muted-foreground">Adjunto de aprobación (opcional)</Label>
                                                            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                                                                <Upload className="h-3 w-3" />
                                                                <span className="text-xs">{clientApprovalFile ? clientApprovalFile.name : "Cargar evidencia"}</span>
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) => setClientApprovalFile(e.target.files?.[0] || null)}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-4 border rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm">Aprobación del Supervisor</Label>
                                                        <Button
                                                            size="sm"
                                                            variant={supervisorApproved ? "default" : "outline"}
                                                            className={cn("transition-all duration-300", supervisorApproved && "bg-green-600 hover:bg-green-700 text-white border-green-600")}
                                                            onClick={() => setSupervisorApproved(!supervisorApproved)}
                                                        >
                                                            {supervisorApproved ? <Check className="h-4 w-4 mr-2 animate-bounce" /> : <Circle className="h-4 w-4 mr-2" />}
                                                            {supervisorApproved ? "Aprobado" : "Aprobar"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'PRESS' && (
                                <div className="space-y-4 text-center py-10">
                                    <Printer className="h-16 w-16 mx-auto text-primary opacity-20" />
                                    <div className="max-w-md mx-auto space-y-2">
                                        <p className="font-semibold">Confirmación de Impresión</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Al pasar a la siguiente etapa, se confirma que el trabajo ha pasado por la prensa y se están generando el producto final.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {order?.current_stage === 'POSTPRESS' && (
                                <div className="space-y-4 text-center py-10">
                                    <Layers className="h-16 w-16 mx-auto text-primary opacity-20" />
                                    <div className="max-w-md mx-auto space-y-2">
                                        <p className="font-semibold">Acabados y Post-Impresión</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Aplicar los acabados finales según las especificaciones del trabajo.
                                        </p>
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
                                    disabled={
                                        transitioning ||
                                        (order?.current_stage === 'MATERIAL_APPROVAL' && order?.materials?.some((m: any) => !m.is_available))
                                    }
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

                    {/* Right Sidebar - Information */}
                    <div className="w-80 border-l bg-muted/5 p-4 space-y-4 overflow-y-auto hidden lg:block">
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground">Información del Trabajo</h4>
                            <div className="p-3 bg-background rounded-lg border space-y-2">
                                <p className="font-semibold text-sm">{productName}</p>

                                {order?.sale_customer_name && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                                        <User className="h-3 w-3" />
                                        <div>
                                            <p className="font-medium">{order.sale_customer_name}</p>
                                            <p>{order.sale_customer_rut}</p>
                                        </div>
                                    </div>
                                )}

                                {stageData.product_description && (
                                    <div className="border-t pt-2">
                                        <p className="text-xs text-muted-foreground italic">{stageData.product_description}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {stageData.internal_notes && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Observaciones Internas</h4>
                                <div className="p-3 bg-background rounded-lg border">
                                    <p className="text-xs whitespace-pre-wrap">{stageData.internal_notes}</p>
                                </div>
                            </div>
                        )}

                        {(order?.current_stage === 'MATERIAL_ASSIGNMENT' || order?.current_stage === 'MATERIAL_APPROVAL') && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Especificaciones</h4>
                                {stageData.prepress_specs && (
                                    <div className="p-3 bg-background rounded-lg border space-y-1">
                                        <p className="text-[10px] font-semibold text-primary">Pre-Impresión</p>
                                        <p className="text-xs">{stageData.prepress_specs}</p>
                                    </div>
                                )}
                                {stageData.press_specs && (
                                    <div className="p-3 bg-background rounded-lg border space-y-1">
                                        <p className="text-[10px] font-semibold text-primary">Impresión</p>
                                        <p className="text-xs">{stageData.press_specs}</p>
                                    </div>
                                )}
                                {stageData.postpress_specs && (
                                    <div className="p-3 bg-background rounded-lg border space-y-1">
                                        <p className="text-[10px] font-semibold text-primary">Post-Impresión</p>
                                        <p className="text-xs">{stageData.postpress_specs}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {order?.current_stage === 'PREPRESS' && (
                            <div className="space-y-3">
                                {stageData.prepress_specs && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Especificaciones</h4>
                                        <div className="p-3 bg-background rounded-lg border">
                                            <p className="text-xs whitespace-pre-wrap">{stageData.prepress_specs}</p>
                                        </div>
                                    </div>
                                )}

                                {stageData.design_attachments && stageData.design_attachments.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Adjuntos de Diseño</h4>
                                        <div className="space-y-1">
                                            {stageData.design_attachments.map((file: string, index: number) => (
                                                <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border text-xs">
                                                    <FileText className="h-3 w-3" />
                                                    <span className="flex-1 truncate">{file}</span>
                                                    <Download className="h-3 w-3 cursor-pointer" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {stageData.folio_enabled && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground">Folio</h4>
                                        <div className="p-3 bg-background rounded-lg border">
                                            <p className="text-xs">Folio inicial: <span className="font-semibold">{stageData.folio_start}</span></p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(order?.current_stage === 'PRESS' || order?.current_stage === 'POSTPRESS') && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Especificaciones</h4>
                                <div className="p-3 bg-background rounded-lg border">
                                    <p className="text-xs whitespace-pre-wrap">
                                        {order?.current_stage === 'PRESS' ? stageData.press_specs : stageData.postpress_specs}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
