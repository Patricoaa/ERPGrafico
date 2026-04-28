"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, LabeledInput, FormFooter, FormSplitLayout, LabeledContainer } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Ruler, ChevronDown, Search, Check, Plus } from "lucide-react"
import { SubmitButton } from "@/components/shared/ActionButtons"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { useUoMs, type UoM } from "@/features/inventory/hooks/useUoMs"
import { UoMCategoryForm, type UoMCategory } from "./UoMCategoryForm"
import { cn } from "@/lib/utils"

const uomSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    category: z.number({ required_error: "La categoría es requerida" }).min(1, "La categoría es requerida"),
    uom_type: z.enum(["REFERENCE", "BIGGER", "SMALLER"], { required_error: "El tipo es requerido" }),
    ratio: z.coerce.number().min(0.00001, "El ratio debe ser mayor a 0").optional(),
})

type UoMFormValues = z.infer<typeof uomSchema>

interface UoMFormProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Partial<UoM>
    onSuccess?: () => void
}

export function UoMForm({ open: openProp, onOpenChange, initialData, onSuccess }: UoMFormProps) {
    const [openState, setOpenState] = useState(false)
    const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const { categories, saveUoM, isSaving, refetch } = useUoMs()

    const form = useForm<UoMFormValues>({
        resolver: zodResolver(uomSchema),
        defaultValues: {
            name: "",
            category: undefined,
            uom_type: undefined,
            ratio: undefined,
        },
    })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            if (initialData && Object.keys(initialData).length > 0) {
                form.reset({
                    name: initialData.name || "",
                    category: initialData.category,
                    uom_type: initialData.uom_type,
                    ratio: initialData.ratio ? parseFloat(initialData.ratio) : undefined,
                })
            } else {
                form.reset({
                    name: "",
                    category: undefined,
                    uom_type: undefined,
                    ratio: undefined,
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, form])

    async function onSubmit(data: UoMFormValues) {
        try {
            await saveUoM({
                id: initialData?.id,
                ...data,
                ratio: data.uom_type === 'REFERENCE' ? '1.0' : String(data.ratio)
            })
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving UoM:", error)
            showApiError(error, "Error al guardar la unidad de medida")
        }
    }

    const handleCategoryCreated = (category?: UoMCategory) => {
        setIsCreateCategoryOpen(false)
        if (category) {
            refetch()
            form.setValue("category", category.id)
        }
    }

    const watchType = form.watch("uom_type")

    return (
        <>
        <BaseModal
            open={open}
            onOpenChange={setOpen}
            size={initialData?.id ? "lg" : "sm"}
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                    <span>{initialData?.id ? "Editar Unidad de Medida" : "Nueva Unidad de Medida"}</span>
                </div>
            }
            description={initialData?.id ? "Modifique los parámetros de conversión y consulte el historial." : "Configure el nombre, categoría y ratio de conversión."}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => setOpen(false)} disabled={isSaving} />
                            <SubmitButton form="uom-form" loading={isSaving}>
                                Guardar Unidad
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                sidebar={initialData?.id ? (
                    <ActivitySidebar
                        entityId={initialData.id}
                        entityType="uom"
                    />
                ) : undefined}
                showSidebar={!!initialData?.id}
            >
                <Form {...form}>
                    <form 
                        id="uom-form" 
                        onSubmit={form.handleSubmit(onSubmit)} 
                        className="space-y-6 px-4 pb-4 pt-2"
                    >
                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field, fieldState }) => (
                                    <LabeledInput
                                        label="Nombre de Unidad"
                                        required
                                        placeholder="Ej: Kilogramo, Metro, Litro"
                                        error={fieldState.error?.message}
                                        {...field}
                                    />
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field, fieldState }) => (
                                        <LabeledContainer 
                                            label="Categoría" 
                                            required
                                            error={fieldState.error?.message}
                                            suffix={<ChevronDown className="h-4 w-4 opacity-50" />}
                                        >
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        role="combobox"
                                                        className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                    >
                                                        {field.value
                                                            ? categories?.find(cat => cat.id === field.value)?.name
                                                            : "Seleccionar categoría..."}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                    <div className="p-2">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex-1 flex items-center px-3 border rounded-md bg-background">
                                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                <input
                                                                    className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                    placeholder="Buscar categoría..."
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.toLowerCase()
                                                                        const items = document.querySelectorAll('.category-item')
                                                                        items.forEach((el) => {
                                                                            if (el.textContent?.toLowerCase().includes(val)) {
                                                                                (el as HTMLElement).style.display = 'flex'
                                                                            } else {
                                                                                (el as HTMLElement).style.display = 'none'
                                                                            }
                                                                        })
                                                                    }}
                                                                />
                                                            </div>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-9 w-9 shrink-0 border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                                                                            onClick={() => {
                                                                                document.body.click()
                                                                                setIsCreateCategoryOpen(true)
                                                                            }}
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Crear nueva categoría</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                            {categories?.map((cat) => (
                                                                <div
                                                                    key={cat.id}
                                                                    className={cn(
                                                                        "category-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                        field.value === cat.id && "bg-accent"
                                                                    )}
                                                                    onClick={() => {
                                                                        field.onChange(cat.id)
                                                                        document.body.click()
                                                                    }}
                                                                >
                                                                    <span>{cat.name}</span>
                                                                    {field.value === cat.id && (
                                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </LabeledContainer>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="uom_type"
                                    render={({ field, fieldState }) => (
                                        <LabeledContainer 
                                            label="Tipo de Unidad" 
                                            required
                                            error={fieldState.error?.message}
                                            suffix={<ChevronDown className="h-4 w-4 opacity-50" />}
                                        >
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        role="combobox"
                                                        className={cn("w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent", !field.value && "text-muted-foreground")}
                                                    >
                                                        {field.value === 'REFERENCE' ? 'Referencia (Base)' :
                                                            field.value === 'BIGGER' ? 'Más Grande que base' :
                                                                field.value === 'SMALLER' ? 'Más Pequeña que base' :
                                                                    "Seleccionar tipo..."}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                    <div className="p-2">
                                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                            {[
                                                                { value: 'REFERENCE', label: 'Referencia (Base de la categoría)' },
                                                                { value: 'BIGGER', label: 'Más Grande que la base' },
                                                                { value: 'SMALLER', label: 'Más Pequeña que la base' }
                                                            ].map((opt) => (
                                                                <div
                                                                    key={opt.value}
                                                                    className={cn(
                                                                        "type-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                        field.value === opt.value && "bg-accent"
                                                                    )}
                                                                    onClick={() => {
                                                                        field.onChange(opt.value)
                                                                        document.body.click()
                                                                    }}
                                                                >
                                                                    <span>{opt.label}</span>
                                                                    {field.value === opt.value && (
                                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </LabeledContainer>
                                    )}
                                />

                            {watchType && watchType !== 'REFERENCE' && (
                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                    <FormField
                                        control={form.control}
                                        name="ratio"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Ratio de Conversión"
                                                required
                                                type="number"
                                                step="0.00001"
                                                error={fieldState.error?.message}
                                                className="font-mono text-sm"
                                                hint={watchType === 'BIGGER'
                                                    ? 'Cuántas unidades base equivalen a esta unidad'
                                                    : 'Cuántas unidades de estas equivalen a la unidad base'}
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </form>
                </Form>
            </FormSplitLayout>
        </BaseModal>
        
        {isCreateCategoryOpen && (
            <UoMCategoryForm 
                open={isCreateCategoryOpen} 
                onOpenChange={setIsCreateCategoryOpen} 
                onSuccess={handleCategoryCreated} 
            />
        )}
        </>
    )
}
