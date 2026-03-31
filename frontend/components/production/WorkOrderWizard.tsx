"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { BaseModal } from "@/components/shared/BaseModal"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import {
    Package, Truck,
    Plus,
    Check,
    Ban,
    Trash2,
    Upload,
    Download,
    CheckCircle2,
    Circle,
    Printer,
    FileText,
    Layers,
    Pencil,
    User,
    Eye,
    LayoutDashboard,
    AlertCircle,
    Loader2,
    Info,
    AlertTriangle,
    X,
    Briefcase,
    ClipboardList
} from "lucide-react"
import { cn, formatBytes, translateStatus } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import dynamic from "next/dynamic"

import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useAuth } from "@/contexts/AuthContext"
import { TaskActionCard } from "@/components/workflow/TaskActionCard"
import { MaterialAssignmentTabs } from "./MaterialAssignmentTabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { WizardProcessSidebar } from "./WizardProcessSidebar"
import { completeTask } from "@/lib/workflow/api"
import { motion, AnimatePresence } from "framer-motion"
import { WizardHeader } from "./WizardHeader"
import { WizardStickyFooter } from "./WizardStickyFooter"
import { WizardRightSidebar } from "./WizardRightSidebar"
import { RectificationStep } from "./steps/RectificationStep"

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
    { id: 'MATERIAL_APPROVAL', label: 'Aprobación de Stock', icon: CheckCircle2, alwaysShow: false },
    { id: 'OUTSOURCING_ASSIGNMENT', label: 'Asignación de Tercerizados', icon: Truck, alwaysShow: true },
    { id: 'PREPRESS', label: 'Pre-Impresión', icon: FileText, alwaysShow: false },
    { id: 'PRESS', label: 'Impresión', icon: Printer, alwaysShow: false },
    { id: 'POSTPRESS', label: 'Post-Impresión', icon: Layers, alwaysShow: false },
    { id: 'OUTSOURCING_VERIFICATION', label: 'Verificación de Tercerizados', icon: LayoutDashboard, alwaysShow: false },
    { id: 'RECTIFICATION', label: 'Rectificación', icon: ClipboardList, alwaysShow: false },
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
    const [newMaterialVariants, setNewMaterialVariants] = useState<any[]>([])
    const [loadingVariants, setLoadingVariants] = useState(false)
    const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null)
    const [uoms, setUoMs] = useState<any[]>([]) // Store all UoMs
    const [addingMaterial, setAddingMaterial] = useState(false)
    const [designUrl, setDesignUrl] = useState("")
    const [designFile, setDesignFile] = useState<File | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isOutsourced, setIsOutsourced] = useState(false)
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
    const [unitPrice, setUnitPrice] = useState("0")
    // State for implicit task approvals
    const [taskNotes, setTaskNotes] = useState<Record<string, string>>({})
    const [taskFiles, setTaskFiles] = useState<Record<string, File | null>>({})
    const [grossUnitPrice, setGrossUnitPrice] = useState("0")
    const [selectedDocumentType, setSelectedDocumentType] = useState<string>("FACTURA")
    const [showPOPreview, setShowPOPreview] = useState(false)
    const [isAnnuling, setIsAnnuling] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [outsourcedPending, setOutsourcedPending] = useState<any[]>([])
    const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isBackwardModalOpen, setIsBackwardModalOpen] = useState(false)
    const [pendingPrevStage, setPendingPrevStage] = useState<string | null>(null)
    // Rectification state
    const [rectificationAdjustments, setRectificationAdjustments] = useState<{ material_id: number, actual_quantity: number }[]>([])
    const [rectificationProducedQty, setRectificationProducedQty] = useState<number | null>(null)
    const [isRectifying, setIsRectifying] = useState(false)
    const { user } = useAuth()
    const { openHub } = useHubPanel()

    const pendingTasks = order?.workflow_tasks?.filter((t: any) => t.status === 'PENDING' || t.status === 'IN_PROGRESS') || []
    const canUserCompleteTask = (task: any) => {
        if (!user) return false
        if (user.is_superuser) return true

        // Direct assignment
        if (task.assigned_to === user.id) return true

        // Group assignment
        if ((user as any)?.groups) {
            return (user as any).groups.some((g: any) => {
                const groupName = typeof g === 'string' ? g.toLowerCase() : String(g).toLowerCase()

                return (
                    // Match by name (case-insensitive)
                    (task.assigned_group_name && task.assigned_group_name.toLowerCase() === groupName) ||
                    (task.data?.candidate_group && task.data.candidate_group.toLowerCase() === groupName) ||
                    // Legacy match
                    (g === task.assigned_group)
                )
            })
        }

        return false
    }

    const canApproveAll = pendingTasks.every(canUserCompleteTask)

    const getFilteredStages = (orderData: any) => {
        if (!orderData) return BASE_STAGES.filter(s => s.alwaysShow)

        return BASE_STAGES.filter(stage => {
            if (stage.id === 'MATERIAL_APPROVAL') {
                const hasStockMaterials = (orderData.materials || []).some((m: any) => !m.is_outsourced)
                return hasStockMaterials || orderData.current_stage === 'MATERIAL_APPROVAL'
            }
            if (stage.alwaysShow) return true
            if (stage.id === 'PREPRESS') return orderData.current_stage === 'PREPRESS' || orderData.requires_prepress
            if (stage.id === 'PRESS') return orderData.current_stage === 'PRESS' || orderData.requires_press
            if (stage.id === 'POSTPRESS') return orderData.current_stage === 'POSTPRESS' || orderData.requires_postpress
            if (stage.id === 'OUTSOURCING_VERIFICATION') return orderData.current_stage === 'OUTSOURCING_VERIFICATION' || (orderData.materials || []).some((m: any) => m.is_outsourced)
            // RECTIFICATION: show if OT has at least 1 material OR it's already in this stage
            if (stage.id === 'RECTIFICATION') {
                return orderData.current_stage === 'RECTIFICATION' ||
                    ((orderData.materials || []).length > 0)
            }
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
            const currentIndex = filteredStages.findIndex(s => s.id === response.data.current_stage)
            let resolvedIndex = currentIndex !== -1 ? currentIndex : 0

            // If a specific target stage was requested (e.g. from Kanban button), jump to it
            if (targetStage) {
                const targetIndex = filteredStages.findIndex(s => s.id === targetStage)
                if (targetIndex !== -1) {
                    resolvedIndex = targetIndex
                }
            }

            setViewingStepIndex(resolvedIndex)

            // Sync Pre-press state from order data
            if (response.data.stage_data) {
                const sData = response.data.stage_data
                setDesignUrl(sData.design_url || "")
            }
        } catch (error) {
            console.error("Error fetching order details:", error)
            toast.error("No se pudo cargar la información de la OT")
        } finally {
            setLoading(false)
        }
    }

    const handleAddComment = async (text: string) => {
        if (!order) return
        const newComment = {
            user: user?.first_name || user?.username || "Usuario",
            text,
            timestamp: new Date().toISOString()
        }

        const currentComments = order.stage_data?.comments || []
        const updatedStageData = {
            ...order.stage_data,
            comments: [...currentComments, newComment]
        }

        try {
            await api.patch(`/production/orders/${orderId}/`, { stage_data: updatedStageData })
            setOrder((prev: any) => ({ ...prev, stage_data: updatedStageData }))
            toast.success("Comentario registrado")
        } catch (error) {
            toast.error("Error al registrar comentario")
        }
    }

    useEffect(() => {
        if (open && orderId) {
            fetchOrder()
        }
    }, [open, orderId])

    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape: Close wizard
            if (e.key === 'Escape') {
                onOpenChange(false)
            }

            // Navigation shortcuts (Ctrl + Arrows)
            if (e.ctrlKey) {
                if (e.key === 'ArrowRight') {
                    // Next Stage
                    if (isViewingCurrentStage && order?.status !== 'FINISHED' && STAGES[viewingStepIndex]?.id !== 'FINISHED') {
                        const nextStage = STAGES[viewingStepIndex + 1]
                        if (nextStage) {
                            const isMaterialApprovalIncomplete = STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' &&
                                order?.materials?.some((m: any) => !m.is_available)

                            // Can approve all logic:
                            // We only block if there are tasks assigned to SOMEONE ELSE that are pending.
                            // If tasks are assigned to ME (or my group), I can proceed (implicit approval).
                            const pendingForOthers = pendingTasks.some((t: any) => !canUserCompleteTask(t))

                            const isNextDisabled = transitioning || isMaterialApprovalIncomplete || pendingForOthers

                            if (!isNextDisabled) {
                                if (nextStage.id === 'FINISHED') {
                                    if (confirm("¿Estás seguro de finalizar la producción? Una vez finalizada la OT, no se puede modificar.")) {
                                        handleTransition(nextStage.id)
                                    }
                                } else {
                                    handleTransition(nextStage.id)
                                }
                            }
                        }
                    } else if (!isViewingCurrentStage) {
                        // Just move view forward if not at current stage
                        if (viewingStepIndex < actualStepIndex) {
                            setViewingStepIndex(v => v + 1)
                        }
                    }
                }

                if (e.key === 'ArrowLeft') {
                    // Previous Step (Visual only)
                    if (viewingStepIndex > 0) {
                        setViewingStepIndex(v => v - 1)
                    }
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, viewingStepIndex, isViewingCurrentStage, order, actualStepIndex, transitioning, pendingTasks, canApproveAll])

    const handleTransition = async (nextStageId: string, data: any = {}) => {
        // Validation: Materials - Removed strict requirement as per user request
        // The wizard footer already warns if no materials are assigned.

        // Transition Analysis
        const nextIndex = STAGES.findIndex(s => s.id === nextStageId)
        const currentIndex = STAGES.findIndex(s => s.id === order.current_stage)
        const isMovingForward = nextIndex > currentIndex

        if (isMovingForward && pendingTasks.length > 0) {
            // Check if there are tasks I CANNOT approve
            const unapprovableTasks = pendingTasks.filter((t: any) => !canUserCompleteTask(t))
            if (unapprovableTasks.length > 0) {
                toast.error("Existen tareas de aprobación pendientes asignadas a otros usuarios.")
                return
            }
        }

        if (order.current_stage === 'MATERIAL_APPROVAL' && isMovingForward) {
            // Validation: Check for insufficient stock items (that are not outsourced)
            const missingStock = order.materials?.filter((m: any) => !m.is_outsourced && !m.is_available) || []
            if (missingStock.length > 0) {
                toast.error(`Stock insuficiente para ${missingStock.length} componentes. Reponga stock para continuar.`)
                return
            }
        }

        if (order.current_stage === 'OUTSOURCING_ASSIGNMENT' && isMovingForward) {
            const pending = order.materials?.filter((m: any) => m.is_outsourced && !m.purchase_order_number) || []
            if (pending.length > 0 && !showPOPreview) {
                setOutsourcedPending(pending)
                setShowPOPreview(true)
                return
            }
        }

        setTransitioning(true)
        try {
            // IMPLICIT APPROVAL:
            // If moving forward, complete all assigned pending tasks first
            if (isMovingForward) {
                const tasksToApprove = pendingTasks.filter((t: any) => canUserCompleteTask(t))
                if (tasksToApprove.length > 0) {
                    await Promise.all(tasksToApprove.map((task: any) => {
                        const notes = taskNotes[task.id]
                        const file = taskFiles[task.id]
                        return completeTask(task.id, notes, file ? [file] : undefined)
                    }))
                }
            }

            // Prepare data and files for transition
            const formData = new FormData()
            formData.append('next_stage', nextStageId)

            // If data is empty and we are moving forward, collect current stage state
            const payloadData = data
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

            await api.post(`/production/orders/${orderId}/transition/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            toast.success("Etapa actualizada")

            // Clear files after successful transition
            setDesignFile(null)
            setTaskNotes({})
            setTaskFiles({})

            fetchOrder()
            if (onSuccess) onSuccess()
        } catch (err) {
            const error: any = err
            toast.error(error.response?.data?.error || "Error al cambiar de etapa")
        } finally {
            setTransitioning(false)
        }
    }

    const handleRectifyAndFinish = async () => {
        if (!order) return

        setIsRectifying(true)
        try {
            // Step 1: Call rectify endpoint with adjustments
            await api.post(`/production/orders/${orderId}/rectify/`, {
                material_adjustments: rectificationAdjustments,
                produced_quantity: rectificationProducedQty,
                notes: 'Rectificación desde wizard'
            })

            // Step 2: Transition to FINISHED
            await handleTransition('FINISHED')
        } catch (err) {
            const error: any = err
            toast.error(error.response?.data?.error || "Error al rectificar y finalizar la OT")
        } finally {
            setIsRectifying(false)
        }
    }


    useEffect(() => {
        if (selectedProductObj?.has_variants) {
            const fetchVariants = async () => {
                try {
                    setLoadingVariants(true)
                    const res = await api.get(`/inventory/products/?parent_template=${selectedProductObj.id}`)
                    setNewMaterialVariants(res.data.results || res.data)
                } catch (error) {
                    console.error("Error fetching material variants:", error)
                    setNewMaterialVariants([])
                } finally {
                    setLoadingVariants(false)
                }
            }
            fetchVariants()
        } else {
            setNewMaterialVariants([])
        }
    }, [selectedProductObj])

    const handleAddMaterial = async () => {
        if (!newMaterialProduct) {
            toast.error("Seleccione un producto")
            return
        }

        if (selectedProductObj?.has_variants && newMaterialProduct.toString() === selectedProductObj.id.toString()) {
            toast.error("Debe seleccionar una variante específica")
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
        } catch (err) {
            const error: any = err
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
        } catch (err) {
            const error: any = err
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
        } catch (err) {
            const error: any = err
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
        } catch (err) {
            const error: any = err
            toast.error(error.response?.data?.error || "Error al eliminar la orden")
        } finally {
            setIsDeleting(false)
        }
    }

    if (!order && loading) return null

    const stageData = order?.stage_data || {}
    const productName = order?.product_name || order?.sale_line?.product?.name || "Producto"

    const materials = order?.materials || []
    const orderHasMaterials = !!materials.some((m: any) => !m.is_outsourced)

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                size="2xl"
                hideScrollArea
                className="h-[90vh]"
                contentClassName="h-full"
                title={
                    <WizardHeader
                        order={order}
                        currentStageLabel={STAGES[viewingStepIndex]?.label}
                        onEdit={() => setIsEditOpen(true)}
                        onOpenCommandCenter={(id: number, type: string) => openHub({ orderId: id, type: type as any })}
                        onAnnul={() => handleAnnulOrder()}
                        onDelete={() => setIsDeleteModalOpen(true)}
                        isAnnuling={isAnnuling}
                        isDeleting={isDeleting}
                    />
                }
            >
                <div className="flex flex-1 overflow-hidden h-full min-h-0">
                    {/* Left Sidebar - Steps */}
                    <WizardProcessSidebar
                        stages={STAGES}
                        viewingStepIndex={viewingStepIndex}
                        actualStepIndex={actualStepIndex}
                        onStepClick={setViewingStepIndex}
                        order={order}
                    />

                    {/* Center - Content Area */}
                    <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold">{STAGES[viewingStepIndex]?.label}</h3>
                        </div>

                        {/* Stage Content */}
                        <div className="flex-1 overflow-y-auto min-h-0 relative">
                            {/* Mobile Navigation Dropdown */}
                            <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 mb-4">
                                <Select
                                    value={STAGES[viewingStepIndex]?.id}
                                    onValueChange={(val) => {
                                        const idx = STAGES.findIndex(s => s.id === val)
                                        if (idx !== -1) setViewingStepIndex(idx)
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar etapa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STAGES.map((s, i) => {
                                            const isPast = actualStepIndex > i
                                            const isCurrent = actualStepIndex === i
                                            return (
                                                <SelectItem key={s.id} value={s.id} disabled={!isPast && !isCurrent}>
                                                    <div className="flex items-center gap-2">
                                                        <s.icon className="h-4 w-4" />
                                                        <span>{s.label}</span>
                                                        {isPast && <CheckCircle2 className="h-3 w-3 ml-2 text-emerald-700" />}
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={viewingStepIndex}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className={cn("space-y-6", !isViewingCurrentStage && "pointer-events-none opacity-80")}
                                >
                                    {STAGES[viewingStepIndex]?.id === 'MATERIAL_ASSIGNMENT' && (
                                        <div className="space-y-6">

                                            <div className="space-y-4">

                                                <MaterialAssignmentTabs
                                                    stockCount={order?.materials?.filter((m: any) => !m.is_outsourced).length || 0}
                                                    outsourcedCount={order?.materials?.filter((m: any) => m.is_outsourced).length || 0}
                                                    showOutsourcedTab={false}
                                                    stockContent={
                                                        <div className="space-y-6">
                                                            <div className="border rounded-md overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-muted/50">
                                                                        <tr>
                                                                            <th className="p-2 text-left">Componente</th>
                                                                            <th className="p-2 text-right">Cant. Planificada</th>
                                                                            <th className="p-2 text-left">UoM</th>
                                                                            <th className="p-2 text-right">Costo Total</th>
                                                                            <th className="p-2 text-left">Origen</th>
                                                                            <th className="p-2 w-10"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {order?.materials?.filter((m: any) => !m.is_outsourced).map((m: any) => (
                                                                            <tr key={m.id} className="border-t">
                                                                                <td className="p-2">
                                                                                    <p className="font-medium">{m.component_name}</p>
                                                                                    <p className="text-[10px] text-muted-foreground uppercase">{m.component_code}</p>
                                                                                </td>
                                                                                <td className="p-2 text-right font-medium">{m.quantity_planned}</td>
                                                                                <td className="p-2">{m.uom_name}</td>
                                                                                <td className="p-2 text-right font-bold">{formatCurrency(m.total_cost)}</td>
                                                                                <td className="p-2">
                                                                                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">{m.source}</Badge>
                                                                                </td>
                                                                                <td className="p-2">
                                                                                    {m.source === 'MANUAL' && isViewingCurrentStage && (
                                                                                        <div className="flex gap-1">
                                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => handleEditMaterial(m)}>
                                                                                                <Pencil className="h-3 w-3" />
                                                                                            </Button>
                                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteMaterial(m.id)}>
                                                                                                <Trash2 className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!order?.materials || order.materials.filter((m: any) => !m.is_outsourced).length === 0) && (
                                                                            <tr>
                                                                                <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No hay materiales de stock asignados.</td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            {isViewingCurrentStage && (
                                                                <>
                                                                    {isAddMaterialOpen && !isOutsourced ? (
                                                                        <div className="p-4 border rounded-md bg-muted/20 space-y-4 animate-in slide-in-from-top-2">
                                                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                                                                <div className="flex-1 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Producto / Componente</label>
                                                                                    <ProductSelector
                                                                                        value={newMaterialProduct}
                                                                                        onChange={setNewMaterialProduct}
                                                                                        onSelect={(p) => {
                                                                                            setSelectedProductObj(p)
                                                                                            if (p?.uom) setNewMaterialUoM(typeof p.uom === 'object' ? p.uom.id.toString() : p.uom.toString())
                                                                                        }}
                                                                                        disabled={!!editingMaterialId}
                                                                                        shouldResolveVariants={false}
                                                                                        customFilter={(p) => {
                                                                                            if (order?.main_product_id && p.id.toString() === order.main_product_id.toString()) return false;
                                                                                            if (p.product_type === 'CONSUMABLE') return false;
                                                                                            if (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing) return false;
                                                                                            if (p.requires_advanced_manufacturing && !p.track_inventory) return false;
                                                                                            return p.product_type !== 'SERVICE'
                                                                                        }}
                                                                                    />
                                                                                    {selectedProductObj?.has_variants && (
                                                                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                                                            <Select
                                                                                                value={newMaterialProduct?.toString() || ""}
                                                                                                onValueChange={(val) => {
                                                                                                    setNewMaterialProduct(val)
                                                                                                    const v = newMaterialVariants.find(vr => vr.id.toString() === val)
                                                                                                    if (v?.uom) setNewMaterialUoM(v.uom.toString())
                                                                                                }}
                                                                                            >
                                                                                                <SelectTrigger className="h-9 w-full bg-primary/5 border-primary/20 rounded-xl">
                                                                                                    <SelectValue placeholder="Seleccione variante requerida..." />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    {newMaterialVariants.length > 0 ? (
                                                                                                        newMaterialVariants.map(v => (
                                                                                                            <SelectItem key={v.id} value={v.id.toString()}>
                                                                                                                {v.variant_display_name || v.name}
                                                                                                            </SelectItem>
                                                                                                        ))
                                                                                                    ) : (
                                                                                                        <div className="p-2 text-xs text-center italic">
                                                                                                            {loadingVariants ? "Cargando variantes..." : "Sin variantes disponibles"}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="w-full md:w-32 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Cantidad</label>
                                                                                    <Input type="number" value={newMaterialQty} onChange={(e) => setNewMaterialQty(e.target.value)} />
                                                                                </div>
                                                                                <div className="w-full md:w-40 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Unidad</label>
                                                                                    <UoMSelector product={selectedProductObj} context="bom" value={newMaterialUoM} onChange={setNewMaterialUoM} uoms={uoms} />
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <Button variant="outline" size="sm" onClick={() => { setIsAddMaterialOpen(false); resetMaterialForm(); }}>Cancelar</Button>
                                                                                    <Button size="sm" onClick={handleAddMaterial} disabled={addingMaterial}>
                                                                                        {addingMaterial ? (editingMaterialId ? "Guardando..." : "Añadiendo...") : (editingMaterialId ? "Guardar" : "Añadir")}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col gap-3">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="w-full border-dashed"
                                                                                onClick={() => {
                                                                                    resetMaterialForm()
                                                                                    setIsOutsourced(false)
                                                                                    setIsAddMaterialOpen(true)
                                                                                }}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Agregar Material de Stock
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    }
                                                    outsourcedContent={
                                                        <div className="space-y-6">
                                                            <div className="grid gap-3">
                                                                {order?.materials?.filter((m: any) => m.is_outsourced).map((m: any) => (
                                                                    <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg bg-background group">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="bg-primary/10 p-2 rounded-full">
                                                                                <Truck className="h-4 w-4 text-primary" />
                                                                            </div>
                                                                            <div className="space-y-0.5">
                                                                                <p className="text-sm font-bold">{m.component_name}</p>
                                                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                                                                    <span>{m.supplier_name}</span>
                                                                                    <span>•</span>
                                                                                    <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                                                                                    <span>•</span>
                                                                                    <span>{formatCurrency(parseFloat(m.unit_price) * 1.19)} (Bruto) c/u</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="text-right mr-2">
                                                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Estimado</p>
                                                                                <p className="text-sm font-bold text-primary">
                                                                                    {formatCurrency(parseFloat(m.quantity_planned) * parseFloat(m.unit_price) * 1.19)}
                                                                                </p>
                                                                            </div>
                                                                            {isViewingCurrentStage && !m.purchase_order_number && (
                                                                                <div className="flex gap-1">
                                                                                    <Button variant="ghost" size="icon" onClick={() => handleEditMaterial(m)} className="h-8 w-8">
                                                                                        <Pencil className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMaterial(m.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                            {m.purchase_order_number && (
                                                                                <Badge variant="outline" className="gap-1 border-blue-200 text-primary bg-blue-50">
                                                                                    <FileText className="h-3 w-3" />
                                                                                    {m.purchase_order_number}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!order?.materials || order.materials.filter((m: any) => m.is_outsourced).length === 0) && (
                                                                    <div className="p-8 text-center text-muted-foreground italic border rounded-lg border-dashed">
                                                                        No hay servicios tercerizados asignados.
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {isViewingCurrentStage && (
                                                                <>
                                                                    {isAddMaterialOpen && isOutsourced ? (
                                                                        <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                                                                <div className="flex-1 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Servicio</label>
                                                                                    <ProductSelector
                                                                                        value={newMaterialProduct}
                                                                                        onChange={setNewMaterialProduct}
                                                                                        onSelect={(obj) => {
                                                                                            setSelectedProductObj(obj)
                                                                                            if (obj?.uom_id) setNewMaterialUoM(obj.uom_id.toString())
                                                                                        }}
                                                                                        disabled={!!editingMaterialId}
                                                                                        customFilter={(p) => p.product_type === 'SERVICE' && p.can_be_purchased}
                                                                                    />
                                                                                </div>
                                                                                <div className="w-full md:w-32 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Cantidad</label>
                                                                                    <Input type="number" value={newMaterialQty} onChange={(e) => setNewMaterialQty(e.target.value)} />
                                                                                </div>
                                                                                <div className="w-full md:w-40 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase">Unidad</label>
                                                                                    <UoMSelector product={selectedProductObj} context="bom" value={newMaterialUoM} onChange={setNewMaterialUoM} uoms={uoms} />
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex flex-col md:flex-row gap-4 w-full pt-2 border-t border-primary/10 mt-2">
                                                                                <div className="flex-1 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase text-primary">Proveedor</label>
                                                                                    <AdvancedContactSelector value={selectedSupplierId} onChange={setSelectedSupplierId} contactType="SUPPLIER" />
                                                                                </div>
                                                                                <div className="w-full md:w-32 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase text-primary">Precio Bruto</label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        value={grossUnitPrice}
                                                                                        onChange={(e) => {
                                                                                            const gross = e.target.value
                                                                                            setGrossUnitPrice(gross)
                                                                                            setUnitPrice(gross ? (parseFloat(gross) / 1.19).toFixed(2) : "0")
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1 space-y-2">
                                                                                    <label className="text-xs font-bold uppercase text-primary">Documento</label>
                                                                                    <select
                                                                                        className="w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary"
                                                                                        value={selectedDocumentType}
                                                                                        onChange={(e) => setSelectedDocumentType(e.target.value)}
                                                                                    >
                                                                                        <option value="FACTURA">Factura</option>
                                                                                        <option value="BOLETA">Boleta</option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex justify-end gap-2 pt-2">
                                                                                <Button variant="ghost" size="sm" onClick={() => { setIsAddMaterialOpen(false); resetMaterialForm(); }}>Cancelar</Button>
                                                                                <Button size="sm" onClick={handleAddMaterial} disabled={addingMaterial}>
                                                                                    {editingMaterialId ? "Guardar" : "Añadir Servicio"}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="w-full border-dashed text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                                                                            onClick={() => {
                                                                                resetMaterialForm()
                                                                                setIsOutsourced(true)
                                                                                setIsAddMaterialOpen(true)
                                                                            }}
                                                                        >
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Agregar Servicio Tercerizado
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    }

                                                />
                                            </div>
                                        </div>
                                    )}


                                    {STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' && (
                                        <div className="space-y-6">

                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_MATERIAL_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}

                                            <div className="space-y-4">
                                                <p className="text-sm text-muted-foreground">Verifique la disponibilidad de stock en {order?.warehouse_name || 'la bodega seleccionada'}.</p>
                                                <div className="grid gap-4">
                                                    {order?.materials?.filter((m: any) => !m.is_outsourced).map((m: any) => (
                                                        <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-medium">{m.component_name} <span className="text-xs text-muted-foreground">({m.component_code})</span></p>
                                                                <p className="text-xs text-muted-foreground">Requerido: {m.quantity_planned} {m.uom_name}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right mr-2">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">En Bodega</p>
                                                                    <p className={cn("text-sm font-bold", m.is_available ? "text-emerald-700" : "text-destructive")}>
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
                                                    {order?.materials?.filter((m: any) => !m.is_outsourced).length === 0 && (
                                                        <div className="text-center py-4 text-muted-foreground text-sm italic border rounded-lg border-dashed">
                                                            Sin materiales de stock requeridos.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'OUTSOURCING_ASSIGNMENT' && (
                                        <div className="space-y-6">
                                            <div className="p-4 bg-primary/10 border border-indigo-100 rounded-lg flex gap-3">
                                                <Plus className="h-5 w-5 text-primary shrink-0" />
                                                <div className="text-sm text-primary">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold">Asignación de Servicios Tercerizados</p>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Info className="h-3.5 w-3.5 text-indigo-400 cursor-help" />
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-xs bg-indigo-900 text-white border-indigo-700">
                                                                    <p className="text-xs">
                                                                        Los servicios tercerizados generarán automáticamente Órdenes de Compra en estado Confirmado que deberán procesarse desde el Hub de la OC.
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                    <p className="text-xs">Si el trabajo requiere servicios externos de un proveedor, agréguelos aquí. Se generará una Orden de Compra automáticamente.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* List of current outsourced services */}
                                                <div className="grid gap-3">
                                                    {order?.materials?.filter((m: any) => m.is_outsourced).map((m: any) => (
                                                        <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg bg-background group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-primary/10 p-2 rounded-full">
                                                                    <Truck className="h-4 w-4 text-primary" />
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <p className="text-sm font-bold">{m.component_name}</p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                                                        <span>{m.supplier_name}</span>
                                                                        <span>•</span>
                                                                        <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                                                                        <span>•</span>
                                                                        <span>{formatCurrency(parseFloat(m.unit_price) * 1.19)} (Bruto) c/u</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right mr-2">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Estimado</p>
                                                                    <p className="text-sm font-bold text-primary">
                                                                        {formatCurrency(parseFloat(m.quantity_planned) * parseFloat(m.unit_price) * 1.19)}
                                                                    </p>
                                                                </div>
                                                                {isViewingCurrentStage && !m.purchase_order_number && (
                                                                    <div className="flex gap-1">
                                                                        <Button variant="ghost" size="icon" onClick={() => handleEditMaterial(m)} className="h-8 w-8">
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteMaterial(m.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {m.purchase_order_number && (
                                                                    <Badge variant="outline" className="gap-1 border-blue-200 text-primary bg-blue-50">
                                                                        <FileText className="h-3 w-3" />
                                                                        {m.purchase_order_number}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {isViewingCurrentStage && (
                                                    <div className="pt-2">
                                                        {isAddMaterialOpen && isOutsourced ? (
                                                            <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-xs font-bold uppercase">Servicio</label>
                                                                        <ProductSelector
                                                                            value={newMaterialProduct}
                                                                            onChange={setNewMaterialProduct}
                                                                            onSelect={(obj) => {
                                                                                setSelectedProductObj(obj)
                                                                                if (obj?.uom_id) setNewMaterialUoM(obj.uom_id.toString())
                                                                            }}
                                                                            disabled={!!editingMaterialId}
                                                                            customFilter={(p) => p.product_type === 'SERVICE' && p.can_be_purchased}
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
                                                                            context="bom"
                                                                            value={newMaterialUoM}
                                                                            onChange={setNewMaterialUoM}
                                                                            uoms={uoms}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col md:flex-row gap-4 w-full pt-2 border-t border-primary/10 mt-2">
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-xs font-bold uppercase text-primary">Proveedor</label>
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
                                                                                setUnitPrice(gross ? (parseFloat(gross) / 1.19).toFixed(2) : "0")
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 space-y-2">
                                                                        <label className="text-xs font-bold uppercase text-primary">Documento</label>
                                                                        <select
                                                                            className="w-full rounded-md border border-primary/30 bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary"
                                                                            value={selectedDocumentType}
                                                                            onChange={(e) => setSelectedDocumentType(e.target.value)}
                                                                        >
                                                                            <option value="FACTURA">Factura</option>
                                                                            <option value="BOLETA">Boleta</option>
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-2 pt-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => { setIsAddMaterialOpen(false); resetMaterialForm(); }}>Cancelar</Button>
                                                                    <Button size="sm" onClick={handleAddMaterial} disabled={addingMaterial}>
                                                                        {editingMaterialId ? "Guardar" : "Añadir Servicio"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="w-full border-dashed text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                                                                onClick={() => {
                                                                    resetMaterialForm()
                                                                    setIsOutsourced(true)
                                                                    setIsAddMaterialOpen(true)
                                                                }}
                                                            >
                                                                <Plus className="mr-2 h-4 w-4" />
                                                                Agregar Servicio Tercerizado
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'OUTSOURCING_VERIFICATION' && (
                                        <div className="space-y-6">
                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_OUTSOURCING_VERIFICATION').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}

                                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
                                                <LayoutDashboard className="h-5 w-5 text-amber-600 shrink-0" />
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-bold">Verificación de Servicios Tercerizados</p>
                                                    <p className="text-xs">Valide que todos los servicios externos hayan sido recibidos correctamente en el sistema.</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-4">
                                                {order?.materials?.filter((m: any) => m.is_outsourced).map((m: any) => {
                                                    const isReceived = m.purchase_order_receiving_status === 'RECEIVED'
                                                    const statusLabel = isReceived ? 'Recibido' : (m.purchase_order_receiving_status === 'PARTIAL' ? 'Parcial' : 'Pendiente')

                                                    return (
                                                        <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg bg-background">
                                                            <div className="flex items-center gap-4">
                                                                <div className={cn(
                                                                    "h-3 w-3 rounded-full animate-pulse",
                                                                    isReceived ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-none" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                                                                )} />
                                                                <div className="space-y-0.5">
                                                                    <p className="text-sm font-bold">{m.component_name}</p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                                                        <span className={cn(isReceived ? "text-emerald-700" : "text-amber-600")}>{statusLabel}</span>
                                                                        <span>•</span>
                                                                        <span>{m.supplier_name}</span>
                                                                        <span>•</span>
                                                                        <span>Cant: {m.quantity_planned} {m.uom_name}</span>
                                                                        <span>•</span>
                                                                        <span>OC: {m.purchase_order_number || '---'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {m.purchase_order_id && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-2 h-8"
                                                                        onClick={() => openHub({ orderId: m.purchase_order_id, type: 'purchase' })}
                                                                    >
                                                                        <LayoutDashboard className="h-4 w-4" />
                                                                        Abrir HUB de OC
                                                                    </Button>
                                                                )}
                                                                <Badge variant={isReceived ? "default" : "secondary"} className={cn(isReceived ? "bg-green-500" : "")}>
                                                                    {isReceived ? <Check className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                                                                    {isReceived ? "OK" : "Pendiente"}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>


                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'PREPRESS' && (
                                        <div className="space-y-6">
                                            {/* Design Files & Checkout Files */}
                                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-3">
                                                <div className="space-y-4">
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
                                                                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                        <div className="flex-1 truncate font-medium text-primary" title={att.original_filename}>{att.original_filename}</div>
                                                                        <div className="text-[10px] text-muted-foreground shrink-0">{formatBytes(att.file_size)}</div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 hover:bg-blue-100 text-primary"
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

                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_PREPRESS_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'PRESS' && (
                                        <div className="space-y-6">

                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_PRESS_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'POSTPRESS' && (
                                        <div className="space-y-6">
                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_POSTPRESS_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'OUTSOURCING_VERIFICATION' && (
                                        <div className="space-y-6">
                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_OUTSOURCING_VERIFICATION_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'RECTIFICATION' && (
                                        <div className="space-y-6">
                                            {/* Rectification approval task (if any) */}
                                            {order?.workflow_tasks?.filter((t: any) => t.task_type === 'OT_RECTIFICATION_APPROVAL').map((task: any) => (
                                                <TaskActionCard
                                                    key={task.id}
                                                    task={task}
                                                    canComplete={canUserCompleteTask(task)}
                                                    onNotesChange={(val) => setTaskNotes(prev => ({ ...prev, [task.id]: val }))}
                                                    onFileChange={(file) => setTaskFiles(prev => ({ ...prev, [task.id]: file }))}
                                                    notesValue={taskNotes[task.id] || ""}
                                                />
                                            ))}
                                            {/* Rectification input form */}
                                            <RectificationStep
                                                order={order}
                                                onChange={(adjustments, producedQty) => {
                                                    setRectificationAdjustments(adjustments)
                                                    setRectificationProducedQty(producedQty)
                                                }}
                                            />
                                        </div>
                                    )}

                                    {STAGES[viewingStepIndex]?.id === 'FINISHED' && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                                                <div className="relative bg-green-500 p-6 rounded-full shadow-lg shadow-green-500/20">
                                                    <CheckCircle2 className="h-16 w-16 text-white" />
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-w-sm">
                                                <h3 className="text-2xl font-bold text-foreground">Producción Finalizada</h3>
                                                <p className="text-muted-foreground leading-relaxed">
                                                    Este trabajo ha completado todas sus etapas y el producto final ha sido ingresado al inventario de despacho.
                                                </p>
                                            </div>
                                            <div className="flex gap-3">

                                                <Button onClick={() => order?.sale_order && openHub({ orderId: order.sale_order, type: 'sale' })} className="gap-2 font-semibold">
                                                    <LayoutDashboard className="h-4 w-4" />
                                                    Ir al HUB de Venta
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <WizardStickyFooter
                            isViewingCurrentStage={isViewingCurrentStage}
                            onClose={() => onOpenChange(false)}
                            pendingTasks={pendingTasks}
                            canApproveAll={canApproveAll}
                            order={order}
                            viewingStepIndex={viewingStepIndex}
                            actualStepIndex={actualStepIndex}
                            stages={STAGES}
                            transitioning={transitioning || isRectifying}
                            onTransition={handleTransition}
                            onBackToCurrent={() => setViewingStepIndex(actualStepIndex)}
                            onBack={() => {
                                const prevStage = STAGES[actualStepIndex - 1]
                                if (prevStage) {
                                    setPendingPrevStage(prevStage.id)
                                    setIsBackwardModalOpen(true)
                                }
                            }}
                            isMaterialApprovalIncomplete={
                                STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' &&
                                order?.materials?.some((m: any) => !m.is_available)
                            }
                            hasMaterials={orderHasMaterials}
                            isRectificationStep={STAGES[viewingStepIndex]?.id === 'RECTIFICATION'}
                            onRectifyAndFinish={handleRectifyAndFinish}
                        />
                    </div>

                    {/* Right Sidebar - Information */}
                    <WizardRightSidebar
                        order={order}
                        viewingStepIndex={viewingStepIndex}
                        productName={productName}
                        stageData={stageData}
                        comments={order?.stage_data?.comments || []}
                        onAddComment={handleAddComment}
                    />
                </div>

            </BaseModal>

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
            <BaseModal
                open={showPOPreview}
                onOpenChange={setShowPOPreview}
                size="md"
                title={
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Vista Previa de Órdenes de Compra
                    </div>
                }
                description="Se generarán las siguientes Órdenes de Compra en borrador para los servicios tercerizados asignados."
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={() => setShowPOPreview(false)}>
                            Cancelar y Revisar
                        </Button>
                        <Button onClick={() => {
                            setShowPOPreview(false)
                            const nextStage = STAGES[actualStepIndex + 1]?.id
                            if (nextStage) {
                                handleTransition(nextStage)
                            }
                        }}>
                            Confirmar y Generar OC
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 py-4">
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="p-2 text-left">Proveedor</th>
                                    <th className="p-2 text-left">Servicio</th>
                                    <th className="p-2 text-right">Cant.</th>
                                    <th className="p-2 text-right">P. Bruto</th>
                                    <th className="p-2 text-right">Total Bruto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outsourcedPending.map((m, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="p-2 font-medium">{m.supplier_name}</td>
                                        <td className="p-2">{m.component_name}</td>
                                        <td className="p-2 text-right">{m.quantity_planned}</td>
                                        <td className="p-2 text-right">{formatCurrency(parseFloat(m.unit_price) * 1.19)}</td>
                                        <td className="p-2 text-right font-bold">{formatCurrency(parseFloat(m.quantity_planned) * parseFloat(m.unit_price) * 1.19)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg flex gap-3 border border-blue-100">
                        <div className="bg-blue-100 p-2 rounded-full h-fit">
                            <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-xs text-primary leading-relaxed">
                            <p className="font-bold mb-1">Nota importante:</p>
                            <p>Las órdenes de compra se crearán en estado <span className="font-bold">Confirmado</span>. Deberá procesar la recepción desde el Hub de la OC para poder finalizar la OT posteriormente.</p>
                        </div>
                    </div>
                </div>
            </BaseModal>

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

            <ActionConfirmModal
                open={isBackwardModalOpen}
                onOpenChange={setIsBackwardModalOpen}
                title="Retroceder Etapa"
                variant="warning"
                onConfirm={() => {
                    if (pendingPrevStage) {
                        handleTransition(pendingPrevStage)
                    }
                    setIsBackwardModalOpen(false)
                }}
                confirmText="Retroceder"
                description={
                    <div className="space-y-3">
                        <p>
                            ¿Está seguro de que desea retroceder a la etapa <strong>{STAGES.find(s => s.id === pendingPrevStage)?.label}</strong>?
                        </p>
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs flex gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <div className="space-y-1">
                                <p className="font-bold">Aviso de Reinicio de Aprobaciones:</p>
                                <p>
                                    Si retrocede, todas las aprobaciones y tareas completadas en las etapas posteriores se reiniciarán y deberán realizarse nuevamente.
                                </p>
                            </div>
                        </div>
                    </div>
                }
            />
        </>
    )
}
