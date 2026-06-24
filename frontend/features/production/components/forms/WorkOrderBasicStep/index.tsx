"use client"
import { formatPlainDate, toDate } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"

import { Form, FormField } from "@/components/ui/form"

import { toast } from "sonner"

import { WorkOrderBasicInfo } from "./WorkOrderBasicInfo"
import { OriginSelectionStep } from "../../steps/OriginSelectionStep"
import { ManufacturingSpecsEditor, emptyManufacturingData, type ManufacturingData } from '@/components/shared'
import {workOrderSchema, type WorkOrderFormValues, type WorkOrderInitialData } from "@/types/forms"
import { LabeledInput, SkeletonShell } from "@/components/shared"
import type { Contact } from "@/features/contacts/types"
import type { ProductMinimal } from "../../../types"
import {
    useUoMs,
    useProductDetail,
    useActiveBom,
    useSaleOrderManufacturableLines,
    productionApi,
} from "../../../hooks"
import type { WorkOrderBasicStepProps } from "./types"

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

const FORM_DEFAULT_ID = "work-order-basic-form"

export function WorkOrderBasicStep({
    mode,
    initialData,
    defaultOtType,
    defaultProductId,
    chosenOtType,
    onSuccess,
    formId = FORM_DEFAULT_ID,
    onLoadingChange,
}: WorkOrderBasicStepProps) {
    const [otType, setOtType] = useState<"LINKED" | "NONE" | null>(
        chosenOtType !== undefined
            ? chosenOtType
            : (initialData ? (initialData.sale_order ? "LINKED" : "NONE") : (defaultOtType || null))
    )
    const [loading, setLoading] = useState(false)
    const [mfgData, setMfgData] = useState<ManufacturingData>(emptyManufacturingData())
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [selectedManualProduct, setSelectedManualProduct] = useState<ProductMinimal | null>(null)

    const idempotencyKeyRef = useRef<string>(generateUUID())

    useEffect(() => {
        if (mode === 'create') {
            idempotencyKeyRef.current = generateUUID()
        }
    }, [mode])

    const form = useForm<WorkOrderFormValues>({
        resolver: zodResolver(workOrderSchema) as unknown as Resolver<WorkOrderFormValues>,
        defaultValues: {} as WorkOrderFormValues,
    })

    useEffect(() => {
        if (chosenOtType !== undefined) {
            setOtType(chosenOtType)
            if (chosenOtType === "LINKED") {
                form.reset({
                    otType: "LINKED",
                    description: "",
                    sale_order: "",
                    sale_line: "",
                    product_description: "",
                    contact_id: "",
                    start_date: new Date(),
                    due_date: null,
                    internal_notes: "",
                } as WorkOrderFormValues)
            } else if (chosenOtType === "NONE") {
                form.reset({
                    otType: "NONE",
                    description: "",
                    product_id: "",
                    quantity: "",
                    uom_id: "",
                    start_date: new Date(),
                    due_date: null,
                    internal_notes: "",
                } as WorkOrderFormValues)
            } else if (chosenOtType === null) {
                form.reset({} as WorkOrderFormValues)
            }
        }
    }, [chosenOtType, form])

    const { data: uoms = [], isLoading: isUoMsLoading } = useUoMs()

    const { data: defaultProductData, isLoading: isProductDetailLoading } = useProductDetail(defaultProductId, {
        enabled: otType === "NONE",
    })

    // 'product_id' only exists in NONE branch; cast is safe
    const watchedProductId = form.watch('product_id' as never) as unknown as string | undefined
    const { data: activeBom, isLoading: isBomLoading } = useActiveBom(watchedProductId)

    useEffect(() => {
        if (!activeBom) return
        const total = (activeBom.estimated_prepress_min ?? 0) + (activeBom.estimated_press_min ?? 0) + (activeBom.estimated_postpress_min ?? 0)
        if (total <= 0) return
        const startDate = form.getValues('start_date') ?? new Date()
        const suggested = new Date(startDate)
        suggested.setMinutes(suggested.getMinutes() + total)
        if (!form.getValues('due_date')) {
            form.setValue('due_date', suggested)
            toast.info(`Fecha de entrega sugerida: ${formatPlainDate(suggested)} (${Math.ceil(total / 60)}h según BOM)`)
        }
    }, [activeBom])

    useEffect(() => {
        if (defaultProductData && !selectedManualProduct && !initialData) {
            handleManualProductSelect(defaultProductData as any)
            form.setValue('product_id' as never, String(defaultProductData.id) as never)
        }
    }, [defaultProductData, selectedManualProduct, initialData, form])

    // Reset form when initialData changes (or on first mount)
    const lastResetId = useRef<symbol | string | number>(Symbol('uninitialized'))

    useEffect(() => {
        const currentId = initialData?.id
        if ((currentId as symbol | string | number | undefined) === lastResetId.current) return
        lastResetId.current = currentId ?? Symbol('create')

        if (initialData) {
            const isLinked = !!initialData.sale_order
            form.reset({
                otType: isLinked ? "LINKED" : "NONE",
                description: initialData.description || "",
                ...(isLinked ? {
                    sale_order: typeof initialData.sale_order === 'object' ? String(initialData.sale_order?.id || '') : String(initialData.sale_order || ""),
                    sale_line: typeof initialData.sale_line === 'object' ? String(initialData.sale_line?.id || "") : String(initialData.sale_line || ""),
                    product_description: initialData.stage_data?.product_description || "",
                    contact_id: initialData.stage_data?.contact_id?.toString() || "",
                } : {
                    product_id: initialData.product?.id?.toString() || "",
                    quantity: initialData.stage_data?.quantity?.toString() || "",
                    uom_id: initialData.stage_data?.uom_id?.toString() || "",
                }),
                start_date: initialData.start_date ? toDate(initialData.start_date) : new Date(),
                due_date: initialData.estimated_completion_date
                    ? toDate(initialData.estimated_completion_date)
                    : (initialData.sale_order_delivery_date ? toDate(initialData.sale_order_delivery_date) : null),
                internal_notes: initialData.stage_data?.internal_notes || "",
            } as WorkOrderFormValues)

            setOtType(isLinked ? "LINKED" : "NONE")

            if (initialData.product) {
                setSelectedManualProduct(initialData.product as any)
            }

            const stageData = initialData.stage_data || {}
            if (stageData.contact_id) {
                setSelectedContact({
                    id: Number(stageData.contact_id),
                    name: stageData.contact_name || "Contacto",
                    tax_id: stageData.contact_tax_id || ""
                } as any)
            } else {
                setSelectedContact(null)
            }

            setMfgData({
                phases: {
                    prepress: stageData.phases?.prepress || false,
                    press: stageData.phases?.press || false,
                    postpress: stageData.phases?.postpress || false,
                },
                specifications: {
                    prepress: stageData.prepress_specs || (stageData as any).specifications?.prepress || '',
                    press: stageData.press_specs || (stageData as any).specifications?.press || '',
                    postpress: stageData.postpress_specs || (stageData as any).specifications?.postpress || '',
                },
                design_needed: stageData.design_needed || false,
                design_files: [],
                existing_design_files: stageData.design_attachments || [],
                folio_enabled: stageData.folio_enabled || false,
                folio_start: stageData.folio_start || '',
                print_type: (stageData.print_type as any) || null,
                internal_notes: stageData.internal_notes || '',
                product_description: stageData.product_description || '',
            })
        } else {
            setMfgData(emptyManufacturingData())
            setSelectedContact(null)
            setOtType(chosenOtType !== undefined ? chosenOtType : (defaultOtType || null))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData])

    // 'sale_order'/'sale_line' only exist in LINKED branch; cast is safe
    const watchedSaleOrder = form.watch('sale_order' as never) as unknown as string | undefined
    const { data: saleLines = [], isLoading: loadingLines } = useSaleOrderManufacturableLines(
        watchedSaleOrder,
        { enabled: !initialData?.id }
    )

    const watchedSaleLineId = form.watch('sale_line' as never) as unknown as string | undefined
    useEffect(() => {
        if (watchedSaleLineId && !initialData?.id) {
            const selectedLine = saleLines.find(l => l.id?.toString() === watchedSaleLineId)
            if (selectedLine) {
                form.setValue('product_description' as never, (selectedLine.product_name || selectedLine.description) as never)
                form.setValue('quantity' as never, selectedLine.quantity.toString() as never)
                if (selectedLine.uom) {
                    form.setValue('uom_id' as never, selectedLine.uom.toString() as never)
                }
            }
        }
    }, [watchedSaleLineId, saleLines, initialData, form])

    const handleManualProductSelect = (product: ProductMinimal) => {
        setSelectedManualProduct(product)
        if (product) {
            form.setValue('product_description' as never, product.name as never)
            if (product.uom && typeof product.uom === 'object' && 'id' in product.uom) {
                form.setValue('uom_id' as never, product.uom.id.toString() as never)
            }
        }
    }

    const handleLoadingChange = (value: boolean) => {
        setLoading(value)
        onLoadingChange?.(value)
    }

    async function onSubmit(data: WorkOrderFormValues) {
        if (data.otType === 'NONE' && selectedManualProduct?.requires_bom_validation) {
            toast.error(`El producto "${selectedManualProduct.name}" requiere una Lista de Materiales asignada antes de fabricar.`)
            return
        }

        handleLoadingChange(true)

        const commonStageData = {
            ...(initialData?.stage_data || {}),
            internal_notes: data.internal_notes,
            contact_id: selectedContact?.id,
            contact_name: selectedContact?.name,
            contact_tax_id: selectedContact?.tax_id,
            phases: mfgData.phases,
            specifications: mfgData.specifications,
            prepress_specs: mfgData.specifications.prepress,
            press_specs: mfgData.specifications.press,
            postpress_specs: mfgData.specifications.postpress,
            design_needed: mfgData.design_needed,
            folio_enabled: mfgData.folio_enabled,
            folio_start: mfgData.folio_start,
            print_type: mfgData.print_type,
            design_attachments: [...mfgData.existing_design_files, ...mfgData.design_files.map(f => f.name)],
        }

        const formData = new FormData()
        formData.append('description', data.description || '')
        if (data.start_date) formData.append('start_date', format(data.start_date, 'yyyy-MM-dd'))
        if (data.due_date) formData.append('estimated_completion_date', format(data.due_date, 'yyyy-MM-dd'))
        if (selectedContact?.id) formData.append('related_contact', selectedContact.id.toString())

        if (data.otType === 'LINKED') {
            formData.append('stage_data', JSON.stringify({ ...commonStageData, product_description: data.product_description }))
            if (data.sale_order && data.sale_order !== "__none__" && data.sale_order !== "none") {
                formData.append('sale_order', data.sale_order)
            }
            if (data.sale_line) formData.append('sale_line', data.sale_line)
        } else {
            formData.append('stage_data', JSON.stringify({ ...commonStageData, quantity: data.quantity, uom_id: data.uom_id }))
            if (data.product_id) formData.append('product_id', data.product_id)
            if (data.quantity) formData.append('quantity', data.quantity)
            if (data.uom_id) formData.append('uom_id', data.uom_id)
            formData.append('is_manual', 'true')
        }

        mfgData.design_files.forEach((file, index) => {
            formData.append(`design_file_${index}`, file)
        })

        try {
            let workOrderId: number
            if (initialData?.id) {
                await productionApi.updateWorkOrder(Number(initialData.id), formData)
                toast.success("Orden de Trabajo actualizada correctamente")
                workOrderId = Number(initialData.id)
            } else {
                const data = await productionApi.createWorkOrder(formData, {
                    'Idempotency-Key': idempotencyKeyRef.current,
                })
                toast.success("Orden de Trabajo creada correctamente")
                workOrderId = (data as { id: number }).id
            }
            form.reset({} as WorkOrderFormValues)
            setOtType(null)
            onSuccess?.(workOrderId)
        } catch (error: unknown) {
            console.error("Error saving work order:", error)
            toast.error(getErrorMessage(error) || "Error al guardar la Orden de Trabajo")
        } finally {
            handleLoadingChange(false)
        }
    }

    const isFetchingInitialData = isUoMsLoading || (!!defaultProductId && otType === "NONE" && isProductDetailLoading) || loadingLines || isBomLoading
    const isAutoCreated = !!initialData?.sale_line
    const linkedSaleOrder = initialData?.sale_order
    const isViewMode = mode === 'view'

    return (
        <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de orden de trabajo">
        <Form {...form}>
            <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                <fieldset disabled={isViewMode} className="block border-0 p-0 m-0 min-w-0">
                    {mode === 'create' && !chosenOtType && !otType && (
                        <OriginSelectionStep
                            onChoose={(type, defaults) => {
                                setOtType(type)
                                form.reset(defaults)
                            }}
                        />
                    )}

                    {otType && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
                            <WorkOrderBasicInfo
                                initialData={initialData as any}
                                isAutoCreated={isAutoCreated}
                                linkedSaleOrder={linkedSaleOrder as any}
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

                            <ManufacturingSpecsEditor
                                value={mfgData}
                                onChange={setMfgData}
                            />

                            <FormField
                                control={form.control}
                                name="internal_notes"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Notas Internas (No visible para cliente)"
                                        as="textarea"
                                        placeholder="Observaciones para el equipo de producción..."
                                        className="h-24 bg-transparent border-border/40 focus:border-primary/40"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )}
                            />
                        </div>
                    )}
                </fieldset>
            </form>
        </Form>
        </SkeletonShell>
    )
}

