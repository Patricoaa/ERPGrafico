"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Printer, CalendarIcon, Paintbrush, Plus, FileText, Upload, X, FileIcon, User, ExternalLink, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import { AdvancedSaleOrderSelector } from "@/components/selectors/AdvancedSaleOrderSelector"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

const workOrderSchema = z.object({
    description: z.string().min(1, "La descripción es requerida"),
    sale_order: z.string().optional().or(z.literal("")),
    // status: z.string(), // Removing status from form
    // qty_planned: z.number().min(0.01, "La cantidad planeada debe ser mayor a 0"), // Removing planned qty from form
    // qty_produced: z.number().min(0), // Removing produced qty from form
    start_date: z.date().optional().nullable(),
    due_date: z.date().optional().nullable(),
    // New Fields
    product_description: z.string().optional(),
    internal_notes: z.string().optional(),
    contact_id: z.string().optional().or(z.literal("")),
    sale_line: z.string().optional().or(z.literal("")),
    // --- Fields for manual creation ---
    product_id: z.string().optional().or(z.literal("")),
    quantity: z.string().optional(), // Using string for input, converting later
    uom_id: z.string().optional().or(z.literal("")),
})

type WorkOrderFormValues = z.infer<typeof workOrderSchema>

interface WorkOrderFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function WorkOrderForm({ onSuccess, initialData, open: openProp, onOpenChange }: WorkOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [saleOrders, setSaleOrders] = useState<any[]>([])
    const [saleLines, setSaleLines] = useState<any[]>([])
    const [uoms, setUoms] = useState<any[]>([])
    const [loadingLines, setLoadingLines] = useState(false)

    // Advanced Manufacturing States
    const [enablePrepress, setEnablePrepress] = useState(false)
    const [enablePress, setEnablePress] = useState(false)
    const [enablePostpress, setEnablePostpress] = useState(false)

    const [prepressSpecs, setPrepressSpecs] = useState("")
    const [pressSpecs, setPressSpecs] = useState("")
    const [postpressSpecs, setPostpressSpecs] = useState("")

    const [designNeeded, setDesignNeeded] = useState(false)
    const [designFiles, setDesignFiles] = useState<File[]>([])
    const [existingDesignFiles, setExistingDesignFiles] = useState<string[]>([])
    const [folioEnabled, setFolioEnabled] = useState(false)
    const [folioStart, setFolioStart] = useState("")
    const [printType, setPrintType] = useState<string | null>(null)
    const [designApproved, setDesignApproved] = useState(false)
    const [approvalFile, setApprovalFile] = useState<File | null>(null)
    const [existingApprovalFile, setExistingApprovalFile] = useState<string | null>(null)

    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [selectedManualProduct, setSelectedManualProduct] = useState<any>(null)

    const form = useForm<WorkOrderFormValues>({
        resolver: zodResolver(workOrderSchema),
        defaultValues: {
            description: "",
            sale_order: "",
            // status: "PLANNED",
            // qty_planned: 0,
            // qty_produced: 0,
            start_date: new Date(), // Default to today
            due_date: null,
            product_description: "",
            internal_notes: "",
            contact_id: "",
            sale_line: "",
        },
    })

    const fetchSaleOrders = async () => {
        try {
            const response = await api.get('/sales/orders/')
            setSaleOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching sale orders:", error)
        }
    }

    const fetchUoMs = async () => {
        try {
            const response = await api.get('/inventory/uoms/')
            setUoms(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching UoMs:", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchSaleOrders()
            fetchUoMs()
            if (initialData) {
                // Initialize main form
                form.reset({
                    description: initialData.description || "",
                    sale_order: initialData.sale_order?.id?.toString() || initialData.sale_order?.toString() || "",
                    // status: initialData.status || "PLANNED",
                    // qty_planned: parseFloat(initialData.qty_planned) || 0,
                    // qty_produced: parseFloat(initialData.qty_produced) || 0,
                    start_date: initialData.start_date ? new Date(initialData.start_date) : new Date(),
                    due_date: initialData.estimated_completion_date ? new Date(initialData.estimated_completion_date) : (initialData.sale_order_delivery_date ? new Date(initialData.sale_order_delivery_date) : null),
                    // Load stage_data into fields
                    product_description: initialData.stage_data?.product_description || "",
                    internal_notes: initialData.stage_data?.internal_notes || "",
                    contact_id: initialData.stage_data?.contact_id?.toString() || "",
                    sale_line: initialData.sale_line?.id?.toString() || "",
                    // Manual OT fields
                    product_id: initialData.product?.id?.toString() || "",
                    quantity: initialData.stage_data?.quantity?.toString() || "",
                    uom_id: initialData.stage_data?.uom_id?.toString() || "",
                })

                if (initialData.product) {
                    setSelectedManualProduct(initialData.product)
                }

                // Initialize Manufacturing States
                const mfgData = initialData.stage_data || {}

                // Contact
                if (mfgData.contact_id) {
                    setSelectedContact({
                        id: mfgData.contact_id,
                        name: mfgData.contact_name || "Contacto",
                        tax_id: mfgData.contact_tax_id || ""
                    })
                } else {
                    setSelectedContact(null)
                }

                // Phases
                if (mfgData.phases) {
                    setEnablePrepress(mfgData.phases.prepress || false)
                    setEnablePress(mfgData.phases.press || false)
                    setEnablePostpress(mfgData.phases.postpress || false)
                } else {
                    setEnablePrepress(false)
                    setEnablePress(false)
                    setEnablePostpress(false)
                }

                setPrepressSpecs(mfgData.prepress_specs || "")
                setPressSpecs(mfgData.press_specs || "")
                setPostpressSpecs(mfgData.postpress_specs || "")

                // Extra options
                setDesignNeeded(mfgData.design_needed || false)
                setFolioEnabled(mfgData.folio_enabled || false)
                setFolioStart(mfgData.folio_start || "")
                setPrintType(mfgData.print_type || null)

                // Files
                setExistingDesignFiles(mfgData.design_attachments || [])
                setDesignFiles([])
                setDesignApproved(mfgData.design_approved || false)
                setExistingApprovalFile(mfgData.approval_attachment || null)
                setApprovalFile(null)

            } else {
                setExistingDesignFiles([])
                setSelectedContact(null)
                setSaleLines([])
            }
        }
    }, [open, initialData, form])

    // Watch for Sale Order changes to fetch lines
    const watchedSaleOrder = form.watch('sale_order')

    useEffect(() => {
        if (watchedSaleOrder && watchedSaleOrder !== "__none__" && !initialData) {
            setLoadingLines(true)
            api.get(`/sales/orders/${watchedSaleOrder}/`).then(res => {
                const lines = res.data.lines || []
                // Filter lines:
                // 1. Must be MANUFACTURABLE
                // 2. Must require ADVANCED manufacturing (as requested)
                // 3. Must NOT have an existing OT
                const filtered = lines.filter((l: any) =>
                    l.product_type === 'MANUFACTURABLE' &&
                    (!l.work_order_summary)
                )
                setSaleLines(filtered)
            }).finally(() => setLoadingLines(false))
        } else {
            setSaleLines([])
        }
    }, [watchedSaleOrder, initialData])

    // When a sale line is selected, auto-fill details
    const watchedSaleLineId = form.watch('sale_line')
    useEffect(() => {
        if (watchedSaleLineId && !initialData) {
            const selectedLine = saleLines.find(l => l.id.toString() === watchedSaleLineId)
            if (selectedLine) {
                form.setValue('description', `OT: ${selectedLine.product_name || selectedLine.description}`)
                form.setValue('product_description', selectedLine.product_name || selectedLine.description)
                // Auto-fill Quantity and UoM for Sale-Linked (Read-Only later)
                form.setValue('quantity', selectedLine.quantity.toString())
                if (selectedLine.uom) {
                    form.setValue('uom_id', selectedLine.uom.toString())
                }
            }
        }
    }, [watchedSaleLineId, saleLines, initialData, form])

    // Manual Product Selection Handler
    const handleManualProductSelect = (product: any) => {
        setSelectedManualProduct(product)
        if (product) {
            form.setValue('product_description', product.name)
            form.setValue('description', `OT: ${product.name}`)
            // Default UoM
            if (product.uom?.id) {
                form.setValue('uom_id', product.uom.id.toString())
            }
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setDesignFiles(prev => [...prev, ...Array.from(e.target.files!)])
        }
    }

    const removeNewFile = (index: number) => {
        setDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    const removeExistingFile = (index: number) => {
        setExistingDesignFiles(prev => prev.filter((_, i) => i !== index))
    }

    async function onSubmit(data: WorkOrderFormValues) {
        setLoading(true)

        // Prepare stage_data structure
        const stage_data = {
            ...(initialData?.stage_data || {}),
            product_description: data.product_description,
            internal_notes: data.internal_notes,
            contact_id: selectedContact?.id,
            contact_name: selectedContact?.name,
            contact_tax_id: selectedContact?.tax_id,
            phases: {
                prepress: enablePrepress,
                press: enablePress,
                postpress: enablePostpress
            },
            prepress_specs: prepressSpecs,
            press_specs: pressSpecs,
            postpress_specs: postpressSpecs,
            design_needed: designNeeded,
            design_approved: designApproved,
            folio_enabled: folioEnabled,
            folio_start: folioStart,
            print_type: printType,
            design_attachments: [...existingDesignFiles, ...designFiles.map(f => f.name)],
            approval_attachment: existingApprovalFile
        }

        const formData = new FormData()
        formData.append('description', data.description)
        if (data.sale_order && data.sale_order !== "__none__" && data.sale_order !== "none") {
            formData.append('sale_order', data.sale_order)
        }
        if (data.start_date) {
            formData.append('start_date', format(data.start_date, 'yyyy-MM-dd'))
        }
        if (data.due_date) {
            formData.append('estimated_completion_date', format(data.due_date, 'yyyy-MM-dd'))
        }
        if (data.sale_line) {
            formData.append('sale_line', data.sale_line)
        }
        if (data.product_id) {
            formData.append('product_id', data.product_id)
        }
        if (data.quantity) {
            formData.append('quantity', data.quantity)
        }
        if (data.uom_id) {
            formData.append('uom_id', data.uom_id)
        }

        formData.append('stage_data', JSON.stringify(stage_data))

        // Append design files
        designFiles.forEach((file, index) => {
            formData.append(`design_file_${index}`, file)
        })

        // Append approval file
        if (approvalFile) {
            formData.append('approval_file', approvalFile)
        }

        try {
            if (initialData) {
                await api.put(`/production/orders/${initialData.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Orden de Trabajo actualizada correctamente")
            } else {
                await api.post('/production/orders/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
                toast.success("Orden de Trabajo creada correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving work order:", error)
            toast.error(error.response?.data?.detail || "Error al guardar la Orden de Trabajo")
        } finally {
            setLoading(false)
        }
    }

    const isAutoCreated = !!initialData?.sale_line
    const linkedSaleOrder = initialData?.sale_order

    // Helper for Status Badge
    const renderStatusBadge = () => {
        if (!initialData) return null

        const stageMap: Record<string, string> = {
            'MATERIAL_ASSIGNMENT': 'Asignación Materiales',
            'MATERIAL_APPROVAL': 'Aprobación Stock',
            'PREPRESS': 'Pre-Impresión',
            'PRESS': 'Impresión',
            'POSTPRESS': 'Post-Impresión',
            'FINISHED': 'Terminado',
            'CANCELLED': 'Anulado'
        }

        const statusMap: Record<string, string> = {
            'DRAFT': 'BORRADOR',
            'PLANNED': 'PLANIFICADA',
            'IN_PROGRESS': 'EN PROCESO',
            'FINISHED': 'TERMINADA',
            'CANCELLED': 'ANULADA'
        }

        return (
            <div className="flex items-center gap-2">
                <Badge variant={initialData.status === 'FINISHED' ? 'default' : initialData.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                    {statusMap[initialData.status] || initialData.status}
                </Badge>
                <Badge variant="outline" className="border-primary/20 text-primary">
                    {stageMap[initialData.current_stage] || initialData.current_stage}
                </Badge>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Orden de Trabajo</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <DialogTitle>
                                {initialData ? `Orden de Trabajo #${initialData?.number}` : "Crear Orden de Trabajo"}
                            </DialogTitle>
                            <DialogDescription className="text-primary font-medium flex items-center gap-2">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {form.getValues("start_date") ?
                                    `Inicio: ${format(form.getValues("start_date")!, "PPP", { locale: es })}` :
                                    "Fecha de inicio automática"}
                            </DialogDescription>
                        </div>
                        {renderStatusBadge()}
                    </div>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* 1. General Info & Link */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descripción / Título</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Impresión Folletos 1000u" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex flex-col gap-2">
                                {isAutoCreated ? (
                                    <div className="space-y-2">
                                        <Label className="text-sm">Vínculo de Venta</Label>
                                        <div className="p-3 bg-muted/40 rounded-md border text-sm flex items-center justify-between group">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-primary">
                                                        {initialData.sale_order_number ? `NV-${initialData.sale_order_number}` : "Sin NV"}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        - {initialData.sale_line.product?.name || initialData.sale_line.description}
                                                    </span>
                                                </div>
                                            </div>
                                            {linkedSaleOrder && (
                                                <Link href={`/sales/command-center?id=${linkedSaleOrder?.id || linkedSaleOrder}`} target="_blank" passHref>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <FormField
                                        control={form.control}
                                        name="sale_order"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nota de Venta (Opcional)</FormLabel>
                                                <FormControl>
                                                    <AdvancedSaleOrderSelector
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        disabled={!!initialData} // Lock in Edit Mode
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 1.5 Sale Line Selector / Display */}
                        {(!initialData || initialData?.sale_line || initialData?.is_manual || (watchedSaleOrder && watchedSaleOrder !== "__none__")) && (
                            <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5" /> Detalle de Producto en Venta
                                </Label>

                                {initialData ? (
                                    /* Edit Mode - Read Only */
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Producto</p>
                                            <p className="font-medium truncate">
                                                {initialData.sale_line
                                                    ? (initialData.sale_line.product?.name || initialData.sale_line.description)
                                                    : (initialData.product?.name || "Producto Manual")
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Cantidad</p>
                                            <p className="font-medium">
                                                {initialData.sale_line
                                                    ? `${initialData.sale_line.quantity} ${initialData.sale_line.uom?.name}`
                                                    : `${initialData.stage_data?.quantity || 0} ${initialData.stage_data?.uom_name || ""}`
                                                }
                                            </p>
                                        </div>
                                        {initialData.sale_order_delivery_date && (
                                            <div>
                                                <p className="text-xs text-muted-foreground uppercase font-semibold">F. Entrega Planificada</p>
                                                <p className="font-medium text-primary">
                                                    {format(new Date(initialData.sale_order_delivery_date + 'T12:00:00'), "dd/MM/yyyy")}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Progreso OT</p>
                                            <p className="font-medium">{initialData.production_progress}%</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Creation Mode - Selector */
                                    /* Creation Mode */
                                    <div className="space-y-6">

                                        {/* 2. OPTION A: Manual Creation (No Sale Order) OR Display for Option B */}
                                        {(!watchedSaleOrder || watchedSaleOrder === "__none__" || watchedSaleOrder === "none") ? (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-muted/10 p-4 rounded-lg border border-dashed">
                                                <div className="md:col-span-6">
                                                    <FormField
                                                        control={form.control}
                                                        name="product_id"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Producto a Fabricar (Stock)</FormLabel>
                                                                <FormControl>
                                                                    <ProductSelector
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        onSelect={handleManualProductSelect}
                                                                        productType="MANUFACTURABLE"
                                                                        disabled={!!initialData} // Lock in Edit Mode
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="quantity"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Cantidad</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" step="any" placeholder="0.00" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="uom_id"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">U. Medida</FormLabel>
                                                                <FormControl>
                                                                    <UoMSelector
                                                                        value={field.value || ""}
                                                                        onChange={field.onChange}
                                                                        uoms={uoms}
                                                                        categoryId={selectedManualProduct?.uom_category}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            /* When Sale Order is linked, show Quantity and UoM as READ-ONLY or disabled */
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-primary/5 p-4 rounded-lg border">
                                                <div className="md:col-span-6 opacity-60">
                                                    <FormItem>
                                                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Detalle de Producto (Vinculado)</FormLabel>
                                                        <FormControl>
                                                            <Input value={form.getValues('product_description')} disabled className="bg-muted" />
                                                        </FormControl>
                                                    </FormItem>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="quantity"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Cantidad</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        disabled
                                                                        className="bg-muted font-bold"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <FormField
                                                        control={form.control}
                                                        name="uom_id"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs uppercase font-bold text-muted-foreground">U. Medida</FormLabel>
                                                                <FormControl>
                                                                    <UoMSelector
                                                                        value={field.value || ""}
                                                                        onChange={field.onChange}
                                                                        uoms={uoms}
                                                                        disabled
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {/* OPTION B: Sale Line Selector (If Sale Order Linked) */}
                                        {watchedSaleOrder && watchedSaleOrder !== "__none__" && watchedSaleOrder !== "none" && (
                                            <div className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="sale_line"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Ítem de Venta a Fabricar</FormLabel>
                                                            <Select
                                                                onValueChange={field.onChange}
                                                                value={field.value}
                                                                disabled={!!initialData} // Lock in Edit Mode
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Seleccionar ítem..." />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {loadingLines ? (
                                                                        <SelectItem value="loading" disabled>Cargando líneas...</SelectItem>
                                                                    ) : saleLines.length === 0 ? (
                                                                        <SelectItem value="none" disabled>No hay ítems fabricables avanzados pendientes</SelectItem>
                                                                    ) : (
                                                                        saleLines.map((line) => (
                                                                            <SelectItem key={line.id} value={line.id.toString()}>
                                                                                {line.product_name || line.description} ({line.quantity} {line.uom_name})
                                                                            </SelectItem>
                                                                        ))
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                {watchedSaleLineId && (
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-background rounded border animate-in fade-in slide-in-from-top-1">
                                                        {(() => {
                                                            const l = saleLines.find(x => x.id.toString() === watchedSaleLineId)
                                                            if (!l) return null
                                                            return (
                                                                <>
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Cantidad</p>
                                                                        <p className="text-sm font-medium">{l.quantity} {l.uom_name}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Precio Unit.</p>
                                                                        <p className="text-sm font-medium">${parseFloat(l.unit_price).toLocaleString()}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Subtotal</p>
                                                                        <p className="text-sm font-bold text-primary">${parseFloat(l.subtotal).toLocaleString()}</p>
                                                                    </div>
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                            <FormField
                                control={form.control}
                                name="start_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Inicio</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP", { locale: es })
                                                        ) : (
                                                            <span>Elegir fecha</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value || undefined}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="due_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Entrega</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP", { locale: es })
                                                        ) : (
                                                            <span>Elegir fecha</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value || undefined}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* 3. Product & Contact */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                            <FormField
                                control={form.control}
                                name="product_description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            Descripción del Producto
                                        </FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ej: Trípticos 10x21cm, Papel Couche 170gr..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    Contacto / Referencia
                                </Label>
                                {selectedContact ? (
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <User className="h-4 w-4 text-primary shrink-0" />
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm truncate font-medium">{selectedContact.name}</span>
                                                {selectedContact.tax_id && <span className="text-xs text-muted-foreground">{selectedContact.tax_id}</span>}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                setSelectedContact(null)
                                                form.setValue('contact_id', "")
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <AdvancedContactSelector
                                        onSelectContact={(c) => {
                                            setSelectedContact(c)
                                            form.setValue('contact_id', c.id.toString())
                                        }}
                                        onChange={() => { }}
                                        placeholder="Buscar contacto..."
                                    />
                                )}
                            </div>
                        </div>

                        {/* 4. Manufacturing Details */}
                        <div className="space-y-4">
                            <Label className="uppercase text-xs font-bold text-muted-foreground">Detalles de Producción</Label>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Pre-Press */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePrepress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Paintbrush className="h-4 w-4 text-muted-foreground" /> Pre-Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePrepress}
                                            onCheckedChange={setEnablePrepress}
                                            className="scale-75"
                                        />
                                    </div>
                                    {enablePrepress && (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Especificaciones</Label>
                                                <Textarea
                                                    value={prepressSpecs}
                                                    onChange={e => setPrepressSpecs(e.target.value)}
                                                    className="min-h-[60px] text-xs"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between p-2 rounded bg-background border">
                                                <Label className="text-xs">Diseño Requerido</Label>
                                                <Switch checked={designNeeded} onCheckedChange={setDesignNeeded} className="scale-75" />
                                            </div>
                                            {(designNeeded || existingDesignFiles.length > 0) && (
                                                <div className="space-y-3 pt-2 border-t">
                                                    <div className="space-y-2">
                                                        {existingDesignFiles.length > 0 && (
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Archivos del Checkout</Label>
                                                                {existingDesignFiles.map((file, idx) => (
                                                                    <div key={`existing-${idx}`} className="flex items-center justify-between p-1.5 bg-primary/5 rounded text-xs border border-primary/10">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <FileIcon className="h-3 w-3 shrink-0 text-primary" />
                                                                            <span className="truncate font-medium">{file}</span>
                                                                        </div>
                                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => removeExistingFile(idx)}>
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="space-y-1">
                                                            {designFiles.length > 0 && <Label className="text-[10px] uppercase text-muted-foreground font-bold">Nuevos Archivos</Label>}
                                                            {designFiles.map((file, idx) => (
                                                                <div key={`new-${idx}`} className="flex items-center justify-between p-1.5 bg-background rounded text-xs border">
                                                                    <div className="flex items-center gap-2 truncate">
                                                                        <Upload className="h-3 w-3 shrink-0" />
                                                                        <span className="truncate">{file.name}</span>
                                                                    </div>
                                                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeNewFile(idx)}>
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <label className="flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline p-1 w-fit">
                                                            <Plus className="h-3 w-3" /> Agregar archivo
                                                            <input type="file" multiple className="hidden" onChange={handleFileChange} />
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {designNeeded && (
                                                <div className="flex items-center justify-between p-2 rounded bg-background border">
                                                    <Label className="text-xs">Diseño aprobado por el cliente</Label>
                                                    <Switch checked={designApproved} onCheckedChange={setDesignApproved} className="scale-75" />
                                                </div>
                                            )}

                                            {designNeeded && designApproved && (
                                                <div className="space-y-2 p-2 rounded bg-green-50/50 border border-green-100">
                                                    <Label className="text-[10px] uppercase text-green-700 font-bold">Evidencia de Aprobación</Label>
                                                    {existingApprovalFile && (
                                                        <div className="flex items-center justify-between p-1.5 bg-white rounded text-xs border border-green-100 mb-2">
                                                            <div className="flex items-center gap-2 truncate text-green-700">
                                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                                <span className="truncate font-medium">{existingApprovalFile}</span>
                                                            </div>
                                                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => setExistingApprovalFile(null)}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <label className="flex items-center gap-2 p-2 border border-dashed border-green-200 rounded cursor-pointer hover:bg-green-50 transition-colors">
                                                        <Upload className="h-3 w-3 text-green-600" />
                                                        <span className="text-[10px] text-green-700">{approvalFile ? approvalFile.name : "Cargar evidencia"}</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={(e) => setApprovalFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between p-2 rounded bg-background border">
                                                <Label className="text-xs">Folio</Label>
                                                <Switch checked={folioEnabled} onCheckedChange={setFolioEnabled} className="scale-75" />
                                            </div>
                                            {folioEnabled && (
                                                <Input
                                                    placeholder="N° Inicial"
                                                    value={folioStart}
                                                    onChange={e => setFolioStart(e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Press */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Printer className="h-4 w-4 text-muted-foreground" /> Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePress}
                                            onCheckedChange={setEnablePress}
                                            className="scale-75"
                                        />
                                    </div>
                                    {enablePress && (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Especificaciones</Label>
                                                <Textarea
                                                    value={pressSpecs}
                                                    onChange={e => setPressSpecs(e.target.value)}
                                                    className="min-h-[60px] text-xs"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                {['offset', 'digital', 'especial'].map(type => (
                                                    <Button
                                                        key={type}
                                                        type="button"
                                                        variant={printType === type ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-7 text-[10px] capitalize"
                                                        onClick={() => setPrintType(type)}
                                                    >
                                                        {type}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Post-Press */}
                                <div className={cn("space-y-3 p-4 rounded-lg border transition-colors", enablePostpress ? "bg-muted/20 border-primary/20" : "bg-muted/5 opacity-70")}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" /> Post-Impresión
                                        </h4>
                                        <Switch
                                            checked={enablePostpress}
                                            onCheckedChange={setEnablePostpress}
                                            className="scale-75"
                                        />
                                    </div>
                                    {enablePostpress && (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Especificaciones</Label>
                                                <Textarea
                                                    value={postpressSpecs}
                                                    onChange={e => setPostpressSpecs(e.target.value)}
                                                    placeholder="Acabados, laminado, troquel, etc."
                                                    className="min-h-[60px] text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Internal Notes */}
                        <FormField
                            control={form.control}
                            name="internal_notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas Internas (No visible para cliente)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Observaciones para el equipo de producción..."
                                            className="h-20"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end space-x-2 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear OT"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    )
}
