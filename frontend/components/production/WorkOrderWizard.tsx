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
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import {
    Package,
    ArrowLeft,
    ArrowRight,
    Plus,
    Trash2,
    Upload,
    Download,
    Check,
    X,
    Ban,
    AlertTriangle,
    CheckCircle2,
    Circle,
    Printer,
    FileText,
    Layers,
    Pencil,
    User,
    Eye,
    LayoutDashboard,
    CalendarIcon
} from "lucide-react"
import { cn, formatBytes } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import dynamic from "next/dynamic"

import { useGlobalModals } from "@/components/providers/GlobalModalProvider"

const WorkOrderForm = dynamic(() => import("@/components/forms/WorkOrderForm").then(mod => mod.WorkOrderForm), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Formulario...</div>
})

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.zip', '.rar']

// Validation function
const validateFile = (file: File): { valid: boolean; error?: string } => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `El archivo "${file.name}" es demasiado grande. Tamaño máximo: 10 MB.`
        }
    }

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return {
            valid: false,
            error: `Extensión "${extension}" no permitida. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
        }
    }

    return { valid: true }
}

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
    const [viewingStepIndex, setViewingStepIndex] = useState(0)
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
    const [pressSupervisorApproved, setPressSupervisorApproved] = useState(false)
    const [postpressSupervisorApproved, setPostpressSupervisorApproved] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isOutsourced, setIsOutsourced] = useState(false)
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
    const [unitPrice, setUnitPrice] = useState("0")
    const [grossUnitPrice, setGrossUnitPrice] = useState("0")
    const [selectedDocumentType, setSelectedDocumentType] = useState<string>("FACTURA")
    const [showPOPreview, setShowPOPreview] = useState(false)
    const [isAnnuling, setIsAnnuling] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [outsourcedPending, setOutsourcedPending] = useState<any[]>([])
    const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const { openCommandCenter } = useGlobalModals()

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
    const actualStepIndex = STAGES.findIndex(s => s.id === order?.current_stage)
    const isViewingCurrentStage = viewingStepIndex === actualStepIndex

    const fetchOrder = async () => {
        setLoading(true)
        try {
            const response = await api.get(`/production/orders/${orderId}/`)
            setOrder(response.data)

            const filteredStages = getFilteredStages(response.data)
            const index = filteredStages.findIndex(s => s.id === response.data.current_stage)
            const resolvedIndex = index !== -1 ? index : 0
            setViewingStepIndex(resolvedIndex)

            // Sync Pre-press state from order data
            if (response.data.stage_data) {
                const sData = response.data.stage_data
                setDesignUrl(sData.design_url || "")
                setClientApproved(!!sData.design_approved)
                // supervisorApproved is usually fresh per transition, but we could sync it if stored
                if (sData.prepress) {
                    setSupervisorApproved(!!sData.prepress.supervisor_approved)
                }
            }
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

        // Validation: Press Approval
        if (order.current_stage === 'PRESS' && nextStageId !== 'PRESS') {
            const nextIndex = STAGES.findIndex(s => s.id === nextStageId)
            const currentIndex = STAGES.findIndex(s => s.id === order.current_stage)
            if (nextIndex > currentIndex) {
                if (!pressSupervisorApproved) {
                    toast.error("Debe completar la aprobación del supervisor para continuar.")
                    return
                }
            }
        }

        // Validation: Post-Press Approval
        if (order.current_stage === 'POSTPRESS' && nextStageId !== 'POSTPRESS') {
            const nextIndex = STAGES.findIndex(s => s.id === nextStageId)
            const currentIndex = STAGES.findIndex(s => s.id === order.current_stage)
            if (nextIndex > currentIndex) {
                if (!postpressSupervisorApproved) {
                    toast.error("Debe completar la aprobación del supervisor para finalizar.")
                    return
                }
            }
        }

        // PO Preview Logic
        const nextIndex = STAGES.findIndex(s => s.id === nextStageId)
        const currentIndex = STAGES.findIndex(s => s.id === order.current_stage)
        const isMovingForward = nextIndex > currentIndex

        if (order.current_stage === 'MATERIAL_APPROVAL' && isMovingForward) {
            // Validation: Check for insufficient stock items (that are not outsourced)
            const missingStock = order.materials?.filter((m: any) => !m.is_available && !m.is_outsourced) || []
            if (missingStock.length > 0) {
                toast.error(`Stock insuficiente para ${missingStock.length} componentes. Reponga stock para continuar.`)
                return
            }

            const pending = order.materials?.filter((m: any) => m.is_outsourced && !m.purchase_order_number) || []
            if (pending.length > 0 && !showPOPreview) {
                setOutsourcedPending(pending)
                setShowPOPreview(true)
                return
            }
        }

        setTransitioning(true)
        try {
            // Prepare data and files for transition
            const formData = new FormData()
            formData.append('next_stage', nextStageId)

            // If data is empty and we are moving forward, collect current stage state
            let payloadData = data
            if (Object.keys(data).length === 0 && isMovingForward) {
                if (order.current_stage === 'PREPRESS') {
                    payloadData = {
                        design_url: designUrl,
                        client_approved: clientApproved,
                        supervisor_approved: supervisorApproved
                    }
                } else if (order.current_stage === 'PRESS') {
                    payloadData = { supervisor_approved: pressSupervisorApproved }
                } else if (order.current_stage === 'POSTPRESS') {
                    payloadData = { supervisor_approved: postpressSupervisorApproved }
                }
            }
            formData.append('data', JSON.stringify(payloadData))

            // Append files if they exist (with validation)
            if (designFile) {
                const validation = validateFile(designFile)
                if (!validation.valid) {
                    toast.error(validation.error!)
                    setTransitioning(false)
                    return
                }
                formData.append('design_attachment', designFile)
            }
            if (clientApprovalFile) {
                const validation = validateFile(clientApprovalFile)
                if (!validation.valid) {
                    toast.error(validation.error!)
                    setTransitioning(false)
                    return
                }
                formData.append('approval_attachment', clientApprovalFile)
            }

            await api.post(`/production/orders/${orderId}/transition/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            toast.success("Etapa actualizada")

            // Clear files after successful transition
            setDesignFile(null)
            setClientApprovalFile(null)

            fetchOrder()
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cambiar de etapa")
        } finally {
            setTransitioning(false)
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

        if (isOutsourced && !selectedSupplierId) {
            toast.error("Seleccione un proveedor para el servicio tercerizado")
            return
        }

        if (isOutsourced && (!selectedDocumentType)) {
            toast.error("Seleccione el tipo de documento (Factura o Boleta)")
            return
        }

        if (isOutsourced && parseFloat(grossUnitPrice) <= 0) {
            toast.error("Debe ingresar un monto bruto mayor a 0 para servicios tercerizados.")
            return
        }

        setAddingMaterial(true)
        try {
            if (editingMaterialId) {
                // Update existing
                await api.post(`/production/orders/${orderId}/update_material/`, {
                    material_id: editingMaterialId,
                    quantity: newMaterialQty,
                    uom_id: newMaterialUoM,
                    is_outsourced: isOutsourced,
                    supplier_id: selectedSupplierId,
                    unit_price: unitPrice,
                    document_type: selectedDocumentType
                })
                toast.success("Material actualizado")
            } else {
                // Add new
                await api.post(`/production/orders/${orderId}/add_material/`, {
                    product_id: newMaterialProduct,
                    quantity: newMaterialQty,
                    uom_id: newMaterialUoM,
                    is_outsourced: isOutsourced,
                    supplier_id: selectedSupplierId,
                    unit_price: unitPrice,
                    document_type: selectedDocumentType
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
        setIsOutsourced(false)
        setSelectedSupplierId(null)
        setUnitPrice("0")
        setGrossUnitPrice("0")
        setSelectedDocumentType("FACTURA")
    }

    const handleEditMaterial = (material: any) => {
        setEditingMaterialId(material.id)
        setNewMaterialProduct(material.component.toString()) // Assuming component is ID
        setNewMaterialQty(material.quantity_planned)
        setNewMaterialUoM(material.uom.toString())
        setIsOutsourced(material.is_outsourced)
        setSelectedSupplierId(material.supplier?.toString() || null)
        setUnitPrice(material.unit_price?.toString() || "0")
        setGrossUnitPrice(material.unit_price ? (parseFloat(material.unit_price) * 1.19).toFixed(2) : "0")
        setSelectedDocumentType(material.document_type || "FACTURA")

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

    const handleAnnulOrder = async (isConfirmed = false) => {
        if (!isConfirmed) {
            setIsAnnulModalOpen(true)
            return
        }

        setIsAnnuling(true)
        try {
            await api.post(`/production/orders/${orderId}/annul/`)
            toast.success("Orden de Trabajo anulada exitosamente")
            setIsAnnulModalOpen(false)
            fetchOrder()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al anular la orden")
        } finally {
            setIsAnnuling(false)
        }
    }

    const handleDeleteOrder = async (isConfirmed = false) => {
        if (!isConfirmed) {
            setIsDeleteModalOpen(true)
            return
        }

        setIsDeleting(true)
        try {
            await api.delete(`/production/orders/${orderId}/`)
            toast.success("Orden de Trabajo eliminada")
            setIsDeleteModalOpen(false)
            onOpenChange(false) // Close wizard
            if (onSuccess) onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al eliminar la orden")
        } finally {
            setIsDeleting(false)
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
                        <DialogTitle className="text-2xl flex items-center gap-3">
                            Gestión de Orden de Trabajo OT-{order?.number}
                            {order?.outsourcing_status === 'partial' && (
                                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    Parcialmente Tercerizado
                                </Badge>
                            )}
                            {order?.outsourcing_status === 'full' && (
                                <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                                    Totalmente Tercerizado
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-4 mt-1">
                            <span className="text-muted-foreground truncate">
                                {order?.description}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                Cliente: {order?.sale_order_client_name || order?.sale_customer_name || 'Manual'}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="flex items-center gap-1.5 text-primary font-medium">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {order?.start_date ?
                                    new Date(order.start_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) :
                                    "Sin fecha de inicio"}
                            </span>
                        </DialogDescription>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Steps */}
                    <div className="w-56 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
                        {STAGES.map((stage, index) => {
                            const isActive = viewingStepIndex === index
                            const isPast = actualStepIndex > index
                            const isCurrent = actualStepIndex === index
                            const Icon = (isPast && !isActive) ? stage.icon : (isActive && isPast ? Eye : stage.icon)

                            return (
                                <div
                                    key={stage.id}
                                    onClick={() => {
                                        if (isPast || isCurrent) {
                                            setViewingStepIndex(index)
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group relative",
                                        isCurrent && !isActive && "border-2 border-primary/20",
                                        isActive ? "bg-primary text-primary-foreground shadow-sm" :
                                            isPast ? "text-green-600 bg-green-50 hover:bg-green-100 cursor-pointer" : "text-muted-foreground opacity-50 cursor-not-allowed",
                                        isPast && "hover:pl-4"
                                    )}
                                >
                                    <div className="relative h-5 w-5 shrink-0">
                                        <stage.icon className={cn(
                                            "h-5 w-5 absolute inset-0 transition-opacity duration-300",
                                            isPast && !isActive ? "group-hover:opacity-0" : ""
                                        )} />
                                        {isPast && !isActive && (
                                            <Eye className="h-5 w-5 absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-primary" />
                                        )}
                                        {isActive && <Icon className="h-5 w-5" />}
                                    </div>
                                    <span className="text-sm font-medium">{stage.label}</span>
                                    {isPast && !isActive && <CheckCircle2 className="h-4 w-4 ml-auto opacity-50" />}
                                    {isCurrent && !isActive && (
                                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full" />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Center - Content Area */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto relative">
                        {!isViewingCurrentStage && (
                            <div className="absolute top-4 right-4 z-10">
                                <Badge variant="secondary" className="gap-1.5 py-1 px-3 border-primary/20 bg-primary/5 text-primary">
                                    <Eye className="h-3.5 w-3.5" />
                                    Modo Visualización (Lectura)
                                </Badge>
                            </div>
                        )}
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{STAGES[viewingStepIndex]?.label}</h3>
                            <Badge variant="outline">{order?.status}</Badge>
                        </div>

                        {/* Stage Content */}
                        <div className={cn("flex-1 space-y-6", !isViewingCurrentStage && "pointer-events-none opacity-80 cursor-not-allowed select-none")}>
                            {STAGES[viewingStepIndex]?.id === 'MATERIAL_ASSIGNMENT' && (
                                <div className="space-y-6">
                                    {/* Consolidated Specs Section */}
                                    {(stageData.prepress_specs || stageData.press_specs || stageData.postpress_specs) && (
                                        <div className="p-4 bg-muted/5 border rounded-lg space-y-3">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Especificaciones Técnicas (Referencia)</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {stageData.prepress_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Pre-Impresión</p>
                                                        <p className="text-xs italic">{stageData.prepress_specs}</p>
                                                    </div>
                                                )}
                                                {stageData.press_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Impresión</p>
                                                        <p className="text-xs italic">{stageData.press_specs}</p>
                                                    </div>
                                                )}
                                                {stageData.postpress_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Post-Impresión</p>
                                                        <p className="text-xs italic">{stageData.postpress_specs}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">Revise y asigne los materiales necesarios para esta pieza gráfica.</p>
                                        <div className="border rounded-md overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/50">
                                                    <tr>
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
                                                            <td className="p-2 flex flex-col gap-1">
                                                                <Badge variant="outline" className="text-[10px] w-fit">{m.source}</Badge>
                                                                {m.is_outsourced && (
                                                                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 w-fit">
                                                                        Tercerizado: {m.supplier_name || 'Sin prov.'}
                                                                    </Badge>
                                                                )}
                                                            </td>
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
                                                            onSelect={(p: any) => {
                                                                setSelectedProductObj(p)
                                                                // Auto-select base UoM
                                                                if (p?.uom) setNewMaterialUoM(typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString())
                                                            }}
                                                            disabled={!!editingMaterialId} // Disable product change when editing
                                                            customFilter={(p: any) => {
                                                                if (isOutsourced) {
                                                                    return p.product_type === 'SERVICE' && p.can_be_purchased;
                                                                }

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
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaterialQty(e.target.value)}
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

                                                {isOutsourced && (
                                                    <div className="flex flex-col md:flex-row gap-4 w-full pt-2 border-t mt-2">
                                                        <div className="flex-1 space-y-2">
                                                            <label className="text-xs font-bold uppercase text-primary flex items-center gap-1">
                                                                Proveedor del Servicio
                                                                <span className="text-destructive">*</span>
                                                            </label>
                                                            <AdvancedContactSelector
                                                                value={selectedSupplierId}
                                                                onChange={setSelectedSupplierId}
                                                                contactType="SUPPLIER"
                                                            />
                                                        </div>
                                                        <div className="w-full md:w-32 space-y-2">
                                                            <label className="text-xs font-bold uppercase text-primary">Precio Bruto</label>
                                                            <Input
                                                                type="number"
                                                                value={grossUnitPrice}
                                                                onChange={(e) => {
                                                                    const gross = e.target.value
                                                                    setGrossUnitPrice(gross)
                                                                    // Always calculate and store Net for the backend
                                                                    setUnitPrice(gross ? (parseFloat(gross) / 1.19).toFixed(2) : "0")
                                                                }}
                                                                className="border-primary/30 focus-visible:ring-primary"
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <label className="text-xs font-bold uppercase text-primary flex items-center gap-1">
                                                                Tipo de Documento
                                                                <span className="text-destructive">*</span>
                                                            </label>
                                                            <select
                                                                className="w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                                                value={selectedDocumentType}
                                                                onChange={(e) => setSelectedDocumentType(e.target.value)}
                                                            >
                                                                <option value="">Seleccione...</option>
                                                                <option value="FACTURA">Factura</option>
                                                                <option value="BOLETA">Boleta</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex gap-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 border-dashed"
                                                    onClick={() => {
                                                        resetMaterialForm()
                                                        setIsAddMaterialOpen(true)
                                                    }}
                                                    disabled={order?.status === 'FINISHED'}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Agregar Material
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 border-dashed text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                                                    onClick={() => {
                                                        resetMaterialForm()
                                                        setIsOutsourced(true)
                                                        setIsAddMaterialOpen(true)
                                                    }}
                                                    disabled={order?.status === 'FINISHED'}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Agregar Servicio Tercerizado
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' && (
                                <div className="space-y-6">
                                    {/* Consolidated Specs Section */}
                                    {(stageData.prepress_specs || stageData.press_specs || stageData.postpress_specs) && (
                                        <div className="p-4 bg-muted/5 border rounded-lg space-y-3">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Especificaciones Técnicas (Referencia)</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {stageData.prepress_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Pre-Impresión</p>
                                                        <p className="text-xs italic">{stageData.prepress_specs}</p>
                                                    </div>
                                                )}
                                                {stageData.press_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Impresión</p>
                                                        <p className="text-xs italic">{stageData.press_specs}</p>
                                                    </div>
                                                )}
                                                {stageData.postpress_specs && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-semibold text-primary/70">Post-Impresión</p>
                                                        <p className="text-xs italic">{stageData.postpress_specs}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                </div>
                            )}

                            {STAGES[viewingStepIndex]?.id === 'PREPRESS' && (
                                <div className="space-y-6">
                                    {/* Specifications Section */}
                                    {(stageData.prepress_specs || (order?.attachments && stageData.design_attachments && stageData.design_attachments.length > 0)) && (
                                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-3">
                                            {stageData.prepress_specs && (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-primary">Especificaciones Técnicas</Label>
                                                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 italic">{stageData.prepress_specs}</p>
                                                </div>
                                            )}

                                            {/* Design Files & Checkout Files */}
                                            <div className="space-y-4 pt-2 border-t border-primary/10">
                                                {/* 1. Checkout Files (from Sale Order) */}
                                                {order?.checkout_files && order.checkout_files.length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">
                                                            <Package className="h-3 w-3" />
                                                            Archivos del Checkout (Compra)
                                                        </Label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {order.checkout_files.map((att: any) => (
                                                                <div key={att.id} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded border border-blue-100/50 text-xs hover:border-blue-200 transition-colors">
                                                                    <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                                    <div className="flex-1 truncate font-medium text-blue-700" title={att.original_filename}>{att.original_filename}</div>
                                                                    <div className="text-[10px] text-muted-foreground shrink-0">{formatBytes(att.file_size)}</div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 hover:bg-blue-100 text-blue-700"
                                                                        onClick={() => window.open(att.file, '_blank')}
                                                                        title="Descargar"
                                                                    >
                                                                        <Download className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 2. Work Order Attachments (Design/Reference created with OT) */}
                                                {order?.attachments && order.attachments.length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5">
                                                            <Layers className="h-3 w-3" />
                                                            Archivos Adjuntos a la OT
                                                        </Label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {order.attachments
                                                                .filter((a: any) => a.original_filename !== stageData.approval_attachment)
                                                                .map((att: any) => (
                                                                    <div key={att.id} className="flex items-center gap-2 p-2 bg-white/50 rounded border border-primary/20 text-xs hover:border-primary/40 transition-colors">
                                                                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                        <div className="flex-1 truncate font-medium" title={att.original_filename}>{att.original_filename}</div>
                                                                        <div className="text-[10px] text-muted-foreground shrink-0">{formatBytes(att.file_size)}</div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 hover:bg-primary/10"
                                                                            onClick={() => window.open(att.file, '_blank')}
                                                                            title="Descargar"
                                                                        >
                                                                            <Download className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Upload New Design & Approval */}
                                    <div className="border-t pt-4">
                                        <Label className="text-sm font-semibold mb-3 block">Aprobación del Diseño</Label>
                                        <div className="space-y-3">
                                            <div className="p-4 border rounded-lg space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm">Diseño aprobado por el cliente</Label>
                                                    <Button
                                                        size="sm"
                                                        variant={clientApproved ? "default" : "outline"}
                                                        className={cn("transition-all duration-300", clientApproved && "bg-green-600 hover:bg-green-700 text-white border-green-600")}
                                                        onClick={() => setClientApproved(!clientApproved)}
                                                    >
                                                        {clientApproved ? <CheckCircle2 className="h-4 w-4 mr-2 animate-bounce" /> : <Circle className="h-4 w-4 mr-2" />}
                                                        {clientApproved ? "Aprobado" : "Aprobar"}
                                                    </Button>
                                                </div>

                                                <div className="pt-3 border-t space-y-3">
                                                    <Label className="text-xs text-muted-foreground block">Evidencia de Aprobación</Label>

                                                    {/* Historical Approvals: Check both OT attachments AND Checkout files */}
                                                    {(() => {
                                                        const allFiles = [...(order?.attachments || []), ...(order?.checkout_files || [])]
                                                        const approvalFile = allFiles.find((a: any) => a.original_filename === stageData.approval_attachment)

                                                        if (approvalFile) {
                                                            return (
                                                                <div className="space-y-1">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Evidencia Actual:</p>
                                                                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100 text-xs">
                                                                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                                                        <div className="flex-1 truncate font-medium text-green-700">{approvalFile.original_filename}</div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 hover:bg-green-100 text-green-700"
                                                                            onClick={() => window.open(approvalFile.file, '_blank')}
                                                                            title="Descargar"
                                                                        >
                                                                            <Download className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Upload Input */}
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                                    {order?.attachments?.some((a: any) => a.original_filename === stageData.approval_attachment)
                                                        ? "Subir Nueva Evidencia (Opcional):"
                                                        : "Subir Evidencia:"}
                                                </p>
                                                <div className="flex gap-2 items-center">
                                                    <Input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar"
                                                        className="h-8 text-xs cursor-pointer file:text-xs file:font-semibold"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) {
                                                                const validation = validateFile(file)
                                                                if (validation.valid) {
                                                                    setClientApprovalFile(file)
                                                                } else {
                                                                    toast.error(validation.error)
                                                                    e.target.value = ''
                                                                }
                                                            } else {
                                                                setClientApprovalFile(null)
                                                            }
                                                        }}
                                                    />
                                                    {clientApprovalFile && (
                                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 animate-in fade-in zoom-in spin-in-3">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Listo
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Puede adjuntar correos, órdenes de compra del cliente o capturas de pantalla.
                                                </p>
                                            </div>
                                        </div>

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
                            )}

                            {STAGES[viewingStepIndex]?.id === 'PRESS' && (
                                <div className="space-y-6">
                                    {/* Specifications Section */}
                                    {(stageData.press_specs || (stageData.folio_enabled && stageData.folio_start)) && (
                                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-3">
                                            {stageData.press_specs && (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-primary">Especificaciones Técnicas</Label>
                                                    <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 italic">{stageData.press_specs}</p>
                                                </div>
                                            )}
                                            {stageData.folio_enabled && (
                                                <div className="flex items-center gap-4 pt-2 border-t border-primary/10">
                                                    <div className="flex-1">
                                                        <Label className="text-[10px] font-bold uppercase text-primary">Folio Inicial</Label>
                                                        <p className="text-sm font-semibold">{stageData.folio_start}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-4 text-center py-6 border-b border-dashed">
                                        <Printer className="h-12 w-12 mx-auto text-primary opacity-20" />
                                        <div className="max-w-md mx-auto space-y-1">
                                            <p className="font-semibold text-sm">Ejecución de Impresión</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Registre que el trabajo ha pasado satisfactoriamente por la prensa.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-sm font-semibold block">Aprobación de la Impresión</Label>
                                        <div className="p-4 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm">Aprobación del Supervisor</Label>
                                                    <p className="text-[10px] text-muted-foreground">Confirmación técnica de la calidad de impresión</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={pressSupervisorApproved ? "default" : "outline"}
                                                    className={cn("transition-all duration-300 min-w-[100px]", pressSupervisorApproved && "bg-green-600 hover:bg-green-700 text-white border-green-600")}
                                                    onClick={() => setPressSupervisorApproved(!pressSupervisorApproved)}
                                                >
                                                    {pressSupervisorApproved ? <Check className="h-4 w-4 mr-2" /> : <Circle className="h-4 w-4 mr-2" />}
                                                    {pressSupervisorApproved ? "Aprobado" : "Aprobar"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {STAGES[viewingStepIndex]?.id === 'POSTPRESS' && (
                                <div className="space-y-6">
                                    {/* Specifications Section */}
                                    {stageData.postpress_specs && (
                                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                                            <Label className="text-[10px] font-bold uppercase text-primary">Especificaciones Técnicas</Label>
                                            <p className="text-sm border-l-2 border-primary/20 pl-3 py-1 italic">{stageData.postpress_specs}</p>
                                        </div>
                                    )}

                                    <div className="space-y-4 text-center py-6 border-b border-dashed">
                                        <Layers className="h-12 w-12 mx-auto text-primary opacity-20" />
                                        <div className="max-w-md mx-auto space-y-1">
                                            <p className="font-semibold text-sm">Acabados y Post-Impresión</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Verificación final de acabados, cortes y empaque.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-sm font-semibold block">Aprobación de Post-Impresión</Label>
                                        <div className="p-4 border rounded-lg bg-background shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm">Aprobación del Supervisor</Label>
                                                    <p className="text-[10px] text-muted-foreground">Visto bueno final antes de entrega</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={postpressSupervisorApproved ? "default" : "outline"}
                                                    className={cn("transition-all duration-300 min-w-[100px]", postpressSupervisorApproved && "bg-green-600 hover:bg-green-700 text-white border-green-600")}
                                                    onClick={() => setPostpressSupervisorApproved(!postpressSupervisorApproved)}
                                                >
                                                    {postpressSupervisorApproved ? <Check className="h-4 w-4 mr-2" /> : <Circle className="h-4 w-4 mr-2" />}
                                                    {postpressSupervisorApproved ? "Aprobado" : "Aprobar"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {STAGES[viewingStepIndex]?.id === 'FINISHED' && (
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
                            {!isViewingCurrentStage ? (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-primary/20 hover:bg-primary/5"
                                    onClick={() => setViewingStepIndex(actualStepIndex)}
                                >
                                    <LayoutDashboard className="h-4 w-4" />
                                    Volver a la Etapa Actual
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        disabled={viewingStepIndex === 0 || transitioning || order?.status === 'FINISHED'}
                                        onClick={() => {
                                            const prevStage = STAGES[viewingStepIndex - 1]
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
                                                (STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' && order?.materials?.some((m: any) => !m.is_available))
                                            }
                                            onClick={() => {
                                                const nextStage = STAGES[viewingStepIndex + 1]
                                                if (nextStage) {
                                                    if (nextStage.id === 'FINISHED') {
                                                        if (confirm("¿Estás seguro de finalizar la producción? Una vez finalizada la OT, no se puede modificar y el producto se encuentra disponible para despacho de inmediato.")) {
                                                            handleTransition(nextStage.id)
                                                        }
                                                    } else {
                                                        handleTransition(nextStage.id)
                                                    }
                                                }
                                            }}
                                        >
                                            {transitioning ? "Procesando..." : viewingStepIndex === STAGES.length - 2 ? "Finalizar Producción" : "Siguiente Etapa"}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Sidebar - Information */}
                    <div className="w-80 border-l bg-muted/5 p-4 space-y-4 overflow-y-auto hidden lg:block">
                        {/* Acciones Section */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground">Acciones</h4>
                            <div className="flex items-center gap-2 p-1">
                                {['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 h-9"
                                        onClick={() => setIsEditOpen(true)}
                                        title="Editar OT"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2 h-9"
                                    onClick={() => order?.sale_order && openCommandCenter(order.sale_order, 'sale')}
                                >
                                    <LayoutDashboard className="h-4 w-4" />

                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2 h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleAnnulOrder()}
                                    disabled={isAnnuling || order?.status === 'CANCELLED' || order?.is_cancellable === false}
                                    title={order?.is_cancellable === false ? "Anulación no permitida en esta etapa" : "Anular OT"}
                                >
                                    <Ban className="h-4 w-4" />
                                </Button>
                                {['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-2 h-9 text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteOrder()}
                                        disabled={isDeleting}
                                        title="Eliminar OT"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground">Información del Trabajo</h4>
                            <div className="bg-background rounded-lg border divide-y overflow-hidden">
                                {/* Section 1: Product */}
                                <div className="p-3 space-y-1">
                                    <p className="text-sm font-medium leading-tight">{productName}</p>
                                    {order?.product_description && (
                                        <p className="text-xs text-muted-foreground italic line-clamp-2">{order.product_description}</p>
                                    )}
                                </div>

                                {/* Section 2: Start Date */}
                                {order?.start_date && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">Fecha de Inicio</p>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                            <p className="text-sm font-medium">{new Date(order.start_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Section 3: Delivery Date */}
                                {order?.sale_order_delivery_date && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">Fecha de Entrega</p>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                            <p className="text-sm font-medium">{new Date(order.sale_order_delivery_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Section 3: Contact / Reference */}
                                {(stageData.contact_name || order?.sale_customer_name) && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">
                                            {stageData.contact_name ? 'Contacto / Referencia' : 'Cliente Relacionado'}
                                        </p>
                                        <div className="flex items-start gap-3 pt-0.5">
                                            <div className="bg-muted p-1.5 rounded-full mt-0.5">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-semibold truncate leading-tight">
                                                    {stageData.contact_name || order.sale_customer_name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {stageData.contact_tax_id || order.sale_customer_rut}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section 5: Folio */}
                                {stageData.folio_enabled && stageData.folio_start && (
                                    <div className="p-3 space-y-1">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground">Folio Inicial</p>
                                        <p className="text-sm font-semibold text-primary">{stageData.folio_start}</p>
                                    </div>
                                )}

                                {stageData.product_description && stageData.product_description !== order?.product_description && (
                                    <div className="p-3 bg-muted/5">
                                        <p className="font-bold text-[10px] uppercase text-muted-foreground mb-1">Especificación de Etapa</p>
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
                    </div>
                </div>
            </DialogContent >
            {/* Modals for Edit and Command Center */}
            {
                isEditOpen && order && (
                    <WorkOrderForm
                        open={isEditOpen}
                        onOpenChange={setIsEditOpen}
                        initialData={order}
                        onSuccess={() => {
                            setIsEditOpen(false)
                            fetchOrder()
                        }}
                    />
                )
            }

            {/* PO Preview Modal */}
            <Dialog open={showPOPreview} onOpenChange={setShowPOPreview}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Vista Previa de Órdenes de Compra
                        </DialogTitle>
                        <DialogDescription>
                            Se generarán las siguientes Órdenes de Compra en borrador para los servicios tercerizados asignados.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Proveedor</th>
                                        <th className="p-2 text-left">Servicio</th>
                                        <th className="p-2 text-right">Cant.</th>
                                        <th className="p-2 text-right">Precio Un.</th>
                                        <th className="p-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {outsourcedPending.map((m, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2 font-medium">{m.supplier_name}</td>
                                            <td className="p-2">{m.component_name}</td>
                                            <td className="p-2 text-right">{m.quantity_planned}</td>
                                            <td className="p-2 text-right">{formatCurrency(m.unit_price)}</td>
                                            <td className="p-2 text-right font-bold">{formatCurrency((m.quantity_planned * m.unit_price))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg flex gap-3 border border-blue-100">
                            <div className="bg-blue-100 p-2 rounded-full h-fit">
                                <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="text-xs text-blue-700 leading-relaxed">
                                <p className="font-bold mb-1">Nota importante:</p>
                                <p>Las órdenes de compra se crearán en estado <span className="font-bold">Borrador</span>. Deberá confirmarlas manualmente desde el módulo de Compras para procesar el pago y la recepción.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowPOPreview(false)}>
                            Cancelar y Revisar
                        </Button>
                        <Button onClick={() => {
                            setShowPOPreview(false)
                            // Call handleTransition again but skip preview
                            const nextStage = STAGES[actualStepIndex + 1]?.id
                            if (nextStage) {
                                handleTransition(nextStage)
                            }
                        }}>
                            Confirmar y Generar OC
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ActionConfirmModal
                open={isAnnulModalOpen}
                onOpenChange={setIsAnnulModalOpen}
                title="Anular Orden de Trabajo"
                variant="warning"
                onConfirm={() => handleAnnulOrder(true)}
                confirmText="Anular OT"
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea <strong>ANULAR</strong> la Orden de Trabajo OT-{order?.number}?
                        </p>
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs flex gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <div className="space-y-1">
                                <p className="font-bold">Acción con impacto financiero:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Se revertirán los movimientos de stock realizados.</li>
                                    <li>Se anularán los documentos internos vinculados.</li>
                                    <li>La OT quedará en estado ANULADA y no podrá procesarse más.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                }
            />

            <ActionConfirmModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                title="Borrar Orden de Trabajo"
                variant="destructive"
                onConfirm={() => handleDeleteOrder(true)}
                confirmText="Eliminar permanentemente"
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea <strong>ELIMINAR</strong> permanentemente la Orden de Trabajo OT-{order?.number}?
                        </p>
                        <p className="text-destructive font-semibold bg-destructive/10 p-2 rounded text-xs">
                            Esta acción es irreversible y borrará todos los registros históricos de esta orden.
                        </p>
                    </div>
                }
            />
        </Dialog >
    )
}
