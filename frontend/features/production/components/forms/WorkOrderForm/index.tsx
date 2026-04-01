"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, FileText } from "lucide-react"
import { format } from "date-fns"

import { BaseModal } from "@/components/shared/BaseModal"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

import { cn, translateStatus } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import api from "@/lib/api"
import { toast } from "sonner"

import { WorkOrderBasicInfo } from "./WorkOrderBasicInfo"
import { WorkOrderMaterials } from "./WorkOrderMaterials"
import { workOrderSchema, type WorkOrderFormValues, type WorkOrderInitialData } from "@/types/forms"

interface WorkOrderFormProps {
    onSuccess?: () => void
    initialData?: WorkOrderInitialData
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerVariant?: "default" | "circular"
}

export function WorkOrderForm({ onSuccess, initialData, open: openProp, onOpenChange, triggerVariant = "default" }: WorkOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [otType, setOtType] = useState<"LINKED" | "NONE" | null>(null)
    const [loading, setLoading] = useState(false)
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

    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [selectedManualProduct, setSelectedManualProduct] = useState<any>(null)

    const form = useForm<WorkOrderFormValues>({
        resolver: zodResolver(workOrderSchema),
        defaultValues: {
            description: "",
            sale_order: "",
            start_date: new Date(),
            due_date: null,
            product_description: "",
            internal_notes: "",
            contact_id: "",
            sale_line: "",
            product_id: "",
            quantity: "",
            uom_id: "",
        },
    })

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
            fetchUoMs()
            if (initialData) {
                form.reset({
                    description: initialData.description || "",
                    sale_order: typeof initialData.sale_order === 'object' ? String(initialData.sale_order?.id || '') : String(initialData.sale_order || ""),
                    start_date: initialData.start_date ? new Date(initialData.start_date) : new Date(),
                    due_date: initialData.estimated_completion_date ? new Date(initialData.estimated_completion_date) : (initialData.sale_order_delivery_date ? new Date(initialData.sale_order_delivery_date) : null),
                    product_description: initialData.stage_data?.product_description || "",
                    internal_notes: initialData.stage_data?.internal_notes || "",
                    contact_id: initialData.stage_data?.contact_id?.toString() || "",
                    sale_line: typeof initialData.sale_line === 'object' ? String(initialData.sale_line?.id || "") : String(initialData.sale_line || ""),
                    product_id: initialData.product?.id?.toString() || "",
                    quantity: initialData.stage_data?.quantity?.toString() || "",
                    uom_id: initialData.stage_data?.uom_id?.toString() || "",
                })

                setOtType(initialData.sale_order ? "LINKED" : "NONE")

                if (initialData.product) {
                    setSelectedManualProduct(initialData.product)
                }

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

                setDesignNeeded(mfgData.design_needed || false)
                setFolioEnabled(mfgData.folio_enabled || false)
                setFolioStart(mfgData.folio_start || "")
                setPrintType(mfgData.print_type || null)

                setExistingDesignFiles(mfgData.design_attachments || [])
                setDesignFiles([])

            } else {
                setExistingDesignFiles([])
                setSelectedContact(null)
                setSaleLines([])
                setOtType(null)
            }
        }
    }, [open, initialData, form])

    // Watch for Sale Order changes to fetch lines
    const watchedSaleOrder = form.watch('sale_order')

    useEffect(() => {
        if (watchedSaleOrder && watchedSaleOrder !== "__none__" && !initialData?.id) {
            setLoadingLines(true)
            api.get(`/sales/orders/${watchedSaleOrder}/`).then(res => {
                const lines = res.data.lines || []
                const filtered = lines.filter((l: any) =>
                    l.product_type === 'MANUFACTURABLE' &&
                    l.requires_advanced_manufacturing &&
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
        if (watchedSaleLineId && !initialData?.id) {
            const selectedLine = saleLines.find(l => l.id.toString() === watchedSaleLineId)
            if (selectedLine) {
                form.setValue('description', `OT: ${selectedLine.product_name || selectedLine.description}`)
                form.setValue('product_description', selectedLine.product_name || selectedLine.description)
                form.setValue('quantity', selectedLine.quantity.toString())
                if (selectedLine.uom) {
                    form.setValue('uom_id', selectedLine.uom.toString())
                }
            }
        }
    }, [watchedSaleLineId, saleLines, initialData, form])

    const handleManualProductSelect = (product: any) => {
        setSelectedManualProduct(product)
        if (product) {
            form.setValue('product_description', product.name)
            form.setValue('description', `OT: ${product.name}`)
            if (product.uom?.id) {
                form.setValue('uom_id', product.uom.id.toString())
            }
        }
    }

    async function onSubmit(data: WorkOrderFormValues) {
        if (selectedManualProduct?.requires_bom_validation) {
            toast.error(`El producto "${selectedManualProduct.name}" requiere una Lista de Materiales asignada antes de fabricar.`)
            return
        }

        setLoading(true)

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
            folio_enabled: folioEnabled,
            folio_start: folioStart,
            print_type: printType,
            design_attachments: [...existingDesignFiles, ...designFiles.map(f => f.name)],
            quantity: data.quantity,
            uom_id: data.uom_id
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
        if (selectedContact?.id) {
            formData.append('related_contact', selectedContact.id.toString())
        }

        formData.append('stage_data', JSON.stringify(stage_data))
        if (otType === "NONE") {
            formData.append('is_manual', 'true')
        }

        designFiles.forEach((file, index) => {
            formData.append(`design_file_${index}`, file)
        })

        try {
            if (initialData?.id) {
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
            const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Error al guardar la Orden de Trabajo"
            toast.error(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    const isAutoCreated = !!initialData?.sale_line
    const linkedSaleOrder = initialData?.sale_order

    const renderStatusBadge = () => {
        if (!initialData) return null
        return (
            <div className="flex items-center gap-2">
                <Badge variant={initialData.status === 'FINISHED' ? 'default' : initialData.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                    {translateStatus(initialData.status as string)}
                </Badge>
                {initialData.current_stage && (
                    <Badge variant="outline" className="border-primary/20 text-primary uppercase">
                        {translateStatus(initialData.current_stage)}
                    </Badge>
                )}
            </div>
        )
    }

    return (
        <>
            {!initialData && (
                triggerVariant === "circular" ? (
                    <Button size="icon" className="rounded-full h-8 w-8" onClick={() => setOpen(true)} title="Nueva OT">
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button onClick={() => setOpen(true)}>Nueva Orden de Trabajo</Button>
                )
            )}
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="full"
                className="max-w-[1000px]"
                title={
                    <div className="flex items-center justify-between w-full pr-8">
                        <div className="space-y-1">
                            <div className="text-xl font-bold">
                                {initialData ? `Orden de Trabajo #${initialData?.number}` : "Crear Orden de Trabajo"}
                            </div>
                        </div>
                        {renderStatusBadge()}
                    </div>
                }
                headerActions={
                    !initialData && otType && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-8 px-3 text-muted-foreground uppercase font-black tracking-widest bg-muted/30 hover:bg-muted/50 border border-muted-foreground/10"
                            onClick={() => {
                                setOtType(null)
                                form.reset()
                            }}
                        >
                            Cambiar Tipo
                        </Button>
                    )
                }
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            form="work-order-form"
                            type="submit"
                            disabled={loading || (otType === "NONE" && !form.watch('product_id') && !initialData)}
                        >
                            {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Orden"}
                        </Button>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="work-order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

                        {/* Initial Choice - Compact */}
                        {!initialData && !otType && (
                            <div className="flex flex-col items-center justify-center space-y-4 py-8 max-w-md mx-auto">
                                <div className="text-center space-y-1 mb-2">
                                    <h3 className="text-lg font-bold">¿Qué tipo de orden desea crear?</h3>
                                    <p className="text-sm text-muted-foreground">Seleccione el flujo de trabajo para esta orden.</p>
                                </div>
                                <div className="grid grid-cols-1 w-full gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-16 justify-start px-4 gap-4 hover:border-primary hover:bg-primary/5 group transition-colors"
                                        onClick={() => setOtType("LINKED")}
                                    >
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="font-bold text-sm">Vinculada a Venta</span>
                                            <span className="text-[10px] text-muted-foreground font-normal truncate">Productos vendidos en una Nota de Venta</span>
                                        </div>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-16 justify-start px-4 gap-4 hover:border-warning hover:bg-warning/10 group transition-colors"
                                        onClick={() => setOtType("NONE")}
                                    >
                                        <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <Plus className="h-5 w-5 text-warning" />
                                        </div>
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="font-bold text-sm">Producción Stock (Manual)</span>
                                            <span className="text-[10px] text-muted-foreground font-normal truncate">Fabricar para inventario o sin venta directa</span>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        )}

                        {otType && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
                                {/* Componente extraído: Basic Info */}
                                <WorkOrderBasicInfo
                                    otType={otType}
                                    initialData={initialData}
                                    isAutoCreated={isAutoCreated}
                                    linkedSaleOrder={linkedSaleOrder}
                                    saleLines={saleLines}
                                    loadingLines={loadingLines}
                                    uoms={uoms}
                                    selectedContact={selectedContact}
                                    setSelectedContact={setSelectedContact}
                                    selectedManualProduct={selectedManualProduct}
                                    handleManualProductSelect={handleManualProductSelect}
                                    watchedSaleOrder={watchedSaleOrder}
                                    watchedSaleLineId={watchedSaleLineId}
                                />

                                {otType === "LINKED" && (
                                    <WorkOrderMaterials
                                        enablePrepress={enablePrepress} setEnablePrepress={setEnablePrepress}
                                        enablePress={enablePress} setEnablePress={setEnablePress}
                                        enablePostpress={enablePostpress} setEnablePostpress={setEnablePostpress}
                                        prepressSpecs={prepressSpecs} setPrepressSpecs={setPrepressSpecs}
                                        pressSpecs={pressSpecs} setPressSpecs={setPressSpecs}
                                        postpressSpecs={postpressSpecs} setPostpressSpecs={setPostpressSpecs}
                                        designNeeded={designNeeded} setDesignNeeded={setDesignNeeded}
                                        designFiles={designFiles} setDesignFiles={setDesignFiles}
                                        existingDesignFiles={existingDesignFiles} setExistingDesignFiles={setExistingDesignFiles}
                                        folioEnabled={folioEnabled} setFolioEnabled={setFolioEnabled}
                                        folioStart={folioStart} setFolioStart={setFolioStart}
                                        printType={printType} setPrintType={setPrintType}
                                    />
                                )}

                                {/* Notas Internas */}
                                <FormField
                                    control={form.control}
                                    name="internal_notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={FORM_STYLES.label}>Notas Internas (No visible para cliente)</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Observaciones para el equipo de producción..." className={cn(FORM_STYLES.input, "h-20 py-2")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}
